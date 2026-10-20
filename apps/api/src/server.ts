// Local dev server. The web dev server proxies /api here.
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDb } from "./db/client";
import { createCatalogStore } from "./pricing/store";
import { createRecipeStore } from "./recipes";

const port = Number(process.env.API_PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set (see .env.example)");
const db = createDb(databaseUrl);

serve(
  {
    fetch: createApp({ recipes: createRecipeStore(db), catalog: createCatalogStore(db) }).fetch,
    port,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}/api`);
  },
);
