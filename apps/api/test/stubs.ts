// Empty dependencies for route tests that don't exercise them.
import type { CatalogStore } from "../src/pricing/catalog";
import type { RecipeStore } from "../src/recipes";
import type { RecipeSearch } from "../src/search/search";

export const noRecipes: RecipeStore = { list: async () => [], get: async () => null };

export const noCatalog: CatalogStore = {
  catalog: async () => ({ tags: [], recipes: [], commodities: [] }),
};

export const noSearch: RecipeSearch = {
  search: async () => ({ fallback: false, results: [] }),
};
