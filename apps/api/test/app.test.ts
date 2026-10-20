import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../src/app";
import { validate } from "../src/validate";

/** These tests read no data, so the store is empty. */
const createTestApp = () =>
  createApp({
    recipes: { list: async () => [], get: async () => null },
    search: { search: async () => ({ fallback: false, results: [] }) },
  });

describe("API skeleton", () => {
  const app = createTestApp();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers GET /api/health with ok", async () => {
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("answers an unknown route with 404 not_found", async () => {
    const res = await app.request("/api/nope");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found", message: "No route for GET /api/nope" });
  });

  it("answers an unexpected error with 500 internal, without leaking its message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = createTestApp().get("/boom", () => {
      throw new Error("secret detail");
    });

    const res = await failing.request("/api/boom");

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal", message: "Something went wrong" });
  });

  describe("zod validation", () => {
    // A stand-in route: real routes use the same `validate` middleware.
    const withRoute = createTestApp().get(
      "/servings",
      validate("query", z.object({ servings: z.coerce.number().int().min(1).max(20) })),
      (c) => c.json({ servings: c.req.valid("query").servings }),
    );

    it("passes valid input through", async () => {
      const res = await withRoute.request("/api/servings?servings=4");

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ servings: 4 });
    });

    it("rejects a malformed JSON body with 400 invalid_input", async () => {
      const withBody = createTestApp().post(
        "/echo",
        validate("json", z.object({ servings: z.number() })),
        (c) => c.json(c.req.valid("json")),
      );

      const res = await withBody.request("/api/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_input", message: expect.any(String) });
    });

    it("rejects invalid input with 400 invalid_input naming the field", async () => {
      const res = await withRoute.request("/api/servings?servings=21");

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "invalid_input",
        message: expect.stringMatching(/^servings: /),
      });
    });
  });
});
