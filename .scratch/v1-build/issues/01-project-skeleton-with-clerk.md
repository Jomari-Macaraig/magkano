# 01: Project skeleton with Clerk sign-in

**What to build:** A runnable empty Magkano. A developer can start the local database and both apps with one command, and a visitor can sign up, sign in and sign out from the header. Nothing in the app is gated behind an account. This sets up the workspace, schema and tooling every later ticket builds on. Spec: [../../v1/spec.md](../../v1/spec.md), sections "Stack and layout", "Data model" and "Frontend → Header".

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] pnpm workspace with two apps: the web SPA (Vite + React + TypeScript + React Router) and the API (Hono + TypeScript).
- [x] Local Postgres from a Docker pgvector image. The first migration enables the `vector` extension.
- [x] Drizzle schema and migrations create all 9 tables from the spec:
  - Recipe ids are text;
  - `commodities.key` is unique;
  - `price_observations` is keyed by (commodity, publication);
  - `recipe_chunks` has a `vector(1536)` column with an HNSW cosine index.
- [x] The Hono app serves `/api/*` with a health route and the `{ error, message }` error shape (400 `invalid_input`, 404 `not_found`, 500 `internal`).
- [x] Hono RPC types are exported for the web app, which proxies `/api` in dev so everything is on one origin.
- [x] The web app is wrapped in Clerk:
  - Sign in and Sign up buttons when signed out;
  - the user menu with sign out when signed in;
  - the publishable key comes from env.
- [x] `.env.example` lists `DATABASE_URL`, `OPENAI_API_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`. `.env` is gitignored.
- [x] Root scripts for dev, typecheck, Biome lint/format and Vitest all pass.
- [x] Root and per-app `CLAUDE.md` describe how to run it locally.

## Comments

Done. Notes for later tickets:
- Postgres runs on port 5435 under the compose project `magkano-local`, so it stays apart from other local Postgres containers.
- Clerk is `@clerk/react` v6, which uses `<Show when="signed-in" | "signed-out">` in place of `SignedIn`/`SignedOut`.
- API tests call `createApp().request(...)` and need no database. Hono's 4xx errors, such as malformed JSON, answer 400 `invalid_input`.
- Sign-in has not been tried in a browser yet: it needs a real `VITE_CLERK_PUBLISHABLE_KEY` in `.env`.
