import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { CatalogStore } from "../src/pricing/catalog";
import type { RecipeDetail, RecipeStore } from "../src/recipes";

const adobo: RecipeDetail = {
  id: "chicken-adobo",
  name: "Chicken Adobo",
  description: "Chicken braised in soy sauce, vinegar and garlic.",
  servings: 4,
  ingredients: [
    {
      name: "manok",
      quantity: 1,
      unit: "kg",
      prepNote: "cut into serving pieces",
      optional: false,
    },
    { name: "asukal", quantity: 1, unit: "tbsp", prepNote: null, optional: true },
  ],
};

const store: RecipeStore = {
  list: async () => [
    { id: "chicken-adobo", name: "Chicken Adobo", description: adobo.description, servings: 4 },
  ],
  get: async (id) => (id === adobo.id ? adobo : null),
};

const noCatalog: CatalogStore = {
  catalog: async () => ({ tags: [], recipes: [], commodities: [] }),
};

describe("Recipe routes", () => {
  const app = createApp({ recipes: store, catalog: noCatalog });

  it("GET /api/recipes answers the Recipe cards", async () => {
    const res = await app.request("/api/recipes");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: "chicken-adobo",
        name: "Chicken Adobo",
        description: "Chicken braised in soy sauce, vinegar and garlic.",
        servings: 4,
      },
    ]);
  });

  it("GET /api/recipes/:id answers the Recipe with its Ingredients and no prices", async () => {
    const res = await app.request("/api/recipes/chicken-adobo");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(adobo);
  });

  it("GET /api/recipes/:id answers 404 not_found for an unknown id", async () => {
    const res = await app.request("/api/recipes/no-such-recipe");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: "not_found",
      message: 'No Recipe "no-such-recipe"',
    });
  });
});
