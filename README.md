# Magkano

Magkano ("how much?") helps Filipino households build a grocery list with price estimates. Pick one or more recipes, set the servings, and Magkano prices each ingredient against the latest government price lists: the DA Bantay Presyo Daily Price Index and DTI suggested retail prices.

Live at **https://magkano.online**.

## Features

- **Recipe search**: semantic search over Filipino recipes (OpenAI embeddings), with a plain text-matching fallback when no API key is set.
- **Recipe pages**: ingredients rescaled to any number of servings (1–20).
- **Grocery List**: combine several recipes into one list. Each line shows what you need, what you'll actually buy (rounded up to a real purchase unit, like ¼ kg or one can), its price source and a running total.
- **Per-line control**: mark items you already have, pick a different matching product, or enter your own price.
- **No account needed**: the list is kept on your device and survives a refresh. Sign-in (Clerk) is available but nothing is gated behind it.

## Tech stack

| Part | Tools |
| --- | --- |
| Web app (`apps/web`) | Vite, React 19, React Router, Clerk |
| API (`apps/api`) | Hono, Drizzle ORM, zod, typed Hono RPC client |
| Database | Postgres 17 with pgvector |
| Data pipeline | PDF extraction (pdfjs), OpenAI tagging and embeddings |
| Tooling | pnpm workspace, TypeScript, Vitest, Biome |
| Hosting | Vercel (web + API function), Neon (Postgres), Clerk (auth) |

## Local setup

### Prerequisites

- **Node.js 22**
- **pnpm 10** (`corepack enable` will pick up the version pinned in `package.json`)
- **Docker** (runs the local Postgres)
- A **Clerk** account with a development instance (free) for the publishable key
- Optional: an **OpenAI API key**, for semantic search

### 1. Clone and install

```bash
git clone https://github.com/Jomari-Macaraig/magkano.git
cd magkano
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Then edit `.env`:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | The default already points at the local Docker Postgres (`localhost:5435`). Leave it as is. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | From your Clerk development instance (**API Keys** page, starts with `pk_test_`). The web app won't start without it. |
| `OPENAI_API_KEY` | No | Turns on semantic search. Without it, search falls back to text matching. |
| `API_PORT` | No | Port for the local API. Defaults to `8787`. |

Leave `DATABASE_URL_UNPOOLED` unset locally; it's only used on Neon.

### 3. Start the app

```bash
pnpm dev
```

This one command:

1. Starts Postgres with pgvector in Docker on port **5435** (compose project `magkano-local`, so it won't clash with other Postgres containers)
2. Applies the database migrations
3. Runs the API on http://localhost:8787 and the web app on http://localhost:5173

The web dev server proxies `/api` to the API, so you only need to open **http://localhost:5173**.

### 4. Load the data

In a second terminal, the first time (and again whenever the files under `apps/api/data/` change):

```bash
pnpm seed
```

This checks every data file, then wipes and reloads the database in one transaction. Recipe embeddings are cached in `apps/api/data/embeddings.json`, so seeding doesn't need an OpenAI key unless a recipe's text has changed.

Refresh the browser and you should see the recipes.

### Stopping

Stop `pnpm dev` with `Ctrl+C`, then shut down the database:

```bash
pnpm db:down
```

Your data stays in a Docker volume between runs.

### Troubleshooting

- **Port 5435 already in use**: another service has the port. Stop it, or change the host port in `compose.yml` and `DATABASE_URL` to match.
- **Blank page / error about Clerk**: `VITE_CLERK_PUBLISHABLE_KEY` is missing or wrong in `.env`. Restart `pnpm dev` after fixing it.
- **No recipes shown**: run `pnpm seed`.
- **"Basic search" note on results**: `OPENAI_API_KEY` isn't set, so search is using text matching. This is expected.

## Scripts

Run from the repo root.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start Postgres, migrate, run API + web |
| `pnpm seed` | Check the data files and reload the database |
| `pnpm test` | Run all tests (Vitest). No database or network needed. |
| `pnpm typecheck` | Type-check every package |
| `pnpm lint` / `pnpm format` | Check / fix formatting and lint (Biome) |
| `pnpm db:up` / `pnpm db:down` | Start / stop the local Postgres |
| `pnpm db:generate` | Generate a migration after editing `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm extract <pdf>` | Parse a DA or DTI price PDF into `apps/api/data/publications/` |
| `pnpm tag` | Propose tags for new or renamed items (needs `OPENAI_API_KEY`) |

## Updating prices

1. Download the latest DA Daily Price Index or DTI SRP bulletin PDF (examples are in `sample/`).
2. `pnpm extract path/to/file.pdf` to write a Publication JSON file.
3. `pnpm tag` to tag any new items, then review `apps/api/data/tag-assignments.json`.
4. `pnpm seed` to load it, and commit the changed data files.

## Project structure

```
apps/
  api/          Hono API, Drizzle schema + migrations, extract/tag/seed scripts
    data/       The committed dataset (recipes, tags, publications, embeddings)
  web/          Vite + React single-page app
api/index.ts    Vercel Function entry for the API
deploy/         Deployment notes and the setup wizard
docs/adr/       Architecture decision records
GLOSSARY.md     Domain terms (Recipe, Draft, Commodity, Purchase Unit, ...)
sample/         Example DA and DTI PDFs
```

The committed files under `apps/api/data/` are the source of truth; Postgres is a copy that `pnpm seed` rebuilds.

## Deployment

Production runs on Vercel with Neon Postgres and Clerk, with a preview deployment for each pull request. See [deploy/CLAUDE.md](deploy/CLAUDE.md) for the full setup, and `deploy/setup.sh` for the guided owner setup.
