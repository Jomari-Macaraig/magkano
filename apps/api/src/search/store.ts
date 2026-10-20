import { asc, sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { ingredients, recipeChunks, recipes, tagAliases, tags } from "../db/schema.ts";
import type { ChunkSimilarity } from "./rank.ts";
import type { RecipeSearchDeps, SearchIndex } from "./search.ts";

/** The Postgres half of search: the index (vocabulary + Recipes) and chunk similarities. */
export function createPgSearchSource(db: Db): Pick<RecipeSearchDeps, "loadIndex" | "similarities"> {
  return {
    async loadIndex(): Promise<SearchIndex> {
      const [tagRows, aliasRows, recipeRows, ingredientRows] = await Promise.all([
        db
          .select({ id: tags.id, slug: tags.slug, name: tags.name, parentId: tags.parentId })
          .from(tags),
        db.select({ tagId: tagAliases.tagId, alias: tagAliases.alias }).from(tagAliases),
        db
          .select({
            id: recipes.id,
            name: recipes.name,
            description: recipes.description,
            servings: recipes.servings,
          })
          .from(recipes)
          .orderBy(asc(recipes.name), asc(recipes.id)),
        db
          .select({
            recipeId: ingredients.recipeId,
            name: ingredients.name,
            tagId: ingredients.tagId,
          })
          .from(ingredients)
          .orderBy(asc(ingredients.recipeId), asc(ingredients.position)),
      ]);
      const slugOf = new Map(tagRows.map((t) => [t.id, t.slug]));
      const aliasesOf = new Map<number, string[]>();
      for (const { tagId, alias } of aliasRows) {
        aliasesOf.set(tagId, [...(aliasesOf.get(tagId) ?? []), alias]);
      }
      const ingredientsOf = new Map<string, { name: string; tag: string | null }[]>();
      for (const { recipeId, name, tagId } of ingredientRows) {
        const tag = tagId === null ? null : (slugOf.get(tagId) ?? null);
        ingredientsOf.set(recipeId, [...(ingredientsOf.get(recipeId) ?? []), { name, tag }]);
      }
      return {
        tags: tagRows.map((t) => ({
          slug: t.slug,
          parent: t.parentId === null ? null : (slugOf.get(t.parentId) ?? null),
          // The display name first, as when the chunks were built.
          aliases: [t.name, ...(aliasesOf.get(t.id) ?? []).filter((a) => a !== t.name)],
        })),
        recipes: recipeRows.map((r) => ({ ...r, ingredients: ingredientsOf.get(r.id) ?? [] })),
      };
    },

    async similarities(vector) {
      const rows = await db
        .select({
          recipeId: recipeChunks.recipeId,
          kind: recipeChunks.kind,
          similarity:
            sql<number>`1 - (${recipeChunks.embedding} <=> ${JSON.stringify(vector)}::vector)`.mapWith(
              Number,
            ),
        })
        .from(recipeChunks);
      const out = new Map<string, ChunkSimilarity>();
      for (const { recipeId, kind, similarity } of rows) {
        const entry = out.get(recipeId) ?? { title: 0, ingredients: 0 };
        entry[kind] = similarity;
        out.set(recipeId, entry);
      }
      return out;
    },
  };
}
