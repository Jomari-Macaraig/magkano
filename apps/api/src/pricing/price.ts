// The one pricing function (spec: Pricing). Pure: it prices a Draft against the Catalog it is
// given and never touches the database. All price maths in the app happens here.
import type { CountUnit, MeasureUnit, Source, Unit } from "../db/schema.ts";
import type { Catalog, CatalogCommodity, CatalogRecipe } from "./catalog.ts";
import { buildTagTree, type TagTree } from "./tags.ts";

/** The user's choices for one line (line state). */
export type LineState = {
  haveIt?: boolean;
  pickedCommodityKey?: string;
  /** A Price Override: the line's total in centavos. */
  overrideCentavos?: number;
  includeOptional?: boolean;
};

/** The Draft as the device stores it. `lines` is keyed by line key. */
export type PriceRequest = {
  recipes: { id: string; servings: number }[];
  lines: Record<string, LineState>;
};

/** An amount as a Recipe writes it. A null quantity (and unit) means "to taste", with its note. */
export type Amount = { quantity: number | null; unit: Unit | null; note: string | null };

/** Whole Purchase Units to buy: `units` × `amount` `unit` (a piece is one `countUnit`). */
export type Buy = { units: number; amount: number; unit: MeasureUnit; countUnit: CountUnit | null };

export type PricedMatch = {
  commodityKey: string;
  name: string;
  spec: string;
  source: Source;
  publishedOn: string | null;
  publicationTitle: string | null;
  buy: Buy;
  /** The price of one Purchase Unit; null when the Commodity has no price. */
  unitPriceCentavos: number | null;
  lineCentavos: number | null;
  /** No conversion reached this Commodity's unit, so this is one Purchase Unit as a guess. */
  rough: boolean;
  /** The default: lowest line cost after rounding. */
  cheapest: boolean;
};

export type LineStatus = "priced" | "noPrice" | "haveIt" | "optionalExcluded";

export type PricedLine = {
  /** The Tag slug, or `untagged:<normalised name>`. */
  key: string;
  name: string;
  fromRecipes: { id: string; name: string; amount: Amount; optional: boolean }[];
  /** The total needed, or null when the parts can't be added up. */
  need: Amount | null;
  optional: boolean;
  included: boolean;
  haveIt: boolean;
  status: LineStatus;
  price: {
    commodityKey: string | null;
    buy: Buy | null;
    lineCentavos: number | null;
    rough: boolean;
    overridden: boolean;
  };
  pickUnavailable: boolean;
  /** Cheapest first; unpriced last. */
  matches: PricedMatch[];
};

export type PriceResponse = {
  recipes: { id: string; name: string; servings: number }[];
  total: {
    centavos: number;
    counts: {
      priced: number;
      noPrice: number;
      haveIt: number;
      estimated: number;
      optionalExcluded: number;
    };
  };
  lines: PricedLine[];
  droppedRecipeIds: string[];
};

/** Lowercased, trimmed, repeated spaces collapsed: how untagged Ingredients merge. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

type Part = {
  recipe: CatalogRecipe;
  quantity: number | null;
  unit: Unit | null;
  prepNote: string | null;
  optional: boolean;
};

/**
 * Prices a Draft: scale by servings, convert to g / ml / pieces, merge by Tag (untagged by
 * normalised name), find Ingredient Matches, round up to whole Purchase Units and default each
 * line to its lowest line cost. Then applies the shopper's line state and totals the list.
 */
