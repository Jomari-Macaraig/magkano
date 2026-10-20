// Recipe chunk vectors for `seed`, cached in the committed `data/embeddings.json`.
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ChunkKind } from "../db/schema";
import { type ChunkSource, recipeChunkTexts, type SearchTag } from "./chunks";

/** Size of every stored vector (`recipe_chunks.embedding` is `vector(1536)`). */
export const EMBEDDING_DIMENSIONS = 1536;

/** A hash of a chunk's text mapped to its vector. */
export type EmbeddingCache = Record<string, number[]>;

/** Embeds texts, one vector per text in the same order. */
export type Embedder = (texts: string[]) => Promise<number[][]>;

export type RecipeChunk = {
  recipeId: string;
  kind: ChunkKind;
  content: string;
  embedding: number[];
};

/** Texts per embeddings request, well under OpenAI's limit of 2048. */
const EMBED_BATCH = 500;

/** The cache key of a chunk text: its SHA-256, hex. */
export function chunkHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Builds two chunks per Recipe and finds each one's vector in `cache`, embedding only texts
 * that aren't there. Returns the chunks, the cache to write back (exactly the vectors the
 * current chunks use, so stale ones drop out) and how many texts were embedded.
 */
export async function embedRecipeChunks(
  data: { tags: SearchTag[]; recipes: (ChunkSource & { id: string })[] },
  cache: EmbeddingCache,
  embed: Embedder,
): Promise<{ chunks: RecipeChunk[]; cache: EmbeddingCache; embedded: number }> {
  const pending = data.recipes.flatMap((recipe) => {
    const texts = recipeChunkTexts(data.tags, recipe);
    return (["title", "ingredients"] as const).map((kind) => ({
      recipeId: recipe.id,
      kind,
      content: texts[kind],
      hash: chunkHash(texts[kind]),
    }));
  });

  const known = new Map(Object.entries(cache));
  const missing = [
    ...new Map(pending.filter((c) => !known.has(c.hash)).map((c) => [c.hash, c.content])),
  ];
  for (let i = 0; i < missing.length; i += EMBED_BATCH) {
    const batch = missing.slice(i, i + EMBED_BATCH);
    const vectors = await embed(batch.map(([, content]) => content));
    if (vectors.length !== batch.length) {
      throw new Error(`Embedding returned ${vectors.length} vectors for ${batch.length} texts`);
    }
    for (const [k, [hash]] of batch.entries()) known.set(hash, vectors[k] as number[]);
  }

  const chunks = pending.map(({ hash, ...chunk }) => ({
    ...chunk,
    embedding: known.get(hash) as number[],
  }));
  const used = new Set(pending.map((c) => c.hash));
  return {
    chunks,
    cache: Object.fromEntries([...known].filter(([hash]) => used.has(hash))),
    embedded: missing.length,
  };
}

/** `embeddings.json` as written: sorted by hash, one entry per line, so diffs stay small. */
export function formatEmbeddingCache(cache: EmbeddingCache): string {
  const lines = Object.keys(cache)
    .sort()
    .map((hash) => `  ${JSON.stringify(hash)}: ${JSON.stringify(cache[hash])}`);
  return lines.length ? `{\n${lines.join(",\n")}\n}\n` : "{}\n";
}

/** Checks a parsed `embeddings.json`; throws on a malformed file or a vector of the wrong size. */
export function parseEmbeddingCache(
  value: unknown,
  dimensions: number = EMBEDDING_DIMENSIONS,
): EmbeddingCache {
  return z.record(z.string(), z.array(z.number()).length(dimensions)).parse(value);
}
