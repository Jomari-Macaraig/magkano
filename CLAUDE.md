# magkano

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Deployment

Production runs on `https://magkano.online` (Vercel + Neon + Clerk), with a preview deployment per pull request. See [deploy/CLAUDE.md](deploy/CLAUDE.md).

## Local development

Needs Node 22+, pnpm 10 and Docker.

1. `cp .env.example .env`, then set `VITE_CLERK_PUBLISHABLE_KEY` (a Clerk development instance). `OPENAI_API_KEY` is optional.
2. `pnpm install`
3. `pnpm dev`: starts Postgres (Docker, port **5435**), applies migrations, then runs the API on :8787 and the web app on :5173. Open http://localhost:5173.
4. `pnpm seed` (once, and after any data file changes): loads the committed data files into Postgres.

Root scripts: `pnpm extract <pdf>`, `pnpm tag [--check]`, `pnpm seed`, `pnpm typecheck`, `pnpm lint` / `pnpm format` (Biome), `pnpm test` (Vitest, all apps), `pnpm db:up` / `db:down`, `pnpm db:generate` / `db:migrate`.

- pnpm workspace with two apps; workspace packages export TypeScript source directly (no build step).
- The compose project is named `magkano-local`, so it never shares a container or volume with other Postgres containers on the machine.

## Subsystem Documentation

- [apps/api/CLAUDE.md](apps/api/CLAUDE.md): Hono app, `buildApp(env)` shared wiring, `.ts` relative imports, the migrate/seed database URLs and add-only migrations, `{ error, message }` error shape, zod validation, Drizzle schema (9 tables) and migrations, Hono RPC types, the Recipe routes
- [apps/api/src/extract/CLAUDE.md](apps/api/src/extract/CLAUDE.md): `pnpm extract <pdf>`, DA/DTI PDF parsers, filters, Publication JSON files under `apps/api/data/publications/`
- [apps/api/src/tagging/CLAUDE.md](apps/api/src/tagging/CLAUDE.md): `pnpm tag`, the reviewed `tag-assignments.json`, the Tag vocabulary and Seeded Recipes data files, the stubbable OpenAI tagging client
- [apps/api/src/pricing/CLAUDE.md](apps/api/src/pricing/CLAUDE.md): `POST /api/price`, the pure `priceDraft` function (matching, conversions, Purchase Units, line state), the cached Postgres Catalog
- [apps/api/src/seed/CLAUDE.md](apps/api/src/seed/CLAUDE.md): `pnpm seed`, its checks (all problems listed, nothing written on failure), the one-transaction wipe and reload, Recipe chunk embeddings
- [apps/api/src/search/CLAUDE.md](apps/api/src/search/CLAUDE.md): `GET /api/search`, chunk text, query expansion, scoring, the text fallback, the `embeddings.json` cache
- [apps/web/CLAUDE.md](apps/web/CLAUDE.md): Vite + React SPA, Clerk header, React Router, typed API client and the `/api` dev proxy, home with search, Recipe page, the Draft (`localStorage`, debounced re-pricing), the Grocery List screen and the line page (pick a match, Price Override)
- [deploy/CLAUDE.md](deploy/CLAUDE.md): deployment (one Vercel project: `vercel.json`, the `api/index.ts` Function in `sin1`, the build steps, the env var matrix, the preview-can't-wipe-production rule, add-only migrations, the fallbacks) and `deploy/setup.sh`, the owner setup wizard (OpenAI, GitHub, Neon, Vercel, Clerk, GoDaddy), resuming with `--from N`, its `dig`/`curl`/`vercel`/`gh` checks, the no-secrets rule
