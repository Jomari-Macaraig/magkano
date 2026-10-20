import { fileURLToPath } from "node:url";
import { readSeedInput } from "../src/seed/input.ts";
import { runSeed, type SeedPlan } from "../src/seed/seed.ts";

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));

/** The plan `seed` builds from the real committed dataset. */
export async function realSeedPlan(): Promise<SeedPlan> {
  let plan: SeedPlan | undefined;
  const result = await runSeed(readSeedInput(dataDir), async (p) => {
    plan = p;
  });
  if (!result.ok || !plan)
    throw new Error(`The real dataset fails seed: ${JSON.stringify(result)}`);
  return plan;
}
