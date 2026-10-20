import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { recipes } from "../../data/recipes";
import { tags } from "../../data/tags";
import type { SeedInput } from "./seed";

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

/** The committed dataset in `dataDir`, unchecked: `runSeed` validates it. */
export function readSeedInput(dataDir: string): SeedInput {
  const publicationsDir = join(dataDir, "publications");
  return {
    tags,
    recipes,
    tagAssignments: readJson(join(dataDir, "tag-assignments.json")),
    publications: readdirSync(publicationsDir)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((file) => ({ file, content: readJson(join(publicationsDir, file)) })),
  };
}
