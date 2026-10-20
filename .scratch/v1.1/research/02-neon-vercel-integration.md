# Research: the Neon–Vercel integration, and connecting from Functions and the build

Ticket: [../issues/02-neon-vercel-integration.md](../issues/02-neon-vercel-integration.md). Sources were read on 2026-10-21. Every claim cites the page it came from. A claim marked **(inference)** is not stated in a source and is my reading.

## Sources

- [N1] Neon, *Vercel-Managed Integration*: https://neon.com/docs/guides/vercel-managed-integration
- [N2] Neon, *Neon-Managed Vercel Integration*: https://neon.com/docs/guides/neon-managed-vercel-integration
- [N3] Neon, *Vercel previews integration* (Neon-managed preview branching): https://neon.com/docs/guides/vercel-previews-integration
- [N4] Neon, *Vercel overview* (comparison of the two integrations): https://neon.com/docs/guides/vercel-overview
- [N5] Neon, *Preview branches with the Vercel-native integration*: https://neon.com/docs/guides/vercel-native-integration-previews
- [N6] Neon, *Connecting to Neon from Vercel*: https://neon.com/docs/guides/vercel-connection-methods
- [N7] Neon, *Connection pooling*: https://neon.com/docs/connect/connection-pooling
- [N8] Neon, *Serverless driver*: https://neon.com/docs/serverless/serverless-driver
- [N9] Neon, *Drizzle migrations*: https://neon.com/docs/guides/drizzle-migrations
- [N10] Neon, *pgvector*: https://neon.com/docs/extensions/pgvector
- [N11] Neon, *Manage branches*: https://neon.com/docs/manage/branches
- [N12] Neon, *Plans*: https://neon.com/docs/introduction/plans
- [N13] Neon, *Scale to zero*: https://neon.com/docs/introduction/scale-to-zero
- [N14] Neon, *Regions*: https://neon.com/docs/introduction/regions
- [V1] Vercel, *Global network and regions*: https://vercel.com/docs/regions
- [V2] Vercel, *Connection pooling with Vercel Functions*: https://vercel.com/guides/connection-pooling-with-functions
- [P1] postgres.js README: https://github.com/porsager/postgres

## Two integrations, and which to pick

Neon offers two integrations, and one Vercel project can't use both [N1]:

| | Vercel-Managed (Marketplace) | Neon-Managed |
|---|---|---|
| Account and billing | Neon account created by Vercel, billed on the Vercel invoice [N4] | Existing Neon account, billed by Neon [N4] |
| Plan and region | Chosen in the Vercel dashboard during install; plan changes only there [N1] | Neon Console |
| Preview cleanup | **When the Vercel deployment is removed.** Vercel keeps previews 6 months by default, which "can delay branch deletion by months" [N1][N4] | **When the Git branch is deleted** (option "Automatically delete obsolete Neon branches"), not affected by Vercel retention [N2][N3] |
| CLI | `neon login` doesn't work; use an API key [N1] | Normal |

**Recommendation: the Neon-Managed integration**, with automatic cleanup on. The Free plan allows 10 branches per project [N12]. Under the Vercel-Managed integration every PR's branch lives as long as its deployment (6 months by default), so about nine PRs would exhaust the cap and new previews would fail to get a branch. Git-branch-based cleanup frees a branch shortly after its PR merges, provided the Git branch is deleted (turn on GitHub's "Automatically delete head branches").

## Branch per preview

- **When it's created:** on each Preview Deployment. Vercel sends Neon a webhook when the deployment starts, and Neon creates a branch named `preview/<git-branch>` [N1][N2][N5]. Turn on "Required → Preview" and "Resource must be active before deployment" so Vercel waits until the branch is ready [N1][N5].
- **Per deployment or per Git branch:** the name is keyed by Git branch (`preview/<git-branch>`) [N2][N3]. No page says whether a second push to the same PR reuses that branch or recreates it. **(inference)** A name keyed by Git branch implies one Neon branch per Git branch, reused across pushes. Our build migrates and reseeds on every deploy anyway, so either behaviour gives correct data.
- **What it's branched from:** the integration pages don't name the parent [N1][N2][N5]. Neon's branch docs say a branch created "without specifying the parent" comes from the project's default branch [N11], and Neon's search-indexed integration pages describe the preview branch as a copy of the default branch. Here that is production `main`, a copy-on-write clone of its data and schema [N11].
- **When it's deleted:** Neon-Managed deletes it after the Git branch is deleted, "the next time a preview deployment is created" (cleanup is lazy) [N2][N3]. Renaming the Git or Neon branch breaks the name matching. A preview branch that has child branches is never deleted automatically [N3]. Vercel-Managed deletes it when its deployments are removed [N1].
- **Development:** connecting the Development environment also creates a `vercel-dev` branch, cloned from `main` [N3]. **Recommendation:** don't select Development. Local dev stays on Docker, and leaving it out keeps a branch slot free.

