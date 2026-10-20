import type { CountUnit, MeasureUnit } from "../db/schema.ts";
import { ExtractError } from "./extract-error.ts";

export type Amount = { amount: number; unit: MeasureUnit };

/** What a DA price is for, what a shopper buys, and the weight of one piece/head/bundle. */
export type CommodityTerms = {
  priceBasis: Amount;
  purchaseUnit: Amount;
  countUnit: CountUnit | null;
  countWeightG: number | null;
};

const PER_KG: Amount = { amount: 1000, unit: "g" };
const QUARTER_KG: Amount = { amount: 250, unit: "g" };
const ONE_PIECE: Amount = { amount: 1, unit: "piece" };

const meatCategories = new Set([
  "FISH PRODUCTS",
  "BEEF MEAT PRODUCTS",
  "PORK MEAT PRODUCTS",
  "OTHER LIVESTOCK MEAT PRODUCTS",
  "POULTRY PRODUCTS",
]);
const riceCategories = new Set(["IMPORTED COMMERCIAL RICE", "LOCAL COMMERCIAL RICE"]);

/**
 * Price basis and default Purchase Unit from the DA category (the unit isn't printed per
 * row), plus the count weight parsed from the spec.
 * - Per kg, except eggs (per piece) and cooking oil (per bottle of the stated size).
 * - Meat, poultry, fish: 250 g. Rice, sugar, salt: 1 kg. Eggs: 1 piece. Oil: the bottle.
 * - Produce (and corn, legumes): 1 piece when a piece weight is known, else 250 g.
 */
export function daCommodityTerms(row: {
  category: string;
  name: string;
  spec: string;
}): CommodityTerms {
  const count = parseCountWeight(row.spec);
  const counted = {
    countUnit: count?.countUnit ?? null,
    countWeightG: count?.countWeightG ?? null,
  };
  if (/^cooking oil\b/i.test(row.name)) {
    const ml = parseBottleMl(row.spec);
    if (ml === null) {
      throw new ExtractError(`No bottle size in the spec "${row.spec}" of "${row.name}".`);
    }
    const bottle: Amount = { amount: ml, unit: "ml" };
    return { priceBasis: bottle, purchaseUnit: bottle, countUnit: null, countWeightG: null };
  }
  if (row.category === "POULTRY PRODUCTS" && /\begg\b/i.test(row.name)) {
    return { priceBasis: ONE_PIECE, purchaseUnit: ONE_PIECE, ...counted };
  }
  if (meatCategories.has(row.category)) {
    return { priceBasis: PER_KG, purchaseUnit: QUARTER_KG, ...counted };
  }
  if (riceCategories.has(row.category) || row.category === "OTHER BASIC COMMODITIES") {
    return { priceBasis: PER_KG, purchaseUnit: PER_KG, ...counted };
  }
  return { priceBasis: PER_KG, purchaseUnit: count ? ONE_PIECE : QUARTER_KG, ...counted };
}

const num = "(\\d+(?:\\.\\d+)?)";
const mass = "(kg|grams?|gms?|g)";

/**
 * The weight of one piece, head or bundle from a DA spec, using the midpoint of a range:
 * "13-15 pcs/kg" ≈ 71 g, "151-250gm/pc" ≈ 200 g, "510 gm - 1 kg/head" = 755 g,
 * "Medium (301-400 g)" ≈ 350 g, "3-4 Small Bundles" (per kg) ≈ 286 g.
 */
export function parseCountWeight(
  spec: string,
): { countUnit: CountUnit; countWeightG: number } | null {
  const perKg = spec.match(new RegExp(`${num}(?:\\s*-\\s*${num})?\\s*pcs?\\s*/\\s*kg`, "i"));
  if (perKg) return { countUnit: "piece", countWeightG: round(1000 / mid(perKg[1], perKg[2])) };

  const bundles = spec.match(
    new RegExp(`${num}(?:\\s*-\\s*${num})?\\s*(?:small\\s+)?bundles?`, "i"),
  );
  if (bundles) {
    return { countUnit: "bundle", countWeightG: round(1000 / mid(bundles[1], bundles[2])) };
  }

  const perUnit = spec.match(
    new RegExp(
      `${num}\\s*${mass}?(?:\\s*-\\s*${num}\\s*${mass})?\\s*/\\s*(pc|piece|head|hd)\\b`,
      "i",
    ),
  );
  if (perUnit) {
    const high = perUnit[3] ? grams(perUnit[3], perUnit[4]) : undefined;
    const low = grams(perUnit[1], perUnit[2] ?? perUnit[4]);
    if (low !== null) {
      const g = high === undefined || high === null ? low : (low + high) / 2;
      return { countUnit: /^h/i.test(perUnit[5] ?? "") ? "head" : "piece", countWeightG: round(g) };
    }
  }

  const bracketed = spec.match(new RegExp(`\\(${num}\\s*-\\s*${num}\\s*${mass}\\)`, "i"));
  if (bracketed) {
    const low = grams(bracketed[1], bracketed[3]);
    const high = grams(bracketed[2], bracketed[3]);
    if (low !== null && high !== null) {
      return { countUnit: "piece", countWeightG: round((low + high) / 2) };
    }
  }
  return null;
}

/** Why a DA row is not stored, or null to keep it. */
export function daDropReason(row: { name: string; spec: string }): string | null {
  return /feed grade/i.test(`${row.name} ${row.spec}`) ? "feed grade" : null;
}

function parseBottleMl(spec: string): number | null {
  const m = spec.match(new RegExp(`${num}\\s*(ml|l|liters?|litres?)\\s*/\\s*bottle`, "i"));
  if (!m) return null;
  return /^ml$/i.test(m[2] ?? "") ? Number(m[1]) : Number(m[1]) * 1000;
}

function mid(a: string | undefined, b?: string): number {
  return b === undefined ? Number(a) : (Number(a) + Number(b)) / 2;
}

function grams(value: string | undefined, unit: string | undefined): number | null {
  if (!value || !unit) return null;
  return /^kg$/i.test(unit) ? Number(value) * 1000 : Number(value);
}

function round(g: number): number {
  return Math.round(g * 1000) / 1000;
}
