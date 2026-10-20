// Local dev server. The web dev server proxies /api here.
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDb } from "./db/client";
import { createRecipeStore } from "./recipes";
import { createOpenAiEmbedder } from "./search/openai";
import { createRecipeSearch, EMBED_TIMEOUT_MS } from "./search/search";
import { createPgSearchSource } from "./search/store";

const port = Number(process.env.API_PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set (see .env.example)");
const db = createDb(databaseUrl);

// Without a key, search always falls back to text matching.
const apiKey = process.env.OPENAI_API_KEY;
const embed = apiKey
  ? createOpenAiEmbedder(apiKey, { timeoutMs: EMBED_TIMEOUT_MS, maxRetries: 0 })
  : null;
const search = createRecipeSearch({
  ...createPgSearchSource(db),
  embedQuery: embed
    ? async (text) => {
        const [vector] = await embed([text]);
        if (!vector) throw new Error("Embedding returned no vector");
        return vector;
      }
    : null,
});
if (!apiKey) console.warn("OPENAI_API_KEY is not set: search uses basic text matching.");

serve({ fetch: createApp({ recipes: createRecipeStore(db), search }).fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/api`);
});
