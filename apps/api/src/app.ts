import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { errorResponse } from "./errors";
import type { RecipeStore } from "./recipes";
import { validate } from "./validate";

/** What the routes read from. */
export type AppDeps = { recipes: RecipeStore };

/** Builds the API. Every route lives under `/api`. */
export function createApp(deps: AppDeps) {
  const app = new Hono().basePath("/api");

  app.notFound((c) =>
    errorResponse(c, 404, "not_found", `No route for ${c.req.method} ${c.req.path}`),
  );
  app.onError((err, c) => {
    // Hono's own 4xx (e.g. a malformed JSON body) is bad input, not a server fault.
    if (err instanceof HTTPException && err.status >= 400 && err.status < 500) {
      return errorResponse(c, 400, "invalid_input", err.message);
    }
    console.error(err);
    return errorResponse(c, 500, "internal", "Something went wrong");
  });

  // Chained so `AppType` carries every route for Hono RPC.
  return app
    .get("/health", (c) => c.json({ status: "ok" } as const, 200))
    .get("/recipes", async (c) => c.json(await deps.recipes.list(), 200))
    .get("/recipes/:id", validate("param", z.object({ id: z.string().min(1) })), async (c) => {
      const { id } = c.req.valid("param");
      const recipe = await deps.recipes.get(id);
      if (!recipe) return errorResponse(c, 404, "not_found", `No Recipe "${id}"`);
      return c.json(recipe, 200);
    });
}

export type AppType = ReturnType<typeof createApp>;
