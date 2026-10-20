# Research the Neon–Vercel integration and connecting from Functions and the build

Type: research
Status: open
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