export function priceDraft(catalog: Catalog, request: PriceRequest): PriceResponse {
  const tree = buildTagTree(catalog.tags);
  const recipesById = new Map(catalog.recipes.map((r) => [r.id, r]));
  const recipes: PriceResponse["recipes"] = [];
  const droppedRecipeIds: string[] = [];
  const lines = new Map<string, { name: string; tag: string | null; parts: Part[] }>();

  for (const { id, servings } of request.recipes) {
    const recipe = recipesById.get(id);
    if (!recipe) {
      droppedRecipeIds.push(id);
      continue;
    }
    recipes.push({ id, name: recipe.name, servings });
    const scale = servings / recipe.servings;
    for (const ingredient of recipe.ingredients) {
      const tag = ingredient.tag === null ? undefined : tree.get(ingredient.tag);
      const key = tag ? tag.slug : `untagged:${normaliseName(ingredient.name)}`;
      let line = lines.get(key);
      if (!line) {
        line = { name: tag?.name ?? ingredient.name.trim(), tag: tag?.slug ?? null, parts: [] };
        lines.set(key, line);
      }
      line.parts.push({
        recipe,
        quantity: ingredient.quantity === null ? null : round3(ingredient.quantity * scale),
        unit: ingredient.unit,
        prepNote: ingredient.prepNote,
        optional: ingredient.optional,
      });
    }
  }

  const priced = [...lines].map(([key, line]): PricedLine => {
    const state = request.lines[key] ?? {};
    const optional = line.parts.every((p) => p.optional);
    // In a mixed line the optional parts' quantities are left out.
    const counted = line.parts.filter((p) => optional || !p.optional);
    const included = !optional || state.includeOptional === true;
    const haveIt = state.haveIt === true;

    const matches = tree
      .matches(line.tag, catalog.commodities)
      .map((c) => priceMatch(tree, line.tag, counted, c))
      .sort(cheapestFirst);
    const first = matches[0];
    if (first && first.lineCentavos !== null) first.cheapest = true;

    const picked =
      state.pickedCommodityKey === undefined
        ? undefined
        : matches.find((m) => m.commodityKey === state.pickedCommodityKey);
    const pickUnavailable = state.pickedCommodityKey !== undefined && !picked;
    const chosen = picked ?? matches.find((m) => m.lineCentavos !== null) ?? first ?? null;

    const overridden = state.overrideCentavos !== undefined;
    const lineCentavos = overridden
      ? (state.overrideCentavos ?? null)
      : (chosen?.lineCentavos ?? null);
    const status = lineStatus({ haveIt, included, lineCentavos });

    return {
      key,
      name: line.name,
      fromRecipes: line.parts.map((p) => ({
        id: p.recipe.id,
        name: p.recipe.name,
        amount: { quantity: p.quantity, unit: p.unit, note: p.prepNote },
        optional: p.optional,
      })),
      need: totalNeed(tree, line.tag, counted, chosen),
      optional,
      included,
      haveIt,
      status,
      price: {
        commodityKey: chosen?.commodityKey ?? null,
        buy: chosen?.buy ?? null,
        lineCentavos,
        rough: !overridden && (chosen?.rough ?? false),
        overridden,
      },
      pickUnavailable,
      matches,
    };
  });

  const count = (status: LineStatus) => priced.filter((l) => l.status === status).length;
  const toBuy = priced.filter((l) => l.status === "priced");
  return {
    recipes,
    total: {
      centavos: toBuy.reduce((sum, l) => sum + (l.price.lineCentavos ?? 0), 0),
      counts: {
        priced: toBuy.length,
        noPrice: count("noPrice"),
        haveIt: count("haveIt"),
        estimated: toBuy.filter((l) => l.price.rough).length,
        optionalExcluded: count("optionalExcluded"),
      },
    },
    lines: priced,
    droppedRecipeIds,
  };
}

/** Have It beats an excluded optional line, which beats a missing price. */
function lineStatus(line: {
  haveIt: boolean;
  included: boolean;
  lineCentavos: number | null;
}): LineStatus {
  if (line.haveIt) return "haveIt";
  if (!line.included) return "optionalExcluded";
  return line.lineCentavos === null ? "noPrice" : "priced";
}

/** Units that convert straight to a base unit, with no Unit Conversion. */
const direct: Partial<Record<Unit, [MeasureUnit, number]>> = {
  g: ["g", 1],
  kg: ["g", 1000],
  ml: ["ml", 1],
  L: ["ml", 1000],
  tsp: ["ml", 5],
  tbsp: ["ml", 15],
  cup: ["ml", 240],
  piece: ["piece", 1],
};

type CountWeight = Pick<CatalogCommodity, "countUnit" | "countWeightG">;
const noCountWeight: CountWeight = { countUnit: null, countWeightG: null };

/**
 * `quantity` of `unit` in `dimension` (g, ml or pieces of this Commodity), or null when no
 * conversion reaches it. The Commodity's own count weight beats the Tag's Unit Conversion.
 */
function amountIn(
  tree: TagTree,
  tag: string | null,
  quantity: number,
  unit: Unit,
  dimension: MeasureUnit,
  c: CountWeight,
): number | null {
  const weight = c.countWeightG;
  if (c.countUnit !== null && unit === c.countUnit) {
    if (dimension === "piece") return quantity;
    if (dimension === "g" && weight) return quantity * weight;
  }
  const straight = direct[unit];
  if (straight?.[0] === dimension) return quantity * straight[1];

  const conversion = tag === null ? undefined : tree.conversion(tag, unit);
  const base = conversion
    ? { amount: quantity * conversion.amount, unit: conversion.baseUnit as MeasureUnit }
    : straight && straight[0] !== "piece"
      ? { amount: quantity * straight[1], unit: straight[0] }
      : null;
  if (!base) return null;
  if (base.unit === dimension) return base.amount;
  if (base.unit === "g" && dimension === "piece" && weight) return base.amount / weight;
  return null;
}

