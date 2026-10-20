# Magkano v1.1 (deployment)

Label: wayfinder:map

## Destination

A v1.1 spec at `.scratch/v1.1/spec.md` that `/to-tickets` can take with nothing left to decide. From it, an agent can make the v1 app run online in about 1 hour: production on `magkano.online`, and a preview deployment with its own database for every pull request. Setting up the owner's accounts is a separate human step.

## Notes

- **Starting point**: v1 is built and merged to `main`. Its spec is `.scratch/v1/spec.md`, and its decisions stand.
- **Build budget**: about 1 hour of agent build time from the spec, without lowering quality. The owner's account setup (Vercel, Neon, Clerk production, DNS, env vars, OpenAI spend limit) is a separate `wizard` ticket and doesn't count toward that hour.
- **Vocabulary**: use the terms in `GLOSSARY.md`. Call `domain-modeling` when a ticket sharpens or adds a term.
- **Plan, don't build**: tickets produce decisions, not code.
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

## Not yet specified

- How local dev changes, if at all (it should stay `pnpm dev` with Docker). This depends on how the API entry and the DB client are split between Node and Vercel.

## Out of scope

- GitHub Actions or any CI outside the Vercel build.
- Rate limits, monitoring, error tracking (Sentry), analytics and uptime checks.
- v2–v5 (saved Grocery Lists, user Recipes, ongoing ingestion, "what I have"), as listed in the v1 map.
