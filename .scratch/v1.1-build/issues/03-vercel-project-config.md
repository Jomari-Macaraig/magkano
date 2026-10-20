# 03: Vercel project config

**What to build:** The repo is ready to deploy as one Vercel project:
- the static SPA, plus the Hono API as one Node Function in `sin1` under `/api/*`;
- a build that runs the checks, migrate, seed and the web build, failing on any error;
- deep links that serve the SPA.

Running the full build command locally against Docker Postgres passes. Spec: "Function build and layout", "`vercel.json`", "Web build", "Env var matrix", "Documentation".

**Blocked by:** 02 (Shared `buildApp` and safe database URLs).

**Status:** ready-for-agent

- [ ] A root Function entry's default export is the app from `buildApp(process.env)`. It uses a module-scope pooled client (`max: 5, idle_timeout: 5, connect_timeout: 10`) and adds no runtime dependencies to the root package.
- [ ] `vercel.json` matches the spec: build command, output directory, `regions: ["sin1"]`, `maxDuration: 30`, and the `/api` rewrite before the SPA fallback.
- [ ] Typecheck covers the Function entry (a root tsconfig, and the root `typecheck` script runs it).
- [ ] Node is pinned to `22.x` in the root `engines`.
- [ ] `vite build` fails with a clear message when `VITE_CLERK_PUBLISHABLE_KEY` is unset, and `vite dev` is unchanged.
- [ ] `.env.example` has a commented `DATABASE_URL_UNPOOLED` line saying it's only for Neon.
- [ ] The full build command passes locally against Docker Postgres. The web build output is where `vercel.json` expects it.
- [ ] A new deployment doc covers the architecture, build steps, env var matrix, the rule that keeps a preview from wiping production, add-only migrations, the fallbacks, and how to run the wizard. It lives next to the wizard, and the root `CLAUDE.md` links to it under Subsystem Documentation.
