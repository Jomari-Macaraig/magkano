# Decide the deployment shape for this codebase

Type: grilling
Status: resolved
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

## Answer

Resolved by grilling, 2026-10-21. The owner accepted every recommendation; for Q11 the registrar is GoDaddy.

1. **Function build (Option A)**: one Vercel project at the repo root on the Vite preset, output `apps/web/dist`. A root `api/index.ts` exports the Hono app. `vercel.json`: rewrites `/api/(.*)` → `/api`, then `/(.*)` → `/index.html`; `regions: ["sin1"]`; `maxDuration: 30`. Every relative import in `apps/api` (141 today) gets a `.ts` extension, with `allowImportingTsExtensions` in the tsconfig and Biome's `useImportExtensions` enforcing it. Fallback if that fails on the first deploy: Vercel Services (Beta).
2. **Shared wiring**: `server.ts`'s setup (stores, search, embedder, the no-key text fallback) moves to `buildApp(env)` in `apps/api/src`. `server.ts` (local Node) and `api/index.ts` (Vercel) are thin callers. Local `pnpm dev` is unchanged.
3. **Driver**: keep postgres.js. `createDb(url, options)` takes pool options. The Function uses one module-scope client on the pooled `DATABASE_URL` with `{ max: 5, idle_timeout: 5, connect_timeout: 10 }`; local keeps `max: 10`. `drizzle-kit migrate` and `seed` read `DATABASE_URL_UNPOOLED ?? DATABASE_URL`, so local needs nothing new. Fallbacks if a preview misbehaves: `prepare: false`, then `pg` + `attachDatabasePool` for the Function only.
4. **Preview can't wipe production**: production's database vars live only in the Vercel Production environment, never Preview. A preview gets a URL only from Neon's per-deployment branch injection, and `migrate` and `seed` fail when no URL is set. Both print `VERCEL_ENV` and the target host before writing. No host-allowlist check.
5. **Plans and runtime**: Neon Free with its own account (Neon-Managed integration), Vercel Hobby (non-commercial), Node pinned with `"engines": { "node": "22.x" }`.
6. **Clerk production**: email sign-in only (match what the dev instance uses). Google can be turned on later with no code change.
7. **Domain and DNS**: `magkano.online` (bare domain) is canonical and `www.magkano.online` redirects to it. DNS stays at GoDaddy (it doesn't proxy): replace GoDaddy's parked A record and default `www` CNAME with Vercel's, turn off domain forwarding, add Clerk's CNAMEs and DKIM records, with no CAA records and no wildcard.
8. **Build command**: `pnpm lint && pnpm typecheck && pnpm test && pnpm db:migrate && pnpm seed && pnpm --filter @magkano/web build`. `OPENAI_API_KEY` is set in Production and Preview (runtime search and any new seed embeddings).
9. **Deploy window**: migrate and seed run before the new deployment goes live, and seed's `TRUNCATE` blocks requests for its few seconds. Accepted. Spec rule: migrations are add-only so the running deployment keeps working.
10. **Unconfirmed facts are acceptance checks** on the first deploy ticket, each with its fallback in the spec: Hono sees the original `/api/...` path; deep links serve `index.html`; Neon vars exist during the preview build; pushes to one PR reuse one Neon branch. No spike ticket.
11. **Registrar**: GoDaddy. The wizard walks through GoDaddy's DNS screen.
12. **Wizard order**: (1) OpenAI project spend limit and key; (2) GitHub "Automatically delete head branches"; (3) Neon account and project `magkano` in `aws-ap-southeast-1`; (4) Vercel import on Hobby, root directory = repo root; (5) Neon-Managed integration for Production and Preview (not Development), automatic cleanup of obsolete branches on, then confirm Preview has no `DATABASE_URL*` of its own; (6) Vercel env: `OPENAI_API_KEY` in both, `VITE_CLERK_PUBLISHABLE_KEY` `pk_test_` in Preview and `pk_live_` in Production; (7) Clerk production instance (email only), domain `magkano.online`, Allowed Subdomains `www.magkano.online`, CNAMEs and DKIM at GoDaddy, deploy certificates; (8) Vercel domains `magkano.online` + `www` redirect, A and CNAME at GoDaddy; (9) first production deploy (migrate and seed fill an empty Neon `main`), then a test PR to run the acceptance checks on its preview. Clerk DNS goes before the Vercel domain because it can take up to 48 hours.
