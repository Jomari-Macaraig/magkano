# Magkano v1.1 (deployment)

Status: ready-for-agent

Synthesised from [map.md](map.md) and its resolved tickets under [issues/](issues/). Domain terms follow `GLOSSARY.md`. The v1 spec ([../v1/spec.md](../v1/spec.md)) still stands; this spec changes only how the app is built, configured and served. **Build budget: about 1 hour of agent build time from this spec, without lowering quality.** The owner's account setup (the `deploy/setup.sh` wizard) is separate and doesn't count toward that hour.

## Problem Statement

v1 only runs on a developer's machine: Docker Postgres, a Clerk development instance and a `.env` file. Nobody else can use it, and a change can't be checked anywhere except locally before it is merged.

## Solution

Magkano runs online on one Vercel project:
- **Production** on `magkano.online`: public, using Neon's `main` database branch and a Clerk production instance.
- **A preview deployment for every pull request**, each with its own Neon database branch and the Clerk development instance.

Each Vercel build runs the checks (lint, typecheck, tests), then migrations, then `seed`, then the web build, and any failure stops the deploy. Merging to `main` deploys production, including any data change. Local development is unchanged.

The SPA is served as static files. The Hono API runs as one Node Vercel Function in `sin1` (Singapore) under `/api/*`, on the same origin, so CORS isn't needed. Neon Postgres (with pgvector) runs in `aws-ap-southeast-1`, the same region.

## User Stories

### Using the app online

1. As a shopper, I want to open `https://magkano.online` and use everything v1 offers (search, Recipes, the Draft, the Grocery List, sign-in) without installing anything, so that I can plan groceries from my phone.
2. As a shopper, I want `www.magkano.online` and `http://` to redirect to `https://magkano.online`, so that every address I type works.
3. As a shopper, I want a deep link such as `https://magkano.online/recipes/sinigang-na-baboy` to open that page directly, including after a refresh, so that I can share and bookmark pages.
4. As a shopper, I want to sign up and sign in with my email on `magkano.online`, so that I have an account ready for saved lists later.
5. As a shopper, I want search to keep working with basic text matching if the AI service fails, as in v1, so that the app stays usable.

### Previews (developer)

6. As a developer, I want every push to a pull request to build a preview deployment with its own URL, so that I can try a change before merging it.
7. As a developer, I want each preview to have its own database, branched from production's and migrated and seeded by its build, so that a preview never touches production data.
8. As a developer, I want the pushes to one pull request to reuse one database branch, and the branch to be deleted after the pull request's Git branch is deleted, so that the Neon Free plan's 10-branch cap isn't hit.
9. As a developer, I want a preview to use the Clerk development instance, so that I can sign in on a `*.vercel.app` URL.
10. As a developer, I want a failing lint, typecheck, test, migration or `seed` to fail the build, so that a broken change never goes live.

### Production releases (project owner)

11. As the project owner, I want merging to `main` to deploy production, run migrations and re-seed from the committed data files, so that a data change goes live without a manual step.
12. As the project owner, I want a failed production build to leave the previous deployment serving, so that a bad merge doesn't take the site down.
13. As the project owner, I want the build log to show which Vercel environment and which database host `migrate` and `seed` are writing to, so that I can see a build is writing to the right database.
14. As the project owner, I want production's database credentials to exist only in Vercel's Production environment, so that a preview build can't wipe production.

### Setup (project owner)

15. As the project owner, I want an interactive wizard (`deploy/setup.sh`) that walks me through OpenAI, GitHub, Neon, Vercel, Clerk and GoDaddy in the right order, and checks what it can, so that I can set up the accounts once without missing a step.
16. As the project owner, I want the OpenAI key to belong to a project with a spend limit, so that a public, unthrottled app can't run up a large bill.
17. As the project owner, I want no secrets in the repo, so that the public code never leaks a credential.

### Local development (developer)

18. As a developer, I want `pnpm dev`, `pnpm seed`, `pnpm db:migrate` and `.env` to work exactly as they do in v1, so that deployment costs me nothing locally.

## Implementation Decisions

