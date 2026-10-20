import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import {
  commodities,
  ingredients,
  priceObservations,
  publications,
  recipes,
  tags,
  unitConversions,
} from "../db/schema.ts";
import type { Catalog, CatalogStore } from "./catalog.ts";

/** How long the API keeps a loaded Catalog; a re-seed shows up after this. */
const TTL_MS = 60_000;

/**
 * The Catalog from Postgres, loaded whole (a few hundred rows) and cached for a minute.
 * Integer ids are mapped to slugs and keys here and never leave the server.
 */
export function createCatalogStore(db: Db): CatalogStore {
  let cached: { at: number; catalog: Promise<Catalog> } | null = null;
  return {
    catalog() {
      if (!cached || Date.now() - cached.at > TTL_MS) {
        const catalog = loadCatalog(db);
        cached = { at: Date.now(), catalog };
        // A failed load is not cached.
        catalog.catch(() => {
          cached = null;
        });
      }
      return cached.catalog;
    },
  };
}

async function loadCatalog(db: Db): Promise<Catalog> {
  const [tagRows, conversionRows, recipeRows, ingredientRows, commodityRows, priceRows] =
    await Promise.all([
      db.select().from(tags),
      db.select().from(unitConversions),
      db.select().from(recipes),
      db.select().from(ingredients).orderBy(asc(ingredients.recipeId), asc(ingredients.position)),
      db.select().from(commodities),
      db
        .select({
          commodityId: priceObservations.commodityId,
          centavos: priceObservations.priceCentavos,
          publishedOn: publications.publishedOn,
          title: publications.title,
        })
        .from(priceObservations)
        .innerJoin(publications, eq(priceObservations.publicationId, publications.id))
        .orderBy(desc(publications.publishedOn)),
    ]);

  const slugOf = new Map(tagRows.map((t) => [t.id, t.slug]));
  const slug = (id: number | null) => (id === null ? null : (slugOf.get(id) ?? null));

  // Rows come newest first, so the first price seen per Commodity is its current price.
  const prices = new Map<number, NonNullable<Catalog["commodities"][number]["price"]>>();
  for (const p of priceRows) {
    if (!prices.has(p.commodityId)) {
      prices.set(p.commodityId, {
        centavos: p.centavos,
        publishedOn: p.publishedOn,
        publicationTitle: p.title,
      });
    }
  }

  return {
    tags: tagRows.map((t) => ({
      slug: t.slug,
      name: t.name,
      parent: slug(t.parentId),
      conversions: conversionRows
        .filter((c) => c.tagId === t.id)
        .map(({ unit, amount, baseUnit }) => ({ unit, amount, baseUnit })),
    })),
    recipes: recipeRows.map((r) => ({
      id: r.id,
      name: r.name,
      servings: r.servings,
      ingredients: ingredientRows
        .filter((i) => i.recipeId === r.id)
        .map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          prepNote: i.prepNote,
          optional: i.optional,
          tag: slug(i.tagId),
        })),
    })),
    commodities: commodityRows.map((c) => ({
      key: c.key,
      source: c.source,
      name: c.name,
      spec: c.spec,
      tag: slug(c.tagId),
      priceBasis: { amount: c.priceBasisAmount, unit: c.priceBasisUnit },
      purchaseUnit: { amount: c.purchaseUnitAmount, unit: c.purchaseUnitUnit },
      countUnit: c.countUnit,
      countWeightG: c.countWeightG,
      price: prices.get(c.id) ?? null,
    })),
  };
}
