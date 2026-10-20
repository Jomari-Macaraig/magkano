# Research how Hono and the Vite SPA deploy on Vercel from this pnpm workspace

Type: research
Status: open
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
