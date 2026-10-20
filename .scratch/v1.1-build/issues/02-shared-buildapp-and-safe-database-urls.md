# 02: Shared `buildApp` and safe database URLs

**What to build:** The API's wiring (DB client, Recipe store, cached Catalog, embedder, search with its text fallback) can be built from an env object, so the local server and a Vercel Function can share it. `migrate` and `seed` connect the way a Vercel build needs them to and can't silently write to the wrong database. Local development works exactly as before. Spec: "Shared wiring: `buildApp(env)`", "Database client and URLs", "Preview can't wipe production", "Migrations and seed in the build", "Testing Decisions".

**Blocked by:** 01 (`.ts` import extensions in the API).

**Status:** ready-for-agent

- [ ] `buildApp(env)` returns the Hono app, and throws a clear error when `DATABASE_URL` is unset. Without `OPENAI_API_KEY` it uses the text-fallback search and warns, as v1 does.
- [ ] The local server is a thin caller of `buildApp`, with today's pool settings (`max: 10`).
- [ ] `createDb` accepts pool options, defaulting to today's values.
- [ ] One pure helper picks `DATABASE_URL_UNPOOLED ?? DATABASE_URL`, fails clearly when both are unset, and formats a log line with `VERCEL_ENV` (or `local`) and the host only, never the password.
- [ ] `drizzle-kit migrate` and `seed` use that helper. Each prints its line before writing, and neither falls back to an empty URL.
- [ ] On Vercel (`VERCEL=1`), when `seed` embeds new Recipe chunks, it warns that the vectors are discarded and that `embeddings.json` should be committed after a local `pnpm seed`.
- [ ] Unit tests cover:
  - the URL helper: prefers unpooled, falls back to pooled, fails when both are unset, and the log line never contains the password;
  - `buildApp`: `GET /api/health` answers 200, a missing `DATABASE_URL` throws, and no key gives the text fallback.
- [ ] The API docs describe `buildApp`, the `.ts` import rule, the unpooled URL and the add-only migrations rule.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass, and `pnpm dev`, `pnpm db:migrate` and `pnpm seed` work locally with an unchanged `.env`.
