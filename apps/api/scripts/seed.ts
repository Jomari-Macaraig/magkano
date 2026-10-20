// Usage: pnpm seed    check every data file, embed new Recipe chunks, then wipe and reload the database
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDb } from "../src/db/client.ts";
import {
  type EmbeddingCache,
  embedRecipeChunks,
  formatEmbeddingCache,
  parseEmbeddingCache,
} from "../src/search/embeddings.ts";
import { createOpenAiEmbedder } from "../src/search/openai.ts";
import { readSeedInput } from "../src/seed/input.ts";
import { runSeed } from "../src/seed/seed.ts";
import { writeSeedPlan } from "../src/seed/write.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("seed: DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const input = readSeedInput(dataDir);
const cachePath = fileURLToPath(new URL("../data/embeddings.json", import.meta.url));
const cache: EmbeddingCache = existsSync(cachePath)
  ? parseEmbeddingCache(JSON.parse(readFileSync(cachePath, "utf8")))
  : {};

const apiKey = process.env.OPENAI_API_KEY;
const openAiEmbed = createOpenAiEmbedder(apiKey, { timeoutMs: 120_000, maxRetries: 2 });

const db = createDb(databaseUrl);
try {
  let summary = "";
  const result = await runSeed(input, async (plan) => {
    const embedded = await embedRecipeChunks(plan, cache, async (texts) => {
      if (!apiKey) {
        throw new Error(
          `seed: ${texts.length} Recipe chunks are not in data/embeddings.json and OPENAI_API_KEY is not set.`,
        );
      }
      console.log(`Embedding ${texts.length} new Recipe chunks…`);
      return openAiEmbed(texts);
    });
    // Written before the database: the vectors are good even if the load fails.
    writeFileSync(cachePath, formatEmbeddingCache(embedded.cache));
    await writeSeedPlan(db, plan, embedded.chunks);
    summary = [
      `${plan.tags.length} Tags`,
      `${plan.recipes.length} Recipes`,
      `${plan.recipes.reduce((n, r) => n + r.ingredients.length, 0)} Ingredients`,
      `${embedded.chunks.length} Recipe chunks (${embedded.embedded} newly embedded)`,
      `${plan.publications.length} Publications`,
      `${plan.commodities.length} Commodities`,
      `${plan.priceObservations.length} Price Observations`,
    ].join(", ");
  });
  if (result.ok) {
    console.log(`Seeded ${summary}.`);
  } else {
    for (const problem of result.problems) console.error(problem);
    console.error(`\nseed: ${result.problems.length} problems; the database was not changed.`);
    process.exitCode = 1;
  }
} finally {
  await db.close();
}