### Function build and layout

- **One Vercel project at the repo root**, Framework Preset **Vite**, output directory `apps/web/dist`, install command left as the default (pnpm, detected from `packageManager`). Plan: **Hobby** (non-commercial).
- **Function entry `api/index.ts` at the repo root.** Its default export is the Hono app from `buildApp(process.env)`, which Vercel's Node runtime serves through its `fetch` method. It imports only from `apps/api/src`, so the root package gains no runtime dependencies. Only what it imports gets bundled; `pdfjs-dist`, `drizzle-kit` and the scripts stay out.
- **Relative imports in `apps/api` end in `.ts`.** The classic Node builder compiles each file separately and doesn't bundle, so an extensionless import fails at runtime. That means 141 imports today, across `src`, `scripts`, `test` and the root config files.
  - `tsconfig.base.json`: add `"allowImportingTsExtensions": true` (it already has `noEmit`).
  - `biome.json`: turn on `correctness/useImportExtensions` as an error, so new imports can't regress. Its autofix can do the bulk rewrite.
  - `apps/web` imports `@magkano/api` as type-only and is unaffected. Its own imports stay as they are, since Vite bundles them.
- **Typecheck covers `api/`**: add a root `tsconfig.json` (extends `tsconfig.base.json`, `include: ["api"]`). The root `typecheck` script becomes `pnpm -r typecheck && tsc --noEmit -p .`. Biome already lints the root.
- **Node**: root `package.json` `"engines": { "node": "22.x" }`, which Vercel reads. Locally this only pins the major version.
- **Fallback** if the first deploy shows the classic builder can't load the Function: switch to Vercel Services (Beta), which bundles with rolldown. Keep the `.ts` extensions either way.

### `vercel.json` (repo root)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm lint && pnpm typecheck && pnpm test && pnpm db:migrate && pnpm seed && pnpm --filter @magkano/web build",
  "outputDirectory": "apps/web/dist",
  "regions": ["sin1"],
  "functions": { "api/index.ts": { "maxDuration": 30 } },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- Order matters: the `/api` rewrite comes first. Filesystem assets (`/assets/*`) are served before the rewrites apply.
- Hono keeps `basePath("/api")` and must see the original `/api/...` path after the rewrite (acceptance check). **Fallback**: if it sees `/api` for every request, change the destination to `/api?path=$1` or use `api/[[...route]].ts`, and confirm with `GET /api/health` and `GET /api/recipes/<id>`.
- `www` → apex and HTTP → HTTPS redirects are domain settings in Vercel, not rewrites.

### Shared wiring: `buildApp(env)`

- A new `apps/api/src/build-app.ts` takes over `server.ts`'s setup: the DB client, the Recipe store, the cached Catalog, the OpenAI embedder and `createRecipeSearch` with the no-key text fallback and its warning. It returns the Hono app from `createApp`.
- It takes an env object (`DATABASE_URL`, `OPENAI_API_KEY`) and DB pool options, and throws a clear error when `DATABASE_URL` is unset.
- `server.ts` (local, `@hono/node-server`, `max: 10`) and `api/index.ts` (Vercel) are thin callers.
- The Catalog keeps its one-minute in-memory TTL. A warm Function instance can serve the old Catalog for up to a minute after a deploy's seed. That's accepted, and it matches v1 locally.

### Database client and URLs

- **Driver**: keep postgres.js. `createDb(url, options?)` passes pool options through, defaulting to today's `{ max: 10, connect_timeout: 5 }`.
- **Function**: one module-scope client on the pooled `DATABASE_URL` with `{ max: 5, idle_timeout: 5, connect_timeout: 10 }`, created once per instance when `api/index.ts` loads. `prepare` stays at its default.
- **`drizzle-kit migrate` and `seed`** use `DATABASE_URL_UNPOOLED ?? DATABASE_URL`, so local needs nothing new. Both **fail with a clear message** when neither is set. `drizzle.config.ts` must throw rather than fall back to `""`.
- Both print one line before writing: `VERCEL_ENV` (or `local`) and the target **host only**, never the full URL or its password. Example: `migrate: env=preview host=ep-xyz-pooler.ap-southeast-1.aws.neon.tech`.
- One small pure helper (for example `apps/api/src/db/url.ts`) picks the URL and formats that line. `drizzle.config.ts` and `scripts/seed.ts` both use it.
- **Fallbacks** if a preview misbehaves (connection errors, prepared-statement errors through the pooler): first `prepare: false`, then `pg` with Vercel's `attachDatabasePool` for the Function only.

