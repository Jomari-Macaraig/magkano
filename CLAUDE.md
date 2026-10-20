# magkano

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Local development

Needs Node 22+, pnpm 10 and Docker.

1. `cp .env.example .env`, then set `VITE_CLERK_PUBLISHABLE_KEY` (a Clerk development instance). `OPENAI_API_KEY` is optional.
2. `pnpm install`
3. `pnpm dev`: starts Postgres (Docker, port **5435**), applies migrations, then runs the API on :8787 and the web app on :5173. Open http://localhost:5173.

Root scripts: `pnpm typecheck`, `pnpm lint` / `pnpm format` (Biome), `pnpm test` (Vitest, all apps), `pnpm db:up` / `db:down`, `pnpm db:generate` / `db:migrate`.

- pnpm workspace with two apps; workspace packages export TypeScript source directly (no build step).
- The compose project is named `magkano-local`, so it never shares a container or volume with other Postgres containers on the machine.

## Subsystem Documentation

- [apps/api/CLAUDE.md](apps/api/CLAUDE.md): Hono app, `{ error, message }` error shape, zod validation, Drizzle schema (9 tables) and migrations, Hono RPC types
- [apps/web/CLAUDE.md](apps/web/CLAUDE.md): Vite + React SPA, Clerk header, React Router, typed API client and the `/api` dev proxy
