import type { BaseUnit, CountUnit, MeasureUnit, Source, Unit } from "../db/schema.ts";
import type { SeedPlan } from "../seed/seed.ts";

/** Everything pricing reads, keyed by Tag slugs, Recipe ids and Commodity keys. */
export type Catalog = {
  tags: CatalogTag[];
  recipes: CatalogRecipe[];
  commodities: CatalogCommodity[];
};

export type CatalogTag = {
  slug: string;
  name: string;
  parent: string | null;
  conversions: { unit: Unit; amount: number; baseUnit: BaseUnit }[];
};

export type CatalogRecipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: {
    name: string;
    /** null with a null unit means "to taste". */
    quantity: number | null;
    unit: Unit | null;
    prepNote: string | null;
    optional: boolean;
    tag: string | null;
  }[];
};

export type Quantity = { amount: number; unit: MeasureUnit };

export type CatalogCommodity = {
  key: string;
  source: Source;
  name: string;
  spec: string;
  tag: string | null;
  priceBasis: Quantity;
  purchaseUnit: Quantity;
  countUnit: CountUnit | null;
  countWeightG: number | null;
  /** From the Commodity's newest Publication; null when it has no price. */
  price: { centavos: number; publishedOn: string; publicationTitle: string } | null;
};

/** Where the price route reads the Catalog from. Route tests pass a stub; the server passes Postgres. */
export interface CatalogStore {
  catalog(): Promise<Catalog>;
}

/** The Catalog a seed plan would load: lets tests price the real dataset without a database. */
export function catalogFromSeedPlan(plan: SeedPlan): Catalog {
  const publications = new Map(plan.publications.map((p) => [p.file, p]));
  const prices = new Map<string, NonNullable<CatalogCommodity["price"]>>();
  for (const o of plan.priceObservations) {
    const publication = publications.get(o.publicationFile);
    if (!publication) continue;
    const current = prices.get(o.commodityKey);
    if (current && current.publishedOn >= publication.publishedOn) continue;
    prices.set(o.commodityKey, {
      centavos: o.priceCentavos,
      publishedOn: publication.publishedOn,
      publicationTitle: publication.title,
    });
  }
  return {
    tags: plan.tags.map(({ slug, name, parent, conversions }) => ({
      slug,
      name,
      parent,
      conversions,
    })),
    recipes: plan.recipes.map((r) => ({
      id: r.id,
      name: r.name,
      servings: r.servings,
      ingredients: r.ingredients.map(({ name, quantity, unit, prepNote, optional, tag }) => ({
        name,
        quantity,
        unit,
        prepNote,
        optional,
        tag,
      })),
    })),
    commodities: plan.commodities.map((c) => ({
      key: c.key,
      source: c.source,
      name: c.name,
      spec: c.spec,
      tag: c.tag,
      priceBasis: { amount: c.priceBasisAmount, unit: c.priceBasisUnit },
      purchaseUnit: { amount: c.purchaseUnitAmount, unit: c.purchaseUnitUnit },
      countUnit: c.countUnit,
      countWeightG: c.countWeightG,
      price: prices.get(c.key) ?? null,
    })),
  };
}