function priceMatch(
  tree: TagTree,
  tag: string | null,
  parts: Part[],
  c: CatalogCommodity,
): PricedMatch {
  const dimension = c.purchaseUnit.unit;
  let need = 0;
  let measured = false;
  let unconvertible = 0;
  for (const part of parts) {
    if (part.quantity === null || part.unit === null) continue;
    const amount = amountIn(tree, tag, part.quantity, part.unit, dimension, c);
    if (amount === null) unconvertible++;
    else {
      need += amount;
      measured = true;
    }
  }
  const rough = unconvertible > 0;
  // Whole Purchase Units for what converts, plus one per part that doesn't (a Rough
  // Estimate). "To taste" alone is one Purchase Unit.
  const units =
    (measured ? Math.ceil(need / c.purchaseUnit.amount - 1e-9) : 0) + unconvertible || 1;
  const exactUnitPrice = unitPriceCentavos(c);
  // The line is whole units × the rounded price each, so the two always agree on screen.
  const unitPrice = exactUnitPrice === null ? null : Math.round(exactUnitPrice);
  return {
    commodityKey: c.key,
    name: c.name,
    spec: c.spec,
    source: c.source,
    publishedOn: c.price?.publishedOn ?? null,
    publicationTitle: c.price?.publicationTitle ?? null,
    buy: { units, amount: c.purchaseUnit.amount, unit: dimension, countUnit: c.countUnit },
    unitPriceCentavos: unitPrice,
    lineCentavos: unitPrice === null ? null : units * unitPrice,
    rough,
    cheapest: false,
  };
}

/** One Purchase Unit's price: e.g. ₱/kg × piece weight for a per-kg Commodity sold by the piece. */
function unitPriceCentavos(c: CatalogCommodity): number | null {
  if (!c.price) return null;
  const { priceBasis: basis, purchaseUnit: pu, countWeightG: weight } = c;
  let inBasis: number | null = null;
  if (pu.unit === basis.unit) inBasis = pu.amount;
  else if (pu.unit === "piece" && basis.unit === "g" && weight) inBasis = pu.amount * weight;
  else if (pu.unit === "g" && basis.unit === "piece" && weight) inBasis = pu.amount / weight;
  return inBasis === null ? null : (c.price.centavos * inBasis) / basis.amount;
}

/** Lowest line cost first; ties to the lower price per base unit; unpriced last. */
function cheapestFirst(a: PricedMatch, b: PricedMatch): number {
  if (a.lineCentavos === null || b.lineCentavos === null) {
    if (a.lineCentavos !== b.lineCentavos) return a.lineCentavos === null ? 1 : -1;
    return a.name.localeCompare(b.name);
  }
  return (
    a.lineCentavos - b.lineCentavos ||
    perBase(a) - perBase(b) ||
    a.name.localeCompare(b.name) ||
    a.spec.localeCompare(b.spec)
  );
}

function perBase(m: PricedMatch): number {
  return (m.unitPriceCentavos ?? 0) / m.buy.amount;
}

/**
 * The line's total need: in the Recipes' own unit when every part shares one, else in g or ml,
 * else in the chosen match's unit. "To taste" when no part has a quantity.
 */
function totalNeed(
  tree: TagTree,
  tag: string | null,
  parts: Part[],
  chosen: PricedMatch | null,
): Amount | null {
  const measured = parts.filter(
    (p): p is Part & { quantity: number; unit: Unit } => p.quantity !== null && p.unit !== null,
  );
  if (measured.length === 0) {
    return { quantity: null, unit: null, note: parts.find((p) => p.prepNote)?.prepNote ?? null };
  }
  const sum = (amounts: (number | null)[]) =>
    amounts.every((a) => a !== null) ? round3(amounts.reduce<number>((s, a) => s + a, 0)) : null;
  const firstUnit = measured[0]?.unit;
  if (firstUnit && measured.every((p) => p.unit === firstUnit)) {
    return { quantity: sum(measured.map((p) => p.quantity)), unit: firstUnit, note: null };
  }
  for (const dimension of ["g", "ml"] as const) {
    const total = sum(
      measured.map((p) => amountIn(tree, tag, p.quantity, p.unit, dimension, noCountWeight)),
    );
    if (total !== null) return { quantity: total, unit: dimension, note: null };
  }
  if (chosen && !chosen.rough) {
    const c = chosen;
    const total = sum(
      measured.map((p) =>
        amountIn(tree, tag, p.quantity, p.unit, c.buy.unit, {
          countUnit: c.buy.countUnit,
          countWeightG: null,
        }),
      ),
    );
    if (total !== null) return { quantity: total, unit: c.buy.unit, note: null };
  }
  return null;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
