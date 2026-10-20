import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { errorResponse } from "./errors";

/** Builds the API. Every route lives under `/api`. */
export function createApp() {
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
  return app.get("/health", (c) => c.json({ status: "ok" } as const, 200));
}

export type AppType = ReturnType<typeof createApp>;
