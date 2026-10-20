# Decide the deployment shape for this codebase

Type: grilling
Status: open
Blocked by: 01, 02, 03

## Question

Given the research, how exactly does this codebase change to deploy? Each decision should be precise enough for the spec.

Covers:
- The Vercel Function entry and how it shares `createApp` wiring with the local `server.ts`.
- The DB client for Functions (driver, pool, connection URL per use: Function, migrate, seed).
- The build command, step by step, and the `vercel.json` settings.
- The env var matrix (local, preview, production), including `OPENAI_API_KEY` at runtime and in the build.
- Domain setup: `magkano.online` apex or `www`, the redirect, and the Clerk DNS records.
- Whether local dev changes at all (see the map's Not yet specified).
- What the human `wizard` ticket walks through, in order.

Open decisions from the research (01–03):
- **Function build**: Option A (classic builder, add `.ts` extensions to relative imports in `apps/api`, enforced by Biome) or Option B (Vercel Services, Beta).
- **Driver**: keep postgres.js with a small module-scope pool, or switch the Function to `pg` + `attachDatabasePool`.
- **Seed safety**: every build wipes and reloads its database, so a preview build that somehow got production's `DATABASE_URL` would overwrite production. Decide the guard (for example, refuse to seed when `VERCEL_ENV=preview` and the host is production's).
- **Accounts and plans**: a separate Neon account (Neon-Managed integration), Vercel Hobby or Pro, and Node 22 or 24.
- **Clerk production**: which sign-in methods (email only, or Google with an owner-made OAuth app); apex `magkano.online` or `www` as canonical; DNS at Vercel or the registrar.
- **Unconfirmed facts**: rewrite path reaching Hono, deep links, Neon env vars present in the build, one branch reused per PR. Decide whether to check them with a spike deploy before the spec, or as acceptance checks in the build tickets.
