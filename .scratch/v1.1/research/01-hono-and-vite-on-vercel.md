# Research: Hono and the Vite SPA on Vercel from this pnpm workspace

Ticket: [01-hono-and-vite-on-vercel](../issues/01-hono-and-vite-on-vercel.md). Researched 2026-10-21 against the live Vercel docs (pages last updated Jun–Sep 2026), the `vercel/vercel` builder source on `main`, and the Vite source. Each claim cites its source. Where a claim is my inference from source code and not from a doc, it says so. Those claims need a spike deploy.

## TL;DR

1. **There are two workable shapes. Neither is fully zero-config for this repo.**
   - **A. Classic: one project at the repo root, Vite preset, a root `api/index.ts` function.** This is GA and well documented. One blocker: the classic Node builder compiles each TypeScript file on its own and does not bundle them. Node ESM then fails on our extensionless relative imports (`from "./app"`). Fix: write relative imports in `apps/api` with a `.ts` extension. The builder already turns those into `.js`.
   - **B. Vercel Services (Beta): a `web` service (Vite) and an `api` service (Hono) in one project.** It bundles the backend with rolldown, so extensionless imports and workspace TS source just work. Costs: it is Beta, pnpm-workspace behaviour isn't documented, and the framework preset must be "Services".
2. **Recommendation: A**, unless the owner prefers to try a Beta feature. A changes no runtime behaviour. Its code change is mechanical (about 109 import specifiers, enforceable by a Biome rule), and every setting it needs is in GA docs.
3. Hono's own zero-config detection (`src/server.ts`, `src/index.ts`, …) does **not** apply to our layout. It looks at the project root, where there is no Hono entry. It would also conflict with the Vite preset. Don't rely on it.
4. Dependencies come from file tracing, not from `package.json`. `pdfjs-dist`, `drizzle-kit`, `tsx` and the scripts stay out of the function because nothing the entry imports reaches them. `excludeFiles` is the backstop.
5. `VITE_*` values are inlined at build time, and Vite reads them from `process.env` with no `.env` file. Set `VITE_CLERK_PUBLISHABLE_KEY` once per Vercel environment (Production = Clerk prod key, Preview = Clerk dev key). Runtime secrets (`DATABASE_URL`, `OPENAI_API_KEY`) are read by both the build and the function.
6. The build step has 45 minutes on every plan. Checks, migrate and seed fit easily. Neon's own docs say to run migrations in the Vercel build command.

## 1. Vercel's Hono support, and how it sits beside `apps/api/src/server.ts`

### What zero-config Hono is

