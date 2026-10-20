# Research the Neon–Vercel integration and connecting from Functions and the build

Type: research
Status: resolved
Blocked by: none

## Question

What does the Neon–Vercel integration set up for preview and production, and how should this app connect to Neon from a Vercel Function and from the build?

Covers:
- Branch per preview: when the branch is created (per deployment or per git branch), what it's branched from, and when it's deleted.
- The env vars it injects (names, pooled versus unpooled, Preview versus Production scoping) and which one `drizzle-kit migrate`, `seed` and the Function should use.
- Driver choice inside a Vercel Node Function: keep `postgres` (postgres.js) through Neon's pooler, or switch to `@neondatabase/serverless`. Pool size, `prepare: false`, cold starts, and how the transaction in `seed` behaves.
- pgvector on Neon (`CREATE EXTENSION vector` in a migration, HNSW indexes) and whether it carries into branches.
- Free plan limits that matter: branch count, storage, compute hours, autosuspend (a preview's first request waking compute).
- Region `aws-ap-southeast-1` alongside Vercel `sin1`.

Cite primary sources (Neon docs, Vercel integration docs).

## Answer

Resolved by research, 2026-10-21. Full findings with citations: branch `research/neon-vercel-integration`, file `.scratch/v1.1/research/02-neon-vercel-integration.md`.

- **Neon-Managed integration**, not Vercel-Managed: the Free plan caps a project at 10 branches, and Vercel-Managed keeps a preview branch as long as its deployment (6 months by default). Neon-Managed deletes `preview/<git-branch>` once the Git branch is gone (at the next preview deploy), so turn on GitHub's "auto-delete head branches". Don't connect the Development environment.
- Preview branches are created by webhook when a deployment starts, from the default branch (production `main`), and named per Git branch (reuse across pushes inferred, not documented).
- Env: `DATABASE_URL` (pooled) for the Function; `DATABASE_URL_UNPOOLED` (direct) for `drizzle-kit migrate` and `seed`, read as `DATABASE_URL_UNPOOLED ?? DATABASE_URL`. Preview values are injected per deployment; presence during the build is implied by Neon's examples, not stated.
- Driver: keep postgres.js (module-scope client, about `max: 5, idle_timeout: 5, connect_timeout: 10`, `prepare` default). Not the Neon HTTP driver, which can't run seed's interactive transaction. Fallback: `pg` + `attachDatabasePool`, the documented path.
- pgvector migration and HNSW index work unchanged. `sin1` = `aws-ap-southeast-1` (Singapore); the Neon region is permanent. Free: 1 GB, 100 CU-hours, suspends after 5 idle minutes, wakes in a few hundred ms.
- Open: a separate Neon account is needed; postgres.js vs `pg`; verify on the first preview.