## Env vars

Injected names [N1][N2][N5]:

- `DATABASE_URL`: pooled (PgBouncer, `-pooler` host [N7]). Neon calls it "recommended for most apps" [N2].
- `DATABASE_URL_UNPOOLED`: direct connection, "for tools that need direct database access" [N2].
- `PGHOST`, `PGHOST_UNPOOLED`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, plus legacy `POSTGRES_*` [N1].

Scoping: Production (and Development, if chosen) get these as ordinary project variables. For a Preview, the branch's variables are injected at deployment time "for that specific deployment only". They override Preview variables and don't appear in the Vercel env settings [N1][N2]. Neon's own example runs `prisma migrate deploy` in the Vercel build command [N2][N3], so the variables exist during the build. No page says this outright, so verify it on the first preview.

**Which one each consumer uses:**

| Consumer | Variable | Why |
|---|---|---|
| `drizzle-kit migrate` (build) | `DATABASE_URL_UNPOOLED` | Neon: use a direct connection for migrations; a pooled one "can lead to errors" [N9][N7] |
| `pnpm seed` (build) | `DATABASE_URL_UNPOOLED` | A single long transaction that runs `TRUNCATE` and bulk inserts. It's a one-off client, so pooling gains nothing |
| The API Function | `DATABASE_URL` | Many short-lived instances; PgBouncer allows `max_client_conn=10000` [N7] |

**Repo change:** `drizzle.config.ts` and `scripts/seed.ts` should read `process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL`. Local `.env` only sets `DATABASE_URL`, so local dev doesn't change.

## Driver inside the Vercel Node Function

What the sources say:

- With Fluid compute, Neon recommends "a standard Postgres TCP connection" with a pool, the "fastest and most robust method". Its example uses `pg` + `drizzle-orm/node-postgres` + `attachDatabasePool(pool)` from `@vercel/functions` [N6]. A pooled TCP connection takes about 8 round-trips to set up (HTTP about 3), but after that it is "the lowest-latency" option [N6].
- Vercel: create the pool in global scope. `attachDatabasePool` closes idle connections before the instance suspends. Use an idle timeout of about 5 s and don't set the max to 1 [V2]. Vercel's examples use `pg`; postgres.js isn't mentioned, so whether `attachDatabasePool` accepts a postgres.js client is unconfirmed [V2].
- `@neondatabase/serverless` over HTTP supports only non-interactive transactions (`sql.transaction([...])`). Interactive transactions need `Pool`/`Client` over WebSockets [N8]. Neon suggests it for classic, non-Fluid serverless [N6].
- Prepared statements: Neon's PgBouncer supports protocol-level prepared statements (≥1.22), not SQL `PREPARE` [N7]. postgres.js uses protocol-level named statements by default, and its README says PgBouncer ≥1.21 supports them "when configured properly" [P1]. **So `prepare: false` isn't required**, though it's a safe fallback if a preview shows "prepared statement … does not exist" errors.
- Pooled connections don't support session `SET`, `LISTEN/NOTIFY` or session advisory locks [N7]. The API uses none of them **(inference, from reading `apps/api/src`)**.
- postgres.js defaults: `max` 10, `idle_timeout` 0, so connections stay open until `.end()` [P1].

**Recommendation: keep postgres.js and drizzle-orm/postgres-js** (one driver for local, build and Function; no code rewrite). In the Function, create the client once at module scope against `DATABASE_URL` with `{ max: 5, idle_timeout: 5, connect_timeout: 10 }`. Keep `prepare` at its default. Keep `onnotice` silenced. `createDb` can take these options from the Vercel entry while the local server keeps `max: 10`. A larger `connect_timeout` covers the compute wake after scale-to-zero. If `attachDatabasePool` turns out to matter (connections left open at suspend), the fallback is to switch only the Function to `pg` + `node-postgres`, which is Neon's documented path [N6]. Don't use `@neondatabase/serverless` HTTP: it would break the interactive `db.transaction` in `seed` (`write.ts`) [N8], and it brings no benefit under Fluid compute.

**The seed transaction:** `writeSeedPlan` runs one interactive `db.transaction` (TRUNCATE … RESTART IDENTITY, then the inserts). Over the direct `DATABASE_URL_UNPOOLED` it behaves exactly as it does locally. Through the pooler it would also work, because PgBouncer transaction mode pins one server connection for the length of a transaction [N7]. Direct is still the right choice, since migrations need it anyway.

