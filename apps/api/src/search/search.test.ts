import { afterEach, describe, expect, it, vi } from "vitest";
import { realSeedPlan } from "../../test/seed-plan.ts";
import { expandQuery } from "./chunks.ts";
import type { ChunkSimilarity } from "./rank.ts";
import { createRecipeSearch, type SearchIndex, textSearch } from "./search.ts";

const plan = await realSeedPlan();
/** The real Seeded Recipes and vocabulary, as the search reads them from Postgres. */
const index: SearchIndex = {
  tags: plan.tags.map(({ slug, parent, aliases }) => ({ slug, parent, aliases })),
  recipes: plan.recipes.map(({ id, name, description, servings, ingredients }) => ({
    id,
    name,
    description,
    servings,
    ingredients: ingredients.map(({ name, tag }) => ({ name, tag })),
  })),
};
const names = (cards: { name: string }[]) => cards.map((c) => c.name);

describe("textSearch (the fallback)", () => {
  it("finds a Recipe by name, ignoring case", () => {
    expect(names(textSearch(index, "ADOBO"))).toEqual(["Chicken Adobo"]);
  });

  it("finds the same Recipes in Tagalog or English, through Ingredient names and Tag aliases", () => {
    const tagalog = names(textSearch(index, "bawang"));
    const english = names(textSearch(index, "garlic"));

    expect(tagalog).toContain("Chicken Adobo");
    expect(english).toEqual(tagalog);
  });

  it("ranks title hits first (in either language), then by name", () => {
    const results = names(textSearch(index, "manok"));

    expect(results.slice(0, 3)).toEqual(["Chicken Adobo", "Chicken Afritada", "Tinolang Manok"]);
    expect(results).toContain("Arroz Caldo");
    expect(results.slice(3)).toEqual([...results.slice(3)].sort((a, b) => a.localeCompare(b)));
  });

  it("matches a food named inside a longer query, and returns at most 8 cards", () => {
    const results = textSearch(index, "something with pork");

    expect(names(results).slice(0, 3)).toEqual([
      "Pork Giniling",
      "Pork Menudo",
      "Sinigang na Baboy",
    ]);
    expect(names(results)).toContain("Lechon Kawali");
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it("returns cards only: no Ingredients", () => {
    expect(textSearch(index, "adobo")[0]).toEqual({
      id: "chicken-adobo",
      name: "Chicken Adobo",
      description: "Chicken braised in soy sauce, vinegar and garlic.",
      servings: 4,
    });
  });

  it("returns nothing when nothing matches", () => {
    expect(textSearch(index, "pizza")).toEqual([]);
  });
});

describe("createRecipeSearch", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Adobo's chunks are closest to any query, then Tinola's; the embedder is a stub. */
  const similarities = async () =>
    new Map<string, ChunkSimilarity>([
      ["chicken-adobo", { title: 0.6, ingredients: 0.5 }],
      ["tinolang-manok", { title: 0.5, ingredients: 0.4 }],
      ["pinakbet", { title: 0.1, ingredients: 0.1 }],
    ]);
  const searchWith = (embedQuery: ((text: string) => Promise<number[]>) | null) =>
    createRecipeSearch({ loadIndex: async () => index, similarities, embedQuery });

  it("embeds the expanded query and ranks by chunk similarity", async () => {
    const embed = vi.fn(async (_text: string) => [1, 0, 0]);

    const response = await searchWith(embed).search("manok");

    expect(embed).toHaveBeenCalledWith(expandQuery(index.tags, "manok"));
    expect(response.fallback).toBe(false);
    expect(names(response.results)).toEqual(["Chicken Adobo", "Tinolang Manok"]);
    expect(response.results[0]).not.toHaveProperty("ingredients");
  });

  it("returns no results for an empty query, without embedding", async () => {
    const embed = vi.fn(async () => [1]);

    expect(await searchWith(embed).search("   ")).toEqual({ fallback: false, results: [] });
    expect(embed).not.toHaveBeenCalled();
  });

  it("falls back to text matching when there is no embedder (no OPENAI_API_KEY)", async () => {
    expect(await searchWith(null).search("adobo")).toEqual({
      fallback: true,
      results: textSearch(index, "adobo"),
    });
  });

  it("falls back when embedding fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await searchWith(async () => {
      throw new Error("OpenAI is down");
    }).search("adobo");

    expect(response).toEqual({ fallback: true, results: textSearch(index, "adobo") });
  });

  it("falls back when embedding takes over 3 seconds", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const never = () => new Promise<number[]>(() => {});

    const pending = searchWith(never).search("adobo");
    await vi.advanceTimersByTimeAsync(3001);

    expect(await pending).toEqual({ fallback: true, results: textSearch(index, "adobo") });
  });
});
