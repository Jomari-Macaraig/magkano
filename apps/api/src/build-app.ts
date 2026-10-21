import { createApp } from "./app.ts";
import { createDb, type Db, type DbOptions } from "./db/client.ts";
import { createCatalogStore } from "./pricing/store.ts";
import { createRecipeStore } from "./recipes.ts";
import { createOpenAiEmbedder } from "./search/openai.ts";
import { createRecipeSearch, EMBED_TIMEOUT_MS, type RecipeSearchDeps } from "./search/search.ts";
import { createPgSearchSource } from "./search/store.ts";

export type AppEnv = { DATABASE_URL?: string; OPENAI_API_KEY?: string };

export type BuildAppOptions = {
  /** Pool settings for this runtime: the local server and a Vercel Function differ. */
  db?: DbOptions;
  /** The search's database reads; tests pass a fake. Defaults to Postgres. */
  searchSource?: (db: Db) => Pick<RecipeSearchDeps, "loadIndex" | "similarities">;
};

/**
 * The API wired to Postgres (and OpenAI query embeddings when there is a key), shared by the
 * local server and the Vercel Function. Refuses to build without `DATABASE_URL`.
 */
export function buildApp(env: AppEnv, options: BuildAppOptions = {}) {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (see .env.example)");
  const db = createDb(databaseUrl, options.db);

  // Without a key, search always falls back to text matching.
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) console.warn("OPENAI_API_KEY is not set: search uses basic text matching.");
  const embed = apiKey
    ? createOpenAiEmbedder(apiKey, { timeoutMs: EMBED_TIMEOUT_MS, maxRetries: 0 })
    : null;
  const search = createRecipeSearch({
    ...(options.searchSource ?? createPgSearchSource)(db),
    embedQuery: embed
      ? async (text) => {
          const [vector] = await embed([text]);
          if (!vector) throw new Error("Embedding returned no vector");
          return vector;
        }
      : null,
  });

  return createApp({ recipes: createRecipeStore(db), catalog: createCatalogStore(db), search });
}