## pgvector

- Neon supports `CREATE EXTENSION IF NOT EXISTS vector;`, installed per database [N10]. Migration `0000_enable-pgvector.sql` already does exactly this, so it works unchanged when run as a migration over the direct connection.
- HNSW on `vector` supports up to 2,000 dimensions [N10]. `recipe_chunks.embedding vector(1536)` with `USING hnsw (embedding vector_cosine_ops)` (in `0001_tables.sql`) is within that limit. Neon advises `maintenance_work_mem` close to the working-set size, and no more than 50–60% of compute RAM [N10]. A few hundred 1536-dim rows need no tuning **(inference)**.
- **Into branches:** a branch is a copy-on-write clone of its parent's data, and contains the parent's databases and roles [N11]. An extension and its indexes are objects inside the database, so a preview branch starts with `vector`, the tables, the HNSW index and the `__drizzle_migrations` journal already present **(inference; no page says so in these words)**. `drizzle-kit migrate` then applies only the PR's new migrations, and `IF NOT EXISTS` keeps `0000` harmless either way.

## Free plan limits that matter [N12][N13]

| Limit | Free | Effect on Magkano |
|---|---|---|
| Branches | **10 per project**; creation fails at the cap | `main` + open PR previews (+ `vercel-dev` if Development is connected). The deciding reason for the Neon-Managed integration |
| Storage | 1 GB per project (20 GB per account) | Data files are about 1.4 MB (embeddings.json about 1.2 MB). Copy-on-write branches add only their deltas, though a full reseed rewrites every row, so each preview's delta is about the size of the dataset **(inference)**. Far under 1 GB |
| Compute | 100 CU-hours per project per month (400 h at 0.25 CU); autoscaling up to 2 CU | Shared by every branch in the project **(inference from "per project")**. Fine for low traffic with scale-to-zero. Builds and previews spend from the same pool |
| Scale to zero | After 5 min idle, **fixed on Free**; wakes "within a few hundred milliseconds" | The first request to production or a preview after 5 idle minutes pays the wake. Each build's migrate also wakes the branch |
| Restore history | 6 h | Short, but the database is rebuilt from committed files, so restore matters little |
| Egress | 5 GB per project per month | Fine |
| Archiving | Inactive branches are archived automatically [N11][N12] | A stale preview may be slower on first touch |

## Region

- Neon `aws-ap-southeast-1` is AWS Asia Pacific (Singapore). A project's region **cannot be changed** after creation [N14], so pick it correctly at project creation (in the Vercel dialog if using Vercel-Managed [N1]).
- Vercel `sin1` is AWS `ap-southeast-1`, Singapore [V1], the same AWS region as the database. Functions **default to `iad1`** (Washington, D.C.), and Vercel says to run them in the same region as the database [V1]. So set `"regions": ["sin1"]` in `vercel.json` (or in the project's Functions settings), or every query crosses the Pacific.
- Build location: I found no Vercel source saying where builds run. If builds run in the US, the build's migrate and seed pay transpacific round-trips for each statement. That makes the seed slower but still correct. Measure it on the first deploy.

## Concrete recommendations for this repo

1. Use the **Neon-Managed** integration: Neon project in `aws-ap-southeast-1`, production on the default branch `main`. Connect **Production and Preview only**. Turn on "Required → Preview", "Resource must be active before deployment" and "Automatically delete obsolete Neon branches". Turn on GitHub's "Automatically delete head branches". These go in the wizard ticket.
2. `drizzle.config.ts` and `scripts/seed.ts`: use `DATABASE_URL_UNPOOLED ?? DATABASE_URL`. The Function uses `DATABASE_URL` (pooled).
3. Keep postgres.js. Let `createDb` accept pool options. The Vercel entry builds one module-scope client with `max: 5, idle_timeout: 5, connect_timeout: 10`, with `prepare` left at its default.
4. Keep `0000_enable-pgvector.sql` as is. No migration changes are needed for Neon.
5. `vercel.json`: `"regions": ["sin1"]`.
6. Set no `DATABASE_URL` by hand in Vercel. The integration owns it in every environment.

## Open decisions

- **Neon-Managed or Vercel-Managed?** The recommendation is Neon-Managed because of the 10-branch cap. It means a separate Neon account and bill (Free plan, so no bill at first). Does the owner accept that?
- **Function driver:** postgres.js without `attachDatabasePool` (the recommendation), or `pg` + `attachDatabasePool`, which is what Neon and Vercel document? This depends on ticket 01's Function entry.
- Verify on the first preview: the injected variables are present during the build, and the branch is reused across pushes to one PR.