### Preview can't wipe production

- Production's `DATABASE_URL` and `DATABASE_URL_UNPOOLED` live only in Vercel's **Production** environment. Preview has no database vars of its own. A preview gets its URL only from the Neon-Managed integration's per-deployment branch injection.
- If that injection is missing, `migrate` and `seed` find no URL and fail the build. They never fall back to anything else.
- There's no host-allowlist check. The env scoping plus the printed host line are the guard.

### Migrations and seed in the build

- **Migrations are add-only** (new tables, new nullable or defaulted columns, new indexes). Migrate runs before the new deployment goes live, so the running one must keep working on the migrated schema. A destructive change needs two deploys: stop using the column or table first, then drop it. Write this rule in `apps/api/CLAUDE.md`.
- `seed` runs on every build, production included: the existing one-transaction wipe and reload. Its `TRUNCATE` blocks live requests for a few seconds. That's accepted.
- **New embeddings in the build**: when Recipe chunks are missing from `data/embeddings.json`, `seed` embeds them with `OPENAI_API_KEY` as it does locally. Vercel throws away the file it writes, so on Vercel (`VERCEL=1`) seed also prints a warning: run `pnpm seed` locally and commit `apps/api/data/embeddings.json`. The cost is well under a cent per deploy.
- The first production deploy migrates and seeds an empty Neon `main`. pgvector comes from the existing `0000_enable-pgvector.sql` migration.

### Web build

- `apps/web/vite.config.ts` throws on `vite build` (`command === "build"`) when `VITE_CLERK_PUBLISHABLE_KEY` is unset, so a missing key fails the deploy instead of shipping a blank page. `vite dev` keeps today's behaviour.
- `envDir` stays `../..`. On Vercel, `loadEnv` also reads `process.env`, so the per-environment key gets baked in at build time.
- The `/api` dev proxy is unused in production because everything is on one origin.

### Env var matrix

