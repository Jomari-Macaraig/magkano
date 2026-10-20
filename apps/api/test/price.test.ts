import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Catalog } from "../src/pricing/catalog";
import type { RecipeStore } from "../src/recipes";

const noRecipes: RecipeStore = { list: async () => [], get: async () => null };

/** A one-Recipe Catalog: enough to see the route answer; pricing itself is tested in src/pricing. */
const catalog: Catalog = {
  tags: [{ slug: "rice", name: "Rice", parent: null, conversions: [] }],
  recipes: [
    {
      id: "sinangag",
      name: "Sinangag",
      servings: 4,
      ingredients: [
        { name: "kanin", quantity: 1, unit: "kg", prepNote: null, optional: false, tag: "rice" },
      ],
    },
  ],
  commodities: [
    {
      key: "DA:RICE:Well Milled:",
      source: "DA",
      name: "Well Milled",
      spec: "",
      tag: "rice",
      priceBasis: { amount: 1000, unit: "g" },
      purchaseUnit: { amount: 1000, unit: "g" },
      countUnit: null,
      countWeightG: null,
      price: { centavos: 4800, publishedOn: "2026-10-08", publicationTitle: "DA Oct 8" },
    },
  ],
};

const app = createApp({ recipes: noRecipes, catalog: { catalog: async () => catalog } });

const post = (body: unknown) =>
  app.request("/api/price", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/price", () => {
  it("prices the Draft, dropping unknown Recipes and ignoring stale line state", async () => {
    const res = await post({
      recipes: [
        { id: "sinangag", servings: 8 },
        { id: "gone", servings: 4 },
      ],
      lines: { stale: { haveIt: true } },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { lines: unknown[] };
    expect(body).toMatchObject({
      recipes: [{ id: "sinangag", name: "Sinangag", servings: 8 }],
      total: { centavos: 9600, counts: { priced: 1, haveIt: 0 } },
      droppedRecipeIds: ["gone"],
    });
    expect(body.lines).toHaveLength(1);
  });

  it.each([
    [
      "more than 20 Recipes",
      {
        recipes: Array.from({ length: 21 }, (_, i) => ({ id: `r${i}`, servings: 4 })),
        lines: {},
      },
    ],
    ["duplicate Recipe ids", { recipes: [1, 2].map(() => ({ id: "a", servings: 4 })), lines: {} }],
    ["servings of 0", { recipes: [{ id: "a", servings: 0 }], lines: {} }],
    ["servings of 21", { recipes: [{ id: "a", servings: 21 }], lines: {} }],
    ["fractional servings", { recipes: [{ id: "a", servings: 2.5 }], lines: {} }],
    [
      "more than 200 line states",
      {
        recipes: [],
        lines: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`k${i}`, {}])),
      },
    ],
    ["a negative Price Override", { recipes: [], lines: { rice: { overrideCentavos: -1 } } }],
    ["unknown line state fields", { recipes: [], lines: { rice: { colour: "red" } } }],
  ])("rejects %s with 400 invalid_input", async (_, body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_input" });
  });

  it("accepts exactly 20 Recipes and 200 line states", async () => {
    const res = await post({
      recipes: Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, servings: 20 })),
      lines: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, {}])),
    });

    expect(res.status).toBe(200);
  });
});
