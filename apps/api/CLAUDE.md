# apps/api

Hono + TypeScript API. Holds the Drizzle schema and migrations, the domain logic, the scripts under `scripts/` (`extract`, `tag`, `seed`) and `data/` (hand-edited `tags.ts` and `recipes.ts`, script-written JSON including `embeddings.json`, which Biome skips).

## Data flow

The committed files under `data/` are the dataset; Postgres is a copy that `seed` wipes and rebuilds. Routes only read from Postgres. The web app reaches routes through Hono RPC types (`AppType`), never by importing server code.

## Imports

Every relative import in this workspace ends in `.ts` (`import { createApp } from "./app.ts"`). On Vercel the classic Node builder compiles each file separately and doesn't bundle, so an extensionless import fails at runtime. Biome's `useImportExtensions` enforces this (an error everywhere except `apps/web`, which Vite bundles, so it also covers root files such as a Vercel Function entry), and `pnpm format` adds a missing extension.

## Run

- `pnpm --filter @magkano/api dev`: `tsx watch` on `src/server.ts`, port `API_PORT` (default 8787), reading the root `.env`.
- `pnpm db:generate` after editing `src/db/schema.ts`; `pnpm db:migrate` to apply. Both read the root `.env`; see [Database URLs](#database-urls).
- `pnpm --filter @magkano/api extract <pdf>`: writes `data/publications/<da|dti>-<date>.json`. See [src/extract/CLAUDE.md](src/extract/CLAUDE.md).
- `pnpm --filter @magkano/api seed`: checks every data file, then wipes and reloads the database. See [src/seed/CLAUDE.md](src/seed/CLAUDE.md).
- `pnpm --filter @magkano/api tag`: proposes Tag Assignments for new or renamed items into `data/tag-assignments.json` (committed, fully reviewed). `--check` was for the first review only. See [src/tagging/CLAUDE.md](src/tagging/CLAUDE.md).
- Tests: `pnpm vitest run --project api`. `test/build-app.test.ts` builds the real wiring with an unreachable `DATABASE_URL` (postgres.js connects lazily) and a fake `searchSource`. Route tests call `createApp({ recipes: stub, catalog: stub, search: stub }).request(...)`; extract tests read `sample/`; tagging and search tests stub the OpenAI client; seed tests use a spy writer; `test/seed-plan.ts` gives tests the plan built from the real data. None need a database or the network.

## Key files

- `src/app.ts`: `createApp({ recipes, catalog, search })` builds the Hono app under `/api`. Routes are **chained** so `AppType` carries them all for Hono RPC; add new routes the same way (`.route(...)` / `.get(...)`).
- Routes so far: `GET /api/health`; `GET /api/recipes` (cards `{ id, name, description, servings }`, sorted by name); `GET /api/recipes/:id` (the card plus `ingredients: { name, quantity, unit, prepNote, optional }[]` in order, no prices; 404 `not_found` if unknown); `GET /api/search?q=` (`{ fallback, results: card[≤8] }`; a missing or empty `q` gives no results; `q` over 200 characters is 400 `invalid_input`). See [src/search/CLAUDE.md](src/search/CLAUDE.md). `POST /api/price` (prices a Draft; see [src/pricing/CLAUDE.md](src/pricing/CLAUDE.md)).
- `src/recipes.ts`: the `RecipeStore` interface routes read through, and `createRecipeStore(db)`, its Drizzle implementation.
- `src/search/`: the `RecipeSearch` the search route reads through (embeddings with a text fallback), and the chunk vectors `seed` builds. See [src/search/CLAUDE.md](src/search/CLAUDE.md).
- `src/errors.ts`: every error is `{ error, message }`. Codes: 400 `invalid_input`, 404 `not_found` (also unknown routes), 500 `internal` (any thrown error; logged, message hidden). Hono's own 4xx errors, such as a malformed JSON body, also map to 400 `invalid_input`.
- `src/validate.ts`: `validate(target, zodSchema)` middleware. Use it on every input; a failure answers 400 `invalid_input` with `path: message` pairs.
- `src/index.ts`: type-only exports for the web app (`AppType`, `ErrorBody`, and the price request/response types such as `PriceRequest`, `PriceResponse`, `PricedLine`).
- `src/build-app.ts`: `buildApp(env, { db?, searchSource? })` is the shared wiring: the DB client (`db` = pool options), the Recipe store, the cached Catalog, and the search (OpenAI query embeddings only when `OPENAI_API_KEY` is set; otherwise text matching, with a warning). It returns the `createApp` app and throws without `DATABASE_URL`. `searchSource` replaces the search's Postgres reads, for tests only.
- `src/server.ts`: local Node server, a thin caller: `buildApp(process.env)` (the default pool, `max: 10`) served by `@hono/node-server`. A Vercel Function entry calls `buildApp` the same way with its own pool options.
- `src/db/schema.ts`: the 9 tables. Recipe ids are text (the seed key); other ids are integer identity, and nothing on the device may store them. `recipe_chunks.embedding` is `vector(1536)` with an HNSW cosine index.
- `src/db/client.ts`: `createDb(url, options?)` returns a Drizzle client with `close()`. `options` (`max`, `idle_timeout`, `connect_timeout`) override the defaults `{ max: 10, connect_timeout: 5 }`.
- `src/db/url.ts`: `writeTarget(task, env)` returns a `WriteTarget` (`url`, `logLine`): it picks the URL `migrate` and `seed` write to, and their log line. See [Database URLs](#database-urls).
- `migrations/`: `0000` is a custom migration enabling `vector`; later ones are generated by drizzle-kit. **Migrations are add-only** (new tables, new nullable or defaulted columns, new indexes): a deploy migrates before the new version goes live, so the running one must keep working on the migrated schema. A destructive change takes two deploys: stop using the column or table, then drop it.

## Database URLs

- The API (`buildApp`) reads `DATABASE_URL`, the pooled URL on Neon.
- `drizzle-kit` (`drizzle.config.ts`) and `seed` use `writeTarget`: `DATABASE_URL_UNPOOLED` (Neon's direct URL) if set, else `DATABASE_URL`, so a local `.env` needs nothing new. Empty counts as unset. With neither, they fail; they never fall back to an empty URL.
- Before writing, each prints one line naming `VERCEL_ENV` (or `local`) and the host only, never the password: `migrate: env=preview host=ep-xyz.ap-southeast-1.aws.neon.tech`. drizzle-kit's line is labelled with its command (`generate`, `migrate`).
- On Vercel (`VERCEL=1`), when `seed` embeds new Recipe chunks it warns that the rewritten `data/embeddings.json` is discarded: run `pnpm seed` locally and commit it.

## Env

- `DATABASE_URL` (required for the API server; migrations and `seed` use it when `DATABASE_URL_UNPOOLED` is unset).
- `DATABASE_URL_UNPOOLED` (Neon only, not set locally; preferred by migrations and `seed`).
- `VERCEL`, `VERCEL_ENV` (set by Vercel; the `migrate`/`seed` log line and `seed`'s embeddings warning).
- `OPENAI_API_KEY` (optional; without it search falls back to text matching; `seed` needs it only when a Recipe chunk's text isn't in `data/embeddings.json`, and `tag` only when an item has no Tag Assignment).
- `API_PORT` (optional, default 8787).

No Clerk on the server in v1: every route is anonymous.
