// Local dev server. The web dev server proxies /api here.
import { serve } from "@hono/node-server";
import { buildApp } from "./build-app.ts";

const port = Number(process.env.API_PORT ?? 8787);
const app = buildApp(process.env);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/api`);
});
