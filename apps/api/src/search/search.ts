import type { RecipeCard } from "../recipes.ts";
import {
  type ChunkSource,
  expandQuery,
  findFoods,
  type SearchTag,
  tagChain,
  toWords,
} from "./chunks.ts";
import { type ChunkSimilarity, MAX_RESULTS, rankBySimilarity } from "./rank.ts";

/** Everything search reads besides the chunk vectors: the vocabulary and every Recipe. */
export type SearchIndex = {
  tags: SearchTag[];
  recipes: (RecipeCard & { ingredients: ChunkSource["ingredients"] })[];
};

/** `fallback` is true when the results came from text matching, not embeddings. */
export type SearchResponse = { fallback: boolean; results: RecipeCard[] };

/** What `GET /api/search` reads through. Route tests pass a stub; the server passes Postgres + OpenAI. */
export interface RecipeSearch {
  search(query: string): Promise<SearchResponse>;
}

export type RecipeSearchDeps = {
  loadIndex(): Promise<SearchIndex>;
  /** Cosine similarity of `vector` to each Recipe's two chunks, by Recipe id. */
  similarities(vector: number[]): Promise<Map<string, ChunkSimilarity>>;
  /** Embeds one query text; null when there is no `OPENAI_API_KEY`. */
  embedQuery: ((text: string) => Promise<number[]>) | null;
  /** How long to wait for the embedding before falling back (default 3 s). */
  timeoutMs?: number;
};

export const EMBED_TIMEOUT_MS = 3000;

/**
 * Semantic search: the query, with known foods expanded, is embedded and Recipes are ranked
 * by chunk similarity. When there is no embedder, or embedding fails or takes over 3 s, it
 * falls back to text matching and says so. An empty query returns nothing.
 */
export function createRecipeSearch(deps: RecipeSearchDeps): RecipeSearch {
  const timeoutMs = deps.timeoutMs ?? EMBED_TIMEOUT_MS;
  return {
    async search(query) {
      if (toWords(query).length === 0) return { fallback: false, results: [] };
      const index = await deps.loadIndex();
      const vector = deps.embedQuery
        ? await withTimeout(deps.embedQuery(expandQuery(index.tags, query)), timeoutMs).catch(
            (err: unknown) => {
              console.warn(`search: embedding failed, using text search (${String(err)})`);
              return null;
            },
          )
        : null;
      if (!vector) return { fallback: true, results: textSearch(index, query) };
      const similarities = await deps.similarities(vector);
      return {
        fallback: false,
        results: rankBySimilarity(index.recipes.map(toCard), similarities),
      };
    },
  };
}

/**
 * The fallback: case-insensitive substring matching on Recipe names, Ingredient names and the
 * aliases of each Ingredient's Tag and its ancestors. Besides the whole query, it looks for
 * each known food the query names, by any of its aliases ("something with pork" also looks
 * for "baboy"). Title hits come first; ties go by name; at most 8.
 */
export function textSearch(index: SearchIndex, query: string): RecipeCard[] {
  const words = toWords(query);
  if (words.length === 0) return [];
  const terms = new Set([words.join(" ")]);
  for (const { tag } of findFoods(index.tags, words)) {
    for (const alias of tag.aliases) terms.add(normalise(alias));
  }
  const hits = (text: string) => [...terms].some((term) => normalise(text).includes(term));

  const bySlug = new Map(index.tags.map((t) => [t.slug, t]));
  const ranked = index.recipes.flatMap((recipe) => {
    const title = hits(recipe.name);
    const ingredient = recipe.ingredients.some(
      ({ name, tag }) =>
        hits(name) || tagChain(bySlug, tag).some((t) => t.aliases.some((alias) => hits(alias))),
    );
    return title || ingredient ? [{ recipe, rank: title ? 0 : 1 }] : [];
  });
  ranked.sort((a, b) => a.rank - b.rank || a.recipe.name.localeCompare(b.recipe.name));
  return ranked.slice(0, MAX_RESULTS).map(({ recipe }) => toCard(recipe));
}

const normalise = (text: string) => toWords(text).join(" ");

const toCard = ({ id, name, description, servings }: RecipeCard): RecipeCard => ({
  id,
  name,
  description,
  servings,
});

/** Rejects if `promise` hasn't settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
