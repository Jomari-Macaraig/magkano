# deploy

Magkano runs on one Vercel project: production on `magkano.online` (Neon `main`, Clerk production instance) and a preview deployment per pull request (its own Neon branch, the Clerk development instance). Local development doesn't use any of this. The spec is `.scratch/v1.1/spec.md`.

## Architecture

- **One Vercel project at the repo root**, Hobby plan, Framework Preset Vite (picked at import, wizard step 4). Build command, output, region, Function and rewrites live in `vercel.json` (root).
- **SPA**: static files from `apps/web/dist` (`outputDirectory`).
- **API**: one Node Function, `api/index.ts` (root), in `sin1` (Singapore, next to Neon's `aws-ap-southeast-1`), `maxDuration: 30`. Its default export is `buildApp(process.env, ...)` from `apps/api/src/build-app.ts`; Vercel serves it through its `fetch` method. It holds one small module-scope postgres.js pool per instance on the pooled `DATABASE_URL` (options in `api/index.ts`). It imports only from `apps/api/src`, so the root package has no runtime dependencies and only what it imports is bundled (not `pdfjs-dist`, `drizzle-kit` or the scripts).
- **Rewrites** (order matters): `/api/(.*)` → `/api` (the Function; Hono keeps `basePath("/api")` and must see the original path), then `/(.*)` → `/index.html` so deep links like `/recipes/<id>` serve the SPA. Static assets (`/assets/*`) are served before rewrites apply.
- Same origin for SPA and API, so no CORS. `www` → apex and HTTP → HTTPS are Vercel domain settings, not rewrites.
- Node is pinned by root `package.json` `"engines": { "node": "22.x" }`. Root `tsconfig.json` covers `api/`; `pnpm typecheck` runs it after the workspace typechecks.
- The Function needs every relative import in `apps/api` to end in `.ts` (the classic builder doesn't bundle); see `apps/api/CLAUDE.md`.

## Build steps

`vercel.json`'s `buildCommand`, in order, and any failure stops the deploy (a failed production build leaves the previous deployment serving):

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` (tests never need Postgres). Vercel's build tree has a `.pnpm-store/` and a minified copy of `vercel.json`, so `biome.json` excludes both (and `.vercel`).
2. `pnpm db:migrate` then `pnpm seed`, both on `DATABASE_URL_UNPOOLED ?? DATABASE_URL`. Each prints `<task>: env=<VERCEL_ENV|local> host=<host>` (host only, never the URL) before writing, so the log shows which database a build writes to. `seed` re-runs its one-transaction wipe and reload on every build, production included. If Recipe chunks are missing from `apps/api/data/embeddings.json`, seed embeds them and, on Vercel, warns to run `pnpm seed` locally and commit the file.
3. `pnpm --filter @magkano/web build`: `vite build` throws when `VITE_CLERK_PUBLISHABLE_KEY` is unset (a missing key fails the deploy rather than shipping a blank page). `vite dev` doesn't check.

To run it locally against Docker Postgres: `pnpm db:up`, export the `.env` vars (`set -a; . ./.env; set +a`), then run the `buildCommand`.

## Env var matrix

| Variable | Local (`.env`) | Preview (Vercel) | Production (Vercel) | Read by |
|---|---|---|---|---|
| `DATABASE_URL` | Docker, `localhost:5435` | injected per deployment by Neon (pooled, branch `preview/<git-branch>`) | Neon `main`, pooled (Production only) | Function; migrate and seed fallback |
| `DATABASE_URL_UNPOOLED` | not set | injected per deployment by Neon (direct) | Neon `main`, direct (Production only) | migrate, seed |
| `OPENAI_API_KEY` | optional | set (same project key) | set | Function (query embeddings); seed (new chunks only) |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_…` | `pk_test_…` (dev instance) | `pk_live_…` (production instance) | web build (baked in) |
| `API_PORT` | optional, `8787` | not set | not set | local `server.ts`, Vite proxy |
| `VERCEL`, `VERCEL_ENV` | not set | set by Vercel | set by Vercel | migrate and seed log line; seed's embeddings warning |

- The Neon-Managed integration is connected to Production and Preview, not Development. Other `PG*` / `POSTGRES_*` vars it adds are ignored.
- No secret is committed. Clerk is frontend-only: there's no Clerk secret key anywhere.

## A preview can't wipe production

Production's `DATABASE_URL` and `DATABASE_URL_UNPOOLED` exist only in Vercel's **Production** environment. Preview has no database vars of its own: a preview build gets its URL only from the Neon integration's per-deployment branch injection. If that injection is missing, migrate and seed find no URL and fail the build; they never fall back to anything else. There's no host allowlist: the env scoping plus the printed host line are the guard. Never add a `DATABASE_URL*` to Preview.

## Migrations are add-only

Migrate runs before the new deployment goes live, so the running one must keep working on the migrated schema. The rule (what's allowed, and the two-deploy path for a destructive change) is in `apps/api/CLAUDE.md`, under `migrations/`.

## Fallbacks

Each applies only if a first-deploy acceptance check (spec, "Testing Decisions") fails:

- **The classic builder can't load the Function**: switch to Vercel Services (Beta), which bundles with rolldown. Keep the `.ts` extensions.
- **Hono sees `/api` for every request**: change the rewrite destination to `/api?path=$1`, or use `api/[[...route]].ts`. Confirm with `GET /api/health` and `GET /api/recipes/<id>`.
- **Connection or prepared-statement errors through the pooler**: first `prepare: false` in `createDb`, then `pg` with Vercel's `attachDatabasePool` for the Function only.

## Owner setup wizard: `deploy/setup.sh`

An interactive bash wizard that walks the project owner through the one-time account setup for `magkano.online`. The owner does every step in a browser; the wizard says exactly where to click and what to set, pauses after each step and checks what it can from the terminal. The source of truth for the steps is `.scratch/v1.1/spec.md`, "Owner setup wizard".

### Running and resuming

- `deploy/setup.sh`: all nine steps, from step 1.
- `deploy/setup.sh --from 7`: resume at step 7 (steps are numbered as below, also when resuming). Ctrl-C or `q` at a failed check prints the resume command.
- `deploy/setup.sh --list` prints the steps; `--help` prints usage.
- `DNS_SERVER=1.1.1.1 deploy/setup.sh ...` sends the `dig` checks to that resolver.
- It `cd`s to the repo root itself, so it runs from any directory.
- Started from another shell (`zsh deploy/setup.sh`, `sh ...`), it re-runs itself under bash: zsh's 1-based arrays would shift every step title by one.

### Steps (the spec's order)

1. OpenAI: project `magkano`, a monthly budget, a project API key (straight into a password manager).
2. GitHub: Settings → General → "Automatically delete head branches".
3. Neon: own account, Free plan, project `magkano`, Postgres 17, `aws-ap-southeast-1`.
4. Vercel: import the repo on Hobby, Vite preset, root directory = repo root; the first deploy may fail. Offers `vercel link` so later checks can run.
5. Neon-Managed integration (started from the Neon Console's Integrations → Vercel, "Install from Vercel Marketplace"; never Vercel → Storage, which is the Vercel-Managed one): Production and Preview only (not Development), automatic branch cleanup on.
6. Vercel env vars: `OPENAI_API_KEY` in Production and Preview, `VITE_CLERK_PUBLISHABLE_KEY` = `pk_test_` in Preview only. The Production `pk_live_` key is explicitly deferred.
7. Clerk production (email only, domain `magkano.online`, Allowed Subdomains `www.magkano.online`), its CNAMEs (`clerk.`, `accounts.`, `clkmail.`, DKIM) and a recommended `_dmarc` TXT at GoDaddy, Deploy certificates. Ends by setting `pk_live_` in Production, which finishes step 6. Clerk DNS can take up to 48 hours, so this comes before the Vercel domain.
8. Vercel domains: apex `magkano.online` canonical, `www` redirecting to it; at GoDaddy, Vercel's apex A and `www` CNAME replace the parked records, and forwarding is turned off.
9. First deploys: preview first (push to the open v1.1 PR, or open a test PR), then merge to deploy production, with the spec's acceptance checks on each. Redeploying `main` before the v1.1 code is on it fails (`vite: command not found`).

### What it checks

| Tool | Checks |
|---|---|
| `gh` | the repo has `deleteBranchOnMerge` on (step 2) |
| `vercel` (only when the checkout is linked: `.vercel/project.json` or `.vercel/repo.json`) | Production has `DATABASE_URL` and `DATABASE_URL_UNPOOLED`; Preview and Development have no `DATABASE_URL*` of their own (step 5); the env var names from steps 6 and 7 exist in the right environments |
| `dig` | Clerk CNAMEs point at `clerk.services`, no CAA on the apex (step 7); the apex A matches the IP Vercel shows and `www` CNAMEs to `vercel-dns` (step 8) |
| `curl` | `www.` and `http://` redirect to `https://magkano.online` (steps 8 and 9); on a deployment: `/api/health` returns `{"status":"ok"}`, `/api/recipes/sinigang-na-baboy` returns that Recipe, `/api/nope` returns the JSON `not_found`, and the deep link `/recipes/sinigang-na-baboy` serves HTML (step 9) |

- A missing tool skips its checks with a warning; they're listed at the end under "still to do by hand".
- A failed check offers retry, continue (also listed at the end) or quit (prints `--from N`).
- A `vercel env ls` that errors (logged out, expired) fails the check, never passes it with an empty list. The apex A check needs the IP Vercel shows; without one it's listed for checking by hand.
- `vercel env ls` shows names only; the wizard keeps only the name column. It can't see whether a key is `pk_test_` or `pk_live_`, so the owner checks that by eye.
- Vercel's Deployment Protection can make preview URLs answer 401 to `curl`; the owner then checks in a logged-in browser and continues.

### No-secrets rule

The wizard never reads, prints, writes or stores a secret. It never asks for a key: the owner pastes keys only into the dashboards (and a password manager). The only values it reads are public (the apex IP Vercel shows, a preview URL), and it never reads `.env`. The shared wizard library above the `STAGES` marker is kept verbatim, but its secret helpers (`ask`, `ask_secret`, `write_env`, `set_secret`, `set_var`) are overridden below the marker to exit with an error, so a later edit can't start capturing one.

### Editing it

- Everything above the `STAGES` marker is the wizard library from the `wizard` skill: don't hand-edit it. Steps are the `step_N` functions; check targets are small functions passed to `check`.
- Must pass `bash -n deploy/setup.sh` and `shellcheck deploy/setup.sh`. `deploy/.shellcheckrc` disables SC2329 (check functions are passed by name; the library keeps unused helpers) and SC1087 (a false positive in the library). If shellcheck isn't installed: `docker run --rm -v "$PWD/deploy:/mnt:ro" -w /mnt koalaman/shellcheck:stable setup.sh`.
- It runs on macOS's bash 3.2: no `mapfile`, associative arrays or `${var,,}`, and no `"${arr[@]}"` on an array that may be empty under `set -u`.
