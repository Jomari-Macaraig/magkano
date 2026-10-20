# Magkano v1.1 (deployment)

Label: wayfinder:map

## Destination

A v1.1 spec at `.scratch/v1.1/spec.md` that `/to-tickets` can take with nothing left to decide. From it, an agent can make the v1 app run online in about 1 hour: production on `magkano.online`, and a preview deployment with its own database for every pull request. Setting up the owner's accounts is a separate human step.

## Notes

- **Starting point**: v1 is built and merged to `main`. Its spec is `.scratch/v1/spec.md`, and its decisions stand.
- **Build budget**: about 1 hour of agent build time from the spec, without lowering quality. The owner's account setup (Vercel, Neon, Clerk production, DNS, env vars, OpenAI spend limit) is a separate `wizard` ticket and doesn't count toward that hour.
- **Vocabulary**: use the terms in `GLOSSARY.md`. Call `domain-modeling` when a ticket sharpens or adds a term.
- **Plan, don't build**: tickets produce decisions, not code.
- **Stay portable**: Magkano may later move to AWS or GCP. Keep Vercel-specific code to the thin `api/index.ts` entry and `vercel.json`. The app, its `buildApp(env)` wiring, the DB client and the `migrate` → `seed` pipeline stay host-neutral. See [ADR 0001](../../docs/adr/0001-every-deploy-reseeds-from-committed-files.md).
- **Research findings** go on throwaway `research/<name>` branches (pushed, never merged), linked from the ticket.

### Settled before charting

- **Hosting**: Vercel serves both apps on one domain. The SPA is static, and the Hono API runs as a Node Vercel Function in `sin1`, under `/api/*`, with no CORS.
- **Database**: Neon Postgres in `aws-ap-southeast-1` with pgvector. The Neon–Vercel integration gives each preview deployment its own database branch.
- **Environments**: local (Docker, Clerk dev, `.env`), preview (Neon branch, Clerk dev, Vercel Preview env), production (Neon `main`, Clerk production, Vercel Production env). No secrets in the repo.
- **Domain**: production runs on `magkano.online`, which the owner already has.

### Settled while charting (no ticket)

- **Every Vercel build** runs `pnpm lint`, `typecheck` and `test`, then `drizzle-kit migrate`, then `seed`, then the web build. Any failure fails the deploy. No GitHub Actions.
- **Seed runs on every deploy, production included**: the committed files are the data and `seed` is a one-transaction wipe and reload, so merging a data change updates production by itself. Vectors come from the committed `embeddings.json`. A build that needs new embeddings needs `OPENAI_API_KEY`.
- **Public and unthrottled**: anyone can use production. OpenAI cost is capped by a project spend limit set during setup, with no rate limiting in code.
- **Human setup** is a `wizard` ticket (an interactive bash script) in the build tickets.

## Decisions so far

<!-- one line per closed ticket: [title](issues/NN-slug.md): gist -->

- [Research how Hono and the Vite SPA deploy on Vercel from this pnpm workspace](issues/01-hono-and-vite-on-vercel.md): one root project on the Vite preset plus a root `api/index.ts` and rewrites; the classic builder doesn't bundle, so `apps/api` relative imports need `.ts` extensions (or use the Beta Services builder).
- [Research the Neon–Vercel integration and connecting from Functions and the build](issues/02-neon-vercel-integration.md): Neon-Managed integration (the 10-branch Free cap rules out Vercel-Managed); pooled `DATABASE_URL` for the Function, `DATABASE_URL_UNPOOLED` for migrate and seed; keep postgres.js; `regions: ["sin1"]`.
- [Research Clerk production on magkano.online with dev keys on previews](issues/03-clerk-production-on-magkano-online.md): production needs `magkano.online` plus Clerk's CNAMEs; previews use the dev instance; only the publishable key, per Vercel environment; production social sign-in needs the owner's own OAuth apps.
- [Decide the deployment shape for this codebase](issues/04-deployment-shape.md): root `api/index.ts` + `.ts` import extensions; shared `buildApp(env)`; postgres.js with a small pool; production DB vars in Production only; Neon Free, Vercel Hobby, Node 22.x; email-only Clerk; bare `magkano.online` with DNS at GoDaddy; unconfirmed facts become acceptance checks; the 9-step wizard order.

## Not yet specified

Nothing. Local dev is unchanged (settled in the deployment shape ticket); only the spec remains.

## Out of scope

- Moving to AWS or GCP (a later effort; v1.1 only keeps that move cheap).
- GitHub Actions or any CI outside the Vercel build.
- Rate limits, monitoring, error tracking (Sentry), analytics and uptime checks.
- v2–v5 (saved Grocery Lists, user Recipes, ongoing ingestion, "what I have"), as listed in the v1 map.
