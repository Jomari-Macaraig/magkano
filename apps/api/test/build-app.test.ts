import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/build-app.ts";
import type { RecipeSearchDeps } from "../src/search/search.ts";

// postgres.js connects lazily, so nothing below reaches this database.
const env = { DATABASE_URL: "postgres://magkano:magkano@localhost:1/none" };

const adobo = {
  id: "adobong-manok",
  name: "Adobong Manok",
  description: "Chicken braised in vinegar and soy sauce.",
  servings: 4,
};

/** The search's database reads, faked with one Recipe and never-called similarities. */
const searchSource: Pick<RecipeSearchDeps, "loadIndex" | "similarities"> = {
  loadIndex: async () => ({
    tags: [],
    recipes: [{ ...adobo, ingredients: [{ name: "chicken", tag: null }] }],
  }),
  similarities: async () => {
    throw new Error("no embeddings without a key");
  },
};

describe("buildApp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers GET /api/health", async () => {
    const res = await buildApp({ ...env, OPENAI_API_KEY: "sk-test" }).request("/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("throws a clear error without DATABASE_URL", () => {
    expect(() => buildApp({})).toThrow("DATABASE_URL is not set (see .env.example)");
    expect(() => buildApp({ DATABASE_URL: "" })).toThrow("DATABASE_URL is not set");
  });

  it("searches by text, and warns, without OPENAI_API_KEY", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const app = buildApp(env, { searchSource: () => searchSource });

    const res = await app.request("/api/search?q=adobo");

    expect(await res.json()).toEqual({ fallback: true, results: [adobo] });
    expect(warn).toHaveBeenCalledWith(
      "OPENAI_API_KEY is not set: search uses basic text matching.",
    );
  });
});