- Vercel deploys a Hono app "with zero configuration". You need a file that imports `hono` in one of these places: `app.*`, `index.*`, `server.*`, `src/app.*`, `src/index.*` or `src/server.*` (`js/cjs/mjs/ts/cts/mts`). That file must `export default app`. ([Hono on Vercel](https://vercel.com/docs/frameworks/backend/hono))
- Those paths are relative to the **project root** (the Root Directory). The builder's list of valid filenames is the same set (`packages/hono/src/build.ts` in `vercel/vercel`).
- On a Hono deploy, "server routes automatically become Vercel Functions and use Fluid compute by default". Static assets must go in `public/**`, and "Hono's `serveStatic()` will be ignored". ([Hono on Vercel](https://vercel.com/docs/frameworks/backend/hono))
- Hono's own guide says the same thing: zero-config, the app in `index.ts` or `src/index.ts` as a default export, run with `vercel dev`. It no longer shows the `api/[[...route]].ts` / `handle()` pattern. ([Hono: Vercel](https://hono.dev/docs/getting-started/vercel))
- `[[...route]]` is a Next.js file convention. Vercel's docs for plain `api/` functions don't document it. For non-Next projects they say to put one shared entry in `api/` and "configure rewrites to send related API paths to the same function". ([Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js))

**Why zero-config Hono doesn't fit here:**

- If the Root Directory is the repo root, there is no Hono entry there. The candidates live in `apps/api/src/`.
- If the Root Directory is `apps/api`, then `apps/api/src/server.ts` *would* be detected. But it calls `serve()` from `@hono/node-server` and has no default export, and the SPA in `apps/web` would sit outside the root. A Root Directory "will not be able to access files outside of that directory". ([Configuring a build](https://vercel.com/docs/builds/configure-a-build#root-directory))
- The Hono preset and the Vite preset are both project-level presets. A project has one. ([Configuring a build: Framework Preset](https://vercel.com/docs/builds/configure-a-build#framework-preset))

### Option A: classic `api/` function in a Vite-preset project (recommended)

- "Vercel creates a separate function for each supported source file in the root `api/` directory." Vercel advises one shared entry, using "a framework with routing support such as Hono", with route modules kept outside `api/` and imported. ([Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js))
- The entry can use the fetch Web Standard export, `export default { fetch(request) { … } }`. This is "used by many frameworks like Hono". ([Functions API reference](https://vercel.com/docs/functions/functions-api-reference#fetch-web-standard)) A Hono instance has a `fetch` method, so `export default createApp(deps)` meets that shape. The Hono page shows exactly `export default app`.
- **What path the function sees after a rewrite.** The Hono builder adds a `request.path` transform. Its comment says it does this "so application routing observes the rewritten destination" (`packages/hono/src/build.ts`). That implies a plain `api/` function sees the **original** URL. *Inference from source, not stated in a doc.* So with `/api/(.*) → /api`, Hono gets `/api/recipes` and `basePath("/api")` matches. A spike deploy should check this with `GET /api/health`.
- **The ESM blocker.** The classic builder (`packages/node/src/build.ts`) runs `@vercel/nft` over the entry. It compiles each traced `.ts` file on its own with the project's `typescript` package (TypeScript 7 goes through the "native compiler" path in `packages/node/src/typescript.ts`). It renames `x.ts → x.js` and does **not** bundle. The compiler options it sets include `rewriteRelativeImportExtensions: true`, which only rewrites `./x.ts` to `./x.js`. Extensionless specifiers stay extensionless. Under `"type": "module"`, Node's ESM resolver needs full specifiers, so `import … from "./app"` fails at runtime with `ERR_MODULE_NOT_FOUND`. Community reports show the same failure ([Vercel community thread](https://community.vercel.com/t/module-not-found-when-deploying-hono-backend-to-vercel/21164)).
  - **Fix:** write relative imports in `apps/api/src` with `.ts` (`from "./app.ts"`). Add `allowImportingTsExtensions` to `tsconfig.base.json`; it is allowed because `noEmit` is already on. Turn on Biome's `useImportExtensions` rule so the convention holds. `tsx`, Vitest and Vite all resolve `.ts` specifiers, so local dev and tests don't change.
  - The builder looks for a `tsconfig.json` by walking up from the entry. The repo root has only `tsconfig.base.json`, so the builder would fall back to its defaults (`module`/`moduleResolution: NodeNext`, `packages/node/src/typescript.ts`). A root `tsconfig.json` (or `api/tsconfig.json`) that extends the base makes the compile settings explicit. Vercel notes that `paths` and project references aren't supported. ([Node.js runtime: TypeScript](https://vercel.com/docs/functions/runtimes/node-js#using-typescript-with-the-node.js-runtime))
- A note on `VERCEL_EXPERIMENTAL_BACKENDS=1`: it adds better module resolution ("relative imports no longer need file extensions"), but only for Hono and Express *framework* projects ([changelog](https://vercel.com/changelog/experimental-build-mode-hono-express); the `BACKEND_FRAMEWORKS` list in `packages/build-utils/src/framework-helpers.ts`). It doesn't help a Vite-preset project's `api/` function.

### Option B: Vercel Services (Beta)

- "Services let you deploy multiple backends and frontends within a single Vercel project … with shared routing, environment variables, and a unique domain". They are "available in Beta on all plans". ([Services](https://vercel.com/docs/services))
- Configure it with `vercel.json` `services` (`root`, `framework`, `entrypoint`, `buildCommand`, `installCommand`, `outputDirectory`, `functions`, `rewrites`, …) plus top-level rewrites whose `destination` is `{ "service": "<name>" }`. A project builds as services only when the Framework Preset is "Services" **and** `services` is present. ([Services](https://vercel.com/docs/services), [config reference](https://vercel.com/docs/services/config-reference), [Complete guide](https://vercel.com/kb/guide/vercel-services))
- "The service receives the original request path. `GET /api/users` reaches `my_backend` as `/api/users`". That fits `basePath("/api")`. Routing into a service is final, with no fallback to other rewrites. ([Services routing](https://vercel.com/docs/services/routing))
- Node services build with `@vercel/backends` (`packages/fs-detectors/src/services/runtimes/constants.ts`), which **bundles local source with rolldown**. Files outside `node_modules`, workspace packages included, go into the bundle. `node_modules` imports stay external and are traced with nft (`packages/backends/src/rolldown/index.ts`). This removes the ESM extension problem.
- Top-level `functions`, `buildCommand`, `installCommand`, `outputDirectory` and `framework` must move into a service. ([Services](https://vercel.com/docs/services#top-level-configuration-in-services-mode))
- **Gaps for us:** the docs don't cover pnpm workspaces, a shared lockfile above a service root, or a Vite frontend service. ([Complete guide](https://vercel.com/kb/guide/vercel-services) is silent on them.) "Structure your application" recommends Services for one domain with no CORS, and "a single framework" when one can serve both. ([Structure your application](https://vercel.com/kb/guide/structure-your-application))

### Beside `server.ts`

In both options, keep `apps/api/src/server.ts` as the local Node entry, unchanged for `pnpm dev`. Move the dependency wiring it does now (DB client, stores, search with optional OpenAI) into one shared factory, for example `apps/api/src/main.ts` exporting `buildApp(env)`. Then:

- `server.ts` calls `serve({ fetch: buildApp(process.env).fetch, port })`.
- `api/index.ts` (A), or the Services `entrypoint` (B), does `export default buildApp(process.env)`.

`@hono/node-server` is only reached from `server.ts`, so it never enters the function's trace.

## 2. Project settings for the pnpm monorepo (Option A)

| Setting | Value | Source |
| --- | --- | --- |
| Root Directory | repo root (empty) | A subdirectory root can't reach files outside it ([Configure a build](https://vercel.com/docs/builds/configure-a-build#root-directory)); `api/` must be at the project root ([Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)) |
| Framework Preset | `vite` (`"framework": "vite"`) | [vercel.json `framework`](https://vercel.com/docs/project-configuration/vercel-json#framework) |
| Install Command | default. pnpm is detected from `pnpm-lock.yaml`. The version comes from `packageManager` via Corepack only if `ENABLE_EXPERIMENTAL_COREPACK=1` is set | [Node.js dependencies](https://vercel.com/docs/functions/runtimes/node-js#node.js-dependencies), [Corepack](https://vercel.com/docs/builds/configure-a-build#corepack). The default install includes `devDependencies` ([Install Command](https://vercel.com/docs/builds/configure-a-build#install-command)) |
| Build Command | `buildCommand` in `vercel.json` (see §5) | [vercel.json `buildCommand`](https://vercel.com/docs/project-configuration/vercel-json#buildcommand) |
| Output Directory | `apps/web/dist` | "Only the contents of this Output Directory will be served statically" ([Output Directory](https://vercel.com/docs/builds/configure-a-build#output-directory)) |
| Node.js | 22.x. Our `engines.node` is `">=22"`, and Vercel maps `>=22.0.0` to the **latest 24.x**. To get 22, set `"22.x"`. `engines` overrides the dashboard setting | [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) (24.x is the default; 22.x is available) |
| Function region | `"regions": ["sin1"]`. Hobby gets a single region, which is enough. The default is `iad1` | [regions](https://vercel.com/docs/project-configuration/vercel-json#regions), [Configuring regions](https://vercel.com/docs/functions/configuring-functions/region) |
| Fluid compute | on by default for new projects (since 2025-04-23) | [vercel.json `fluid`](https://vercel.com/docs/project-configuration/vercel-json#fluid) |
| `maxDuration` | default and Hobby maximum are 300 s. Pro goes up to 800 s. Set a lower cap such as 30 s for `api/index.ts` so a hung OpenAI or DB call can't run for 5 min | [Functions limits](https://vercel.com/docs/functions/limitations#max-duration), [`functions`](https://vercel.com/docs/project-configuration/vercel-json#functions) |
| Memory | can't be set in `vercel.json` under Fluid; set it in the dashboard (default 2 GB) | [`functions`](https://vercel.com/docs/project-configuration/vercel-json#functions) |

**Rewrites and ordering.** `vercel.json` rewrites go in *after* `{ handle: "filesystem" }` (`packages/routing-utils/src/index.ts`, where the route table is built). So real static files (`/assets/*.js`) and the function path `/api` are matched first, and rewrites only catch what's left. Vercel's SPA example is `{ "source": "/(.*)", "destination": "/index.html" }` ([Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas)). Put the API rule first so unknown `/api/*` paths reach Hono's JSON 404 and not `index.html`.

Proposed `vercel.json` (Option A):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "pnpm lint && pnpm typecheck && pnpm test && pnpm db:migrate && pnpm seed && pnpm --filter @magkano/web build",
  "outputDirectory": "apps/web/dist",
  "regions": ["sin1"],
  "functions": {
    "api/index.ts": { "maxDuration": 30, "excludeFiles": "{apps/api/data/**,apps/api/scripts/**,sample/**}" }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The `excludeFiles` glob is illustrative; the spike should check it against the real trace. Option B would move `buildCommand` and `functions` into the services: `web` with `framework: "vite"`, `outputDirectory: "dist"` and its own `/(.*) → /index.html` rewrite, and `api` with `root: "apps/api"`, `entrypoint`, `functions`. The top-level rewrites would route `/api/(.*)` to `api` and `/(.*)` to `web`.

The monorepo docs cover *one project per app*, with "Skip unaffected projects" and `relatedProjects` ([Monorepos](https://vercel.com/docs/monorepos)). That model gives two domains and needs CORS, which the map rules out. One project at the repo root fits the settled decision.

## 3. TypeScript workspace source, and keeping build-only deps out

- **No build step is needed.** The classic builder compiles traced `.ts` files itself (`compileTypeScript` inside nft's `readFile` hook, `packages/node/src/build.ts`). Services/backends bundles them with rolldown. Either way the "workspace packages export TS source" convention is fine. The one catch is the ESM import-extension rule from §1 (A only).
- **What goes in the bundle comes from the trace, not from `package.json`.** nft follows imports from the entry, so a dependency only ships if something reachable imports it (`nodeFileTrace` in `packages/node/src/build.ts`; nft + externals in `packages/backends/src/rolldown/index.ts`). In this repo:
  - `pdfjs-dist` is imported only by `apps/api/src/extract/pdf-text.ts`, which `app.ts` never reaches. It isn't traced.
  - `drizzle-kit` is imported only by `drizzle.config.ts`. `tsx`, `vitest` and Biome are CLIs. None are traced.
  - `scripts/*.ts`, `src/seed`, `src/tagging` and `src/extract` aren't reached from `app.ts` or the stores. If the shared factory imports only stores, search and the DB client, they stay out.
  - `data/embeddings.json` is read by `seed` from disk and isn't imported by the routes, so it isn't traced.
- **Backstops:** `functions["api/index.ts"].excludeFiles` / `includeFiles` ([vercel.json `functions`](https://vercel.com/docs/project-configuration/vercel-json#functions)). The size limit is 250 MB uncompressed ([Bundle size limits](https://vercel.com/docs/functions/limitations#bundle-size-limits)), so we're far under it.
- **Nothing needs to move** to `devDependencies` for bundle size. Moving `pdfjs-dist` there would still tidy the intent; it's optional.
- The web app imports `@magkano/api` as types only (`apps/api/src/index.ts`), so no server code reaches the SPA bundle.

## 4. Build-time versus runtime env, and Preview/Production scoping

- Environment variables are readable "during the Build Step or during Function execution". Changes "only apply to new deployments". Total size is limited to 64 KB per deployment. ([Environment variables](https://vercel.com/docs/environment-variables))
- Each variable is scoped to one or more of Production, Preview, Development (and custom environments). A Preview variable can apply to all non-production branches or to one branch, and branch-specific values override the general Preview value. ([Environment variables: Environments](https://vercel.com/docs/environment-variables#environments))
- Integration-added variables, such as Neon's, take the scope of the project connection ([Integration env vars](https://vercel.com/docs/environment-variables#integration-environment-variables)). Neon injects per-preview-branch `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` "via webhook at deployment time", and these don't show in Vercel's env settings ([Neon: Vercel-managed integration](https://neon.com/docs/guides/vercel-managed-integration)). Details belong to ticket 02.
- **Vite:** `VITE_*` values are "statically replaced at build time" ([Vite env and mode](https://vite.dev/guide/env-and-mode)). `loadEnv` copies every prefixed key from `process.env` and gives it priority over `.env` files (`packages/vite/src/node/env.ts`). On Vercel there's no root `.env`, so our `envDir: "../.."` finds nothing and the Vercel-provided `VITE_CLERK_PUBLISHABLE_KEY` is used.
- **Concretely:**
  - `VITE_CLERK_PUBLISHABLE_KEY` is build-time and public. Set the Production scope to the Clerk production `pk_live_…` and the Preview scope to the Clerk dev `pk_test_…`. Because it's inlined, changing it means a redeploy.
  - `DATABASE_URL` and `OPENAI_API_KEY` are used at build (migrate, seed) **and** at runtime (function), so scope them to both Production and Preview.
  - `VITE_VERCEL_ENV` and the other system variables are also available to Vite with the `VITE_` prefix ([Vite on Vercel: Environment Variables](https://vercel.com/docs/frameworks/frontend/vite#environment-variables)).

## 5. Long build steps (checks, migrate, seed) in the Vercel build

- **Time:** "The maximum duration of the Build Step is 45 minutes" on Hobby, Pro and Enterprise ([Limits: Build time per deployment](https://vercel.com/docs/limits#build-time-per-deployment)). Lint, typecheck, Vitest, `drizzle-kit migrate`, `seed` (using cached `embeddings.json`) and `vite build` should take a few minutes at most.
- **Deploy count:** Hobby allows 100 deployments per day ([Limits](https://vercel.com/docs/limits)).
- **Environment:** builds run in an Amazon Linux 2023 container with Node 24.x/22.x ([Build image](https://vercel.com/docs/builds/build-image)). Dev dependencies are installed, so `drizzle-kit`, `tsx`, `vitest` and Biome are available ([Install Command](https://vercel.com/docs/builds/configure-a-build#install-command)).
- **Network to Neon:** Neon's integration guide says to run migrations by overriding the Vercel Build Command (`… migrate deploy && npm run build`). Its env vars are injected at deployment time, so the build can reach the preview branch ([Neon: Vercel-managed integration](https://neon.com/docs/guides/vercel-managed-integration)). Vercel builds already reach the public internet (package installs). No Vercel doc limits outbound DB connections from the build. Neon IP Allow, if anyone turns it on, would block this. *Inference; leave IP Allow off.*
- **Pooled vs direct URL:** use `DATABASE_URL_UNPOOLED` for `drizzle-kit migrate` and `seed` in the build. That's the direct connection; one long transaction and DDL shouldn't run through PgBouncer. Use pooled `DATABASE_URL` in the function. *Recommendation; confirm in ticket 02.*
- **Order:** any non-zero exit fails the build. Keep `vite build` last, so a failed migrate or seed never ships a new SPA against an old schema.
- Fluid compute reuses instances across requests, so a module-level postgres.js pool persists. Vercel's `attachDatabasePool` releases idle clients before suspend. Its docs list pg, MySQL2 and others "and other compatible pool types", but not postgres.js by name ([`@vercel/functions`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool)). That belongs to the DB-client split decision.

## Recommendations for the v1.1 spec

1. One Vercel project, Root Directory = repo root, `framework: "vite"`, `outputDirectory: "apps/web/dist"`, `regions: ["sin1"]`, and the `vercel.json` above.
2. Add a root `api/index.ts` that does `export default buildApp(process.env)`. Add `apps/api/src/main.ts` with the shared wiring, which `server.ts` also uses. Local `pnpm dev` stays as it is.
3. Write relative imports in `apps/api` with `.ts` extensions. Add `allowImportingTsExtensions` and Biome `useImportExtensions`. Add a root `tsconfig.json` that extends `tsconfig.base.json`.
4. Pin `engines.node` to `"22.x"`, or accept 24.x. Set `ENABLE_EXPERIMENTAL_COREPACK=1` so pnpm 10.33.0 from `packageManager` is used.
5. Set `maxDuration: 30` on the function, and keep `excludeFiles` as a guard.
6. Make the first build ticket a spike deploy. It should confirm three things: `/api/health` reaches Hono as `/api/health`, deep links serve `index.html`, and the function bundle has no `pdfjs-dist` or `drizzle-kit`.

## Open decisions

- **A (GA, add `.ts` import extensions) or B (Services Beta, no import change)?** This research recommends A.
- **Node 22 or 24?** `engines: ">=22"` gives 24.x on Vercel; `"22.x"` matches the local minimum.
- **Hobby or Pro?** Hobby has one function region (fine for `sin1`) and a 300 s maximum duration (fine). Pro is needed only for more regions or longer runs.
- **Which Neon URL the build and the function use** (pooled or unpooled), and whether `attachDatabasePool` applies to postgres.js. Ticket 02 and the DB-client split decide these.
