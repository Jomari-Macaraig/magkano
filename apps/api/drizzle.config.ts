import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { writeTarget } from "./src/db/url.ts";

// Root .env for local runs; variables already set win.
const rootEnv = new URL("../../.env", import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Throws rather than run against an empty URL. The task is drizzle-kit's command, e.g. migrate.
const target = writeTarget(process.argv[2] ?? "drizzle-kit", process.env);
console.log(target.logLine);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dbCredentials: { url: target.url },
});
