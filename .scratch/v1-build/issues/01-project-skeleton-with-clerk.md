# 01: Project skeleton with Clerk sign-in

**What to build:** A runnable empty Magkano. A developer can start the local database and both apps with one command, and a visitor can sign up, sign in and sign out from the header. Nothing in the app is gated behind an account. This sets up the workspace, schema and tooling every later ticket builds on. Spec: [../../v1/spec.md](../../v1/spec.md), sections "Stack and layout", "Data model" and "Frontend → Header".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] pnpm workspace with two apps: the web SPA (Vite + React + TypeScript + React Router) and the API (Hono + TypeScript).
- [ ] Local Postgres from a Docker pgvector image. The first migration enables the `vector` extension.
- [ ] Drizzle schema and migrations create all 9 tables from the spec:
  - Recipe ids are text;
  - `commodities.key` is unique;
  - `price_observations` is keyed by (commodity, publication);
  - `recipe_chunks` has a `vector(1536)` column with an HNSW cosine index.
- [ ] The Hono app serves `/api/*` with a health route and the `{ error, message }` error shape (400 `invalid_input`, 404 `not_found`, 500 `internal`).
- [ ] Hono RPC types are exported for the web app, which proxies `/api` in dev so everything is on one origin.
- [ ] The web app is wrapped in Clerk:
  - Sign in and Sign up buttons when signed out;
  - the user menu with sign out when signed in;
  - the publishable key comes from env.
- [ ] `.env.example` lists `DATABASE_URL`, `OPENAI_API_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`. `.env` is gitignored.
- [ ] Root scripts for dev, typecheck, Biome lint/format and Vitest all pass.
- [ ] Root and per-app `CLAUDE.md` describe how to run it locally.
