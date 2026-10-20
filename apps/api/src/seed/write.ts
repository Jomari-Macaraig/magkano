import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import {
  commodities,
  ingredients,
  priceObservations,
  publications,
  recipeChunks,
  recipes,
  tagAliases,
  tags,
  unitConversions,
} from "../db/schema.ts";
import type { RecipeChunk } from "../search/embeddings.ts";
import type { SeedPlan } from "./seed.ts";

/**
 * Wipes every table and loads `plan` and the Recipes' embedded search chunks, all in one
 * transaction: a failure leaves the old data. Identities restart, so the same plan always
 * gives the same rows and ids.
 */
export async function writeSeedPlan(db: Db, plan: SeedPlan, chunks: RecipeChunk[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      TRUNCATE tags, tag_aliases, unit_conversions, recipes, ingredients, recipe_chunks,
        publications, commodities, price_observations
      RESTART IDENTITY CASCADE
    `);

    // Insert Tags a level at a time so each parent has an id before its children.
    const tagIds = new Map<string, number>();
    const tagId = (slug: string) => idOf(tagIds, slug, "Tag");
    const optionalTagId = (slug: string | null) => (slug === null ? null : tagId(slug));
    let pending = plan.tags;
    while (pending.length > 0) {
      const ready = pending.filter((t) => t.parent === null || tagIds.has(t.parent));
      if (ready.length === 0) throw new Error("seed: Tags with unknown parents or a cycle");
      const rows = await tx
        .insert(tags)
        .values(
          ready.map((t) => ({ slug: t.slug, name: t.name, parentId: optionalTagId(t.parent) })),
        )
        .returning({ id: tags.id, slug: tags.slug });
      for (const row of rows) tagIds.set(row.slug, row.id);
      pending = pending.filter((t) => !tagIds.has(t.slug));
    }
    await insertAll(
      tx,
      tagAliases,
      plan.tags.flatMap((t) => t.aliases.map((alias) => ({ tagId: tagId(t.slug), alias }))),
    );
    await insertAll(
      tx,
      unitConversions,
      plan.tags.flatMap((t) => t.conversions.map((c) => ({ ...c, tagId: tagId(t.slug) }))),
    );

    await insertAll(
      tx,
      recipes,
      plan.recipes.map(({ id, name, description, servings }) => ({
        id,
        name,
        description,
        servings,
      })),
    );
    await insertAll(
      tx,
      ingredients,
      plan.recipes.flatMap((r) =>
        r.ingredients.map(({ tag, ...ingredient }) => ({
          ...ingredient,
          recipeId: r.id,
          tagId: optionalTagId(tag),
        })),
      ),
    );
    await insertAll(tx, recipeChunks, chunks);

    const publicationIds = new Map<string, number>();
    for (const { file, ...publication } of plan.publications) {
      const [row] = await tx
        .insert(publications)
        .values(publication)
        .returning({ id: publications.id });
      if (row) publicationIds.set(file, row.id);
    }
    const commodityIds = new Map<string, number>();
    if (plan.commodities.length > 0) {
      const rows = await tx
        .insert(commodities)
        .values(plan.commodities.map(({ tag, ...c }) => ({ ...c, tagId: optionalTagId(tag) })))
        .returning({ id: commodities.id, key: commodities.key });
      for (const row of rows) commodityIds.set(row.key, row.id);
    }
    await insertAll(
      tx,
      priceObservations,
      plan.priceObservations.map((p) => ({
        commodityId: idOf(commodityIds, p.commodityKey, "Commodity"),
        publicationId: idOf(publicationIds, p.publicationFile, "Publication"),
        priceCentavos: p.priceCentavos,
      })),
    );
  });
}

/** The id inserted for `key`; a missing one is a bug in the plan, so it throws (and rolls back). */
function idOf(ids: Map<string, number>, key: string, what: string): number {
  const id = ids.get(key);
  if (id === undefined) throw new Error(`seed: no id for ${what} "${key}"`);
  return id;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Inserts rows in chunks (Postgres caps bind parameters per statement); none is a no-op. */
async function insertAll<T extends Parameters<Tx["insert"]>[0]>(
  tx: Tx,
  table: T,
  rows: T["$inferInsert"][],
): Promise<void> {
  for (let i = 0; i < rows.length; i += 1000) {
    await tx.insert(table).values(rows.slice(i, i + 1000));
  }
}