| Variable | Local (`.env`) | Preview (Vercel) | Production (Vercel) | Read by |
|---|---|---|---|---|
| `DATABASE_URL` | Docker, `localhost:5435` | injected per deployment by Neon (pooled, branch `preview/<git-branch>`) | Neon `main`, pooled (Production only) | Function; migrate and seed fallback |
| `DATABASE_URL_UNPOOLED` | not set | injected per deployment by Neon (direct) | Neon `main`, direct (Production only) | migrate, seed |
| `OPENAI_API_KEY` | optional | set (same project key) | set | Function (query embeddings); seed (new chunks only) |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_…` | `pk_test_…` (dev instance) | `pk_live_…` (production instance) | web build (baked in) |
| `API_PORT` | optional, `8787` | not set | not set | local `server.ts`, Vite proxy |
| `VERCEL`, `VERCEL_ENV` | not set | set by Vercel | set by Vercel | migrate and seed log line; seed's embeddings warning |

- The Neon-Managed integration is connected to **Production and Preview, not Development**. The integration writes production's vars. The wizard confirms Preview has no `DATABASE_URL*` of its own.
- The integration may also add other `PG*` / `POSTGRES_*` vars. The app ignores them.
- `.env.example` gains a commented `DATABASE_URL_UNPOOLED` line explaining it's only for Neon.
- No secret is committed. Clerk is frontend-only, so there's no Clerk secret key anywhere.

### Domain, DNS and Clerk production

- **Canonical**: `magkano.online` (bare domain). `www.magkano.online` redirects to it (a Vercel domain setting).
- **DNS stays at GoDaddy**, which doesn't proxy. Replace GoDaddy's parked apex A record with Vercel's A record, and the default `www` CNAME with Vercel's. Turn off GoDaddy domain forwarding.
- **Clerk production instance**: email sign-in only, as on the dev instance. Its domain is `magkano.online`, and Allowed Subdomains is `www.magkano.online`. Add the Dashboard's CNAMEs (`clerk.`, `accounts.`, `clkmail.`) and DKIM records at GoDaddy, then deploy certificates.
- No CAA records, no `*` wildcard record, no proxying.
- Clerk DNS can take up to 48 hours, so the wizard does it before the Vercel domain.
- Google sign-in can be added later in the Clerk Dashboard with the owner's own OAuth app, with no code change.

### Neon and the integration

- A separate Neon account on the **Free** plan. Project `magkano` in `aws-ap-southeast-1` (permanent). Postgres 17, matching local `pgvector/pgvector:pg17`.
- The **Neon-Managed** Vercel integration creates a `preview/<git-branch>` branch from `main` by webhook when a preview deployment starts.
- Turn on its automatic cleanup of obsolete branches. Neon deletes a preview branch once its Git branch is gone, at the next preview deploy. GitHub's "Automatically delete head branches" makes that happen on merge.
- Free-plan limits that matter: 10 branches, 1 GB storage, 100 CU-hours, and compute that suspends after 5 idle minutes and wakes in a few hundred ms. All are fine at this size.

### Owner setup wizard: `deploy/setup.sh`

An interactive bash wizard, generated with the `wizard` skill. It prints each step, pauses for the owner, and checks what it can from the terminal: `vercel` CLI env listing if installed, `dig` for DNS, `curl` for the live URLs. It never writes secrets to disk. Its steps, in order:

1. **OpenAI**: create a project `magkano` with a monthly spend limit and create its API key.
2. **GitHub**: turn on Settings → General → "Automatically delete head branches".
3. **Neon**: create an account, then a project `magkano` in AWS `ap-southeast-1` (Singapore).
4. **Vercel**: import the GitHub repo on Hobby with root directory = repo root. Framework, build and output come from `vercel.json`. Don't deploy yet, or let the first deploy fail.
5. **Neon-Managed integration**: connect it to the Neon project for **Production and Preview** (not Development) and turn on automatic branch cleanup. Then confirm in Vercel → Settings → Environment Variables that Preview has no `DATABASE_URL*` of its own.
6. **Vercel env**: `OPENAI_API_KEY` in Production and Preview. `VITE_CLERK_PUBLISHABLE_KEY`: `pk_test_…` in Preview, `pk_live_…` in Production (the production key comes from step 7, so this step can be finished after it).
7. **Clerk production**: create the production instance (email only), set its domain to `magkano.online`, add `www.magkano.online` under Allowed Subdomains, add the CNAMEs and DKIM records at GoDaddy, wait for verification, then deploy certificates.
8. **Vercel domains**: add `magkano.online`, plus `www.magkano.online` redirecting to it. At GoDaddy, replace the parked A record and the default `www` CNAME with Vercel's values and turn off forwarding.
9. **First deploys**: redeploy production from `main` (migrate and seed fill Neon `main`). Then open a test PR and run the acceptance checks below on its preview, then on production.

### Documentation

- A new `deploy/CLAUDE.md` covers the architecture (one project, the Function entry, the rewrites), the build steps, the env var matrix, the safety rule, the add-only migrations rule, the fallbacks and how to run the wizard.
- Root `CLAUDE.md` links to it under "Subsystem Documentation" and mentions `magkano.online` in one line.
- `apps/api/CLAUDE.md` gains `buildApp`, the `.ts` import rule, the unpooled URL and the add-only migrations rule.

## Testing Decisions

- **What makes a good test** stays as in v1: external behaviour through a public seam, realistic data, OpenAI stubbed. Tests still never need Postgres, so they run as-is in the Vercel build.
- **New unit tests (Vitest)**:
  - **DB URL helper**: picks `DATABASE_URL_UNPOOLED` over `DATABASE_URL`, falls back to `DATABASE_URL`, fails when both are unset, and the log line has `VERCEL_ENV` (or `local`) and the host but never the password.
  - **`buildApp`**: with a stub env and stores (or a fake DB seam), `GET /api/health` answers 200, a missing `DATABASE_URL` throws a clear error, and no `OPENAI_API_KEY` gives the text-fallback search. Keep the seam thin; don't test wiring internals.
- **Existing tests must still pass** after the `.ts` import rewrite. `pnpm lint`, `pnpm typecheck` and `pnpm test` stay green locally, and `pnpm dev` still works.
- **Acceptance checks**, run by hand on the first preview, then on production. Each has its fallback above. Record the results on the first-deploy ticket.
  1. The preview build log shows lint, typecheck, test, migrate (`env=preview`, a `preview/...` Neon host), seed (same) and the web build all passing.
  2. `GET <preview>/api/health` returns `{"status":"ok"}`, and `GET /api/recipes/<a real id>` returns that Recipe. This proves Hono sees the original path.
  3. Opening `<preview>/recipes/<id>` directly, and refreshing on it, loads the Recipe page (deep links serve `index.html`), and an unknown `/api/nope` returns the JSON `not_found` error, not the SPA.
  4. Search for "manok" returns results without the "basic search" note (the embedder works on the Function), and pricing a Draft works.
  5. Sign-in with the dev instance works on the preview URL.
  6. A second push to the same PR reuses the same `preview/<branch>` Neon branch (no new branch in the Neon console).
  7. After the PR merges and its branch is deleted, the next preview deploy removes the old Neon branch.
  8. Production: `https://magkano.online` loads; `www.` and `http://` redirect; the migrate and seed log lines show `env=production` and Neon `main`'s host; email sign-up and sign-in work with the `pk_live_` key; search and pricing work.
