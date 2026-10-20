import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { recipes } from "../../data/recipes.ts";
import { tags } from "../../data/tags.ts";
import {
  formatTagAssignments,
  loadPublicationFiles,
  tagAssignmentsSchema,
  taggingItems,
} from "./files.ts";

const dataDir = new URL("../../data/", import.meta.url);
const publications = loadPublicationFiles(fileURLToPath(new URL("publications/", dataDir)));
const assignments = tagAssignmentsSchema.parse(
  JSON.parse(readFileSync(new URL("tag-assignments.json", dataDir), "utf8")),
);

describe("taggingItems", () => {
  const items = taggingItems(recipes, publications);

  it("keys Ingredients by Recipe seed key and normalised name, sent with the Recipe name", () => {
    expect(items).toContainEqual({
      key: "ingredient:chicken-adobo:dahon ng laurel",
      text: "dahon ng laurel",
      context: "Chicken Adobo",
    });
  });

  it("keys Commodities by Commodity key, sent with name, spec and DA/DTI category", () => {
    expect(items).toContainEqual({
      key: "commodity:DA:FISH PRODUCTS:Bangus, Large:Large (1-2 pcs)",
      text: "Bangus, Large, Large (1-2 pcs)",
      context: "FISH PRODUCTS",
    });
    expect(items).toContainEqual({
      key: "commodity:DA:IMPORTED COMMERCIAL RICE:Premium:5% broken",
      text: "Premium, 5% broken",
      context: "IMPORTED COMMERCIAL RICE",
    });
  });

  it("covers every Ingredient and Commodity, with exactly the Tag Assignment keys", () => {
    expect(items.filter((i) => i.key.startsWith("ingredient:"))).toHaveLength(177);
    expect(items.filter((i) => i.key.startsWith("commodity:"))).toHaveLength(277);
    expect(items.map((i) => i.key).sort()).toEqual(Object.keys(assignments).sort());
  });
});

describe("tag-assignments.json", () => {
  it("uses only slugs from the vocabulary", () => {
    const slugs = new Set(tags.map((t) => t.slug));
    const unknown = Object.values(assignments).filter((a) => a.tag !== null && !slugs.has(a.tag));
    expect(unknown).toEqual([]);
  });

  it("is fully reviewed", () => {
    const open = Object.entries(assignments).filter(([, a]) => a.status !== "reviewed");
    expect(open).toEqual([]);
  });
});

describe("formatTagAssignments", () => {
  it("sorts keys and writes fields in a fixed order, so reruns diff cleanly", () => {
    const text = formatTagAssignments({
      "commodity:b": { status: "proposed", proposedNewTag: null, tag: "garlic" },
      "commodity:a": { proposedNewTag: "bangus", tag: null, status: "reviewed" },
    });

    expect(text).toBe(
      `{
  "commodity:a": {
    "tag": null,
    "proposedNewTag": "bangus",
    "status": "reviewed"
  },
  "commodity:b": {
    "tag": "garlic",
    "proposedNewTag": null,
    "status": "proposed"
  }
}
`,
    );
  });
});
