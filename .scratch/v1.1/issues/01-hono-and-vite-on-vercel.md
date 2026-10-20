# Research how Hono and the Vite SPA deploy on Vercel from this pnpm workspace

Type: research
Status: resolved
Blocked by: none

## Question

How does this repo (pnpm workspace, `apps/web` Vite SPA, `apps/api` Hono on Node with workspace packages exporting TypeScript source) deploy to one Vercel project, with the SPA static and the API as a Node Vercel Function in `sin1` under `/api/*`?

Covers:
- Vercel's current Hono support (zero-config detection versus an explicit function entry such as `api/[[...route]].ts`), and how that sits beside the existing `apps/api/src/server.ts` Node entry.
- Project settings for a pnpm monorepo: root directory, install and build commands, output directory, Node 22, `vercel.json` (rewrites for SPA routes and `/api/*`, function region, `maxDuration`).
- Whether TypeScript workspace source is bundled without a build step, and how to keep build-only dependencies (`pdfjs-dist`, `drizzle-kit`, scripts) out of the function bundle.
- Build-time env (`VITE_CLERK_PUBLISHABLE_KEY` per environment) versus runtime env, and how Preview and Production env vars are scoped.
- Running long build steps (checks, migrate, seed) in the Vercel build: time limits, network access to Neon from the build.

Cite primary sources (Vercel docs, Hono docs).

## Answer

Resolved by research, 2026-10-21. Full findings with citations: branch `research/hono-and-vite-on-vercel`, file `.scratch/v1.1/research/01-hono-and-vite-on-vercel.md`.

Neither Vercel shape is zero-config here: Hono detection wants a root entry, and the Hono and Vite presets can't share a project.
- **Option A (GA, recommended)**: one project at the repo root on the Vite preset, output `apps/web/dist`, a root `api/index.ts` exporting a shared `buildApp(process.env)`; rewrites `/api/(.*)` → `/api` then `/(.*)` → `/index.html`; `regions: ["sin1"]`, `maxDuration: 30`. The classic Node builder compiles files one by one without bundling, so the ~109 extensionless relative imports in `apps/api` must gain `.ts` extensions (`allowImportingTsExtensions`, Biome `useImportExtensions`). Confirmed from builder source, not by deploy.
- **Option B (Services, Beta)**: bundles with rolldown, so imports work as they are, but it's Beta and pnpm workspaces aren't documented.
- Only what the entry imports is bundled (`pdfjs-dist`, `drizzle-kit`, scripts stay out). `server.ts` wiring moves to a shared `buildApp`, and local dev is unchanged. `VITE_*` vars are baked in at build time per Vercel environment. Builds get 45 min on every plan.
- Unconfirmed until a real deploy: Hono sees the original `/api/...` path after the rewrite, and deep links serve `index.html`.
- Open: A or B; Node 22 (`"22.x"`) or 24 (what `>=22` gets); Hobby or Pro (Hobby suffices).
