// Usage: pnpm seed    check every data file, then wipe and reload the database from them
import { fileURLToPath } from "node:url";
import { createDb } from "../src/db/client";
import { readSeedInput } from "../src/seed/input";
import { runSeed } from "../src/seed/seed";
import { writeSeedPlan } from "../src/seed/write";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("seed: DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const input = readSeedInput(fileURLToPath(new URL("../data/", import.meta.url)));

const db = createDb(databaseUrl);
try {
  let summary = "";
  const result = await runSeed(input, async (plan) => {
    await writeSeedPlan(db, plan);
    summary = [
      `${plan.tags.length} Tags`,
      `${plan.recipes.length} Recipes`,
      `${plan.recipes.reduce((n, r) => n + r.ingredients.length, 0)} Ingredients`,
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
