# seed

`pnpm seed` checks every data file, embeds any new Recipe search chunks, then wipes and reloads Postgres from them in one transaction. The committed files under `apps/api/data/` are the dataset; the database is a copy of them.

## Run

- `pnpm seed` (root) or `pnpm --filter @magkano/api seed`. Reads `DATABASE_URL` from the root `.env`; run `pnpm db:up && pnpm db:migrate` first.
- On success it prints the row counts. On any failure it prints every problem, exits 1 and leaves the database unchanged.
- Re-running gives the same database: `TRUNCATE … RESTART IDENTITY`, then inserts in a fixed order. Recipe ids are their seed keys, so they never change. Integer ids happen to repeat too, but nothing on the device may store them.

## Checks (all run, all problems listed)

- Every file passes its zod schema: `tags.ts`, `recipes.ts` (servings 1–20; a "to taste" Ingredient has no quantity and no unit), `tag-assignments.json`, each `publications/*.json`. Checks that depend on a file that failed its schema are skipped.
- Vocabulary: unique slugs, known parents, no parent cycles, at most 3 levels deep, aliases unique ignoring case (the display name counts as an alias).
- Unique Recipe seed keys, unique Commodity keys within a file, one Publication per (source, date).
- Every Ingredient and Commodity has a `reviewed` Tag Assignment, and every assigned slug exists.

## Data flow

`readSeedInput(dataDir)` reads the files → `runSeed(input, write)` (pure: checks, then builds a `SeedPlan` keyed by slugs and Commodity keys) → `writeSeedPlan(db, plan)` maps them to ids and loads:

- Tags (a level at a time, parents first), `tag_aliases` (display name + aliases), `unit_conversions` (from the Tag's `g` / `ml`);
- `recipes` (id = seed key) and `ingredients` (position, prep note, optional, Tag);
- `publications`, `commodities` (with Tag; a key in several Publications keeps the newest file's fields) and `price_observations` (an `n/a` price writes no row).

- `recipe_chunks`: two per Recipe (title, Ingredients) with their vectors. The CLI builds them from the plan with `embedRecipeChunks` before the write. It reuses vectors from `data/embeddings.json` and calls OpenAI (`text-embedding-3-large`, 1536 dimensions) only for new text, then writes the file back. A run with nothing new makes no call. If new text needs embedding and `OPENAI_API_KEY` is unset, or OpenAI fails, seed fails and the database is unchanged. See [../search/CLAUDE.md](../search/CLAUDE.md).

`runSeed` stays pure: embedding happens in the CLI's `write` callback, so seed tests need no embedder.

## Key files

- `seed.ts`: `runSeed`, the zod schemas for the hand-edited files, the checks and `SeedPlan`.
- `input.ts`: `readSeedInput(dataDir)`, shared by the CLI and the tests.
- `write.ts`: `writeSeedPlan(db, plan, chunks)`, the only code here that touches Postgres.
- `../../scripts/seed.ts`: the CLI (file reading, the embeddings cache, printing).

## Tests

`seed.test.ts` runs `runSeed` on the real dataset with a spy writer: the real data passes and plans the expected rows; each check failure is reported, problems from several checks are listed together, and the writer is never called on failure. The SQL is not unit-tested (v1 has no Postgres tests); it was checked by seeding twice and diffing `pg_dump`.
