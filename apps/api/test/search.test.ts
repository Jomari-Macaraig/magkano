import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import type { RecipeSearch, SearchResponse } from "../src/search/search.ts";
import { noCatalog, noRecipes } from "./stubs.ts";

const adobo = {
  id: "chicken-adobo",
  name: "Chicken Adobo",
  description: "Chicken braised in soy sauce, vinegar and garlic.",
  servings: 4,
};

/** An app whose search answers `response` and records each query. */
function appWith(response: SearchResponse) {
  const search = vi.fn<RecipeSearch["search"]>(async () => response);
  const app = createApp({
    recipes: noRecipes,
    catalog: noCatalog,
    search: { search },
  });
  return { app, search };
}

describe("GET /api/search", () => {
  it("answers the search's results and fallback flag", async () => {
    const { app, search } = appWith({ fallback: true, results: [adobo] });

    const res = await app.request("/api/search?q=adobo");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fallback: true, results: [adobo] });
    expect(search).toHaveBeenCalledWith("adobo");
  });

  it("treats a missing q as an empty query", async () => {
    const { app, search } = appWith({ fallback: false, results: [] });

    const res = await app.request("/api/search");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fallback: false, results: [] });
    expect(search).toHaveBeenCalledWith("");
  });

  it("rejects an overlong query with 400 invalid_input", async () => {
    const { app, search } = appWith({ fallback: false, results: [] });

    const res = await app.request(`/api/search?q=${"a".repeat(201)}`);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_input" });
    expect(search).not.toHaveBeenCalled();
  });
});