- **Not in v1.1**: automated end-to-end or smoke tests, GitHub Actions, uptime checks.

## Build Order

1. **`.ts` import extensions**: tsconfig flag, Biome rule, bulk rewrite. Everything stays green. (Mechanical; do it first so later code follows the rule.)
2. **`buildApp(env)` and DB options**: `build-app.ts`, `createDb` options, thin `server.ts`, the DB URL helper used by `drizzle.config.ts` and `seed`, the seed embeddings warning, and tests.
3. **Vercel config**: `api/index.ts`, root `tsconfig.json` and `typecheck`, `vercel.json`, `engines: 22.x`, the Vite build-time key check, the `.env.example` comment.
4. **Docs and wizard**: `deploy/setup.sh` (via the `wizard` skill), `deploy/CLAUDE.md`, and the `CLAUDE.md` updates.
5. **First deploy** (after the owner runs the wizard): the acceptance checks, applying a fallback only if a check fails.

Steps 1–4 are agent work (about 1 hour). Step 5 waits on the owner's setup and is mostly checking.

## Out of Scope

- GitHub Actions or any CI outside the Vercel build.
- Rate limits, monitoring, error tracking (Sentry), analytics and uptime checks.
- Google or other social sign-in in production (it can be added later with no code change).
- A Vercel Development environment, `vercel dev`, or any change to local development.
- A host-allowlist guard in `seed`, staging environments, and preview-to-production promotion workflows.
- v2–v5 (saved Grocery Lists, user Recipes, ongoing ingestion, "what I have"), as listed in the v1 spec.

## Further Notes

- **Unconfirmed until the first deploy** (each is an acceptance check with a fallback above):
  - Hono sees the original path after the rewrite.
  - Deep links serve `index.html`.
  - Neon's vars exist during the preview *build*, not just at runtime.
  - Pushes to one PR reuse one Neon branch.
  - The classic builder runs the `.ts`-extension imports.
- **Costs**: Vercel Hobby and Neon Free are free. Clerk's free tier covers this (dev instance: 100 users, shared by local and previews). OpenAI is capped by the project spend limit, and query embeddings are tiny.
- **Hobby is non-commercial.** Moving to Pro needs no code change.
- **Research details** with citations are on the `research/hono-and-vite-on-vercel`, `research/neon-vercel-integration` and `research/clerk-production-domain` branches (see tickets 01–03).
