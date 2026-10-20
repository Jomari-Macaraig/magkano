import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { RecipeSeed } from "../../data/recipes.ts";
import { type PublicationFile, publicationFileSchema } from "../extract/extract.ts";
import type { TagAssignment, TagAssignments, TaggingItem } from "./tag.ts";

/** Lowercased, trimmed, repeated spaces collapsed: how Ingredient names compare. */
export function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function ingredientKey(seedKey: string, name: string): string {
  return `ingredient:${seedKey}:${normaliseName(name)}`;
}

export function commodityAssignmentKey(commodityKey: string): string {
  return `commodity:${commodityKey}`;
}

/**
 * Every Ingredient (sent with its Recipe name) and every Commodity (sent with its DA/DTI
 * category). An Ingredient name repeated within one Recipe is one item.
 */
export function taggingItems(
  recipes: RecipeSeed[],
  publications: PublicationFile[],
): TaggingItem[] {
  const items = new Map<string, TaggingItem>();
  for (const recipe of recipes) {
    for (const [name] of recipe.ingredients) {
      const key = ingredientKey(recipe.seedKey, name);
      items.set(key, { key, text: normaliseName(name), context: recipe.name });
    }
  }
  for (const { commodities } of publications) {
    for (const c of commodities) {
      const key = commodityAssignmentKey(c.key);
      items.set(key, { key, text: c.spec ? `${c.name}, ${c.spec}` : c.name, context: c.category });
    }
  }
  return [...items.values()];
}

const assignmentSchema = z.strictObject({
  tag: z.string().min(1).nullable(),
  proposedNewTag: z.string().min(1).nullable(),
  status: z.enum(["proposed", "reviewed"]),
});

export const tagAssignmentsSchema = z.record(z.string().min(1), assignmentSchema);

export const referenceTagsSchema = z.record(
  z.string().min(1),
  z.strictObject({ tag: z.string().min(1).nullable() }),
);

/** Keys sorted, fields in a fixed order, 2-space indent and a final newline. */
export function formatTagAssignments(assignments: TagAssignments): string {
  const sorted: Record<string, TagAssignment> = {};
  for (const key of Object.keys(assignments).sort()) {
    const { tag, proposedNewTag, status } = assignments[key] as TagAssignment;
    sorted[key] = { tag, proposedNewTag, status };
  }
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

/** Every Publication file in `dir`, zod-checked, in file-name order. */
export function loadPublicationFiles(dir: string): PublicationFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => publicationFileSchema.parse(JSON.parse(readFileSync(join(dir, name), "utf8"))));
}
