# tagging

`pnpm tag` has `gpt-6-luna` propose a Tag Assignment for every Ingredient and Commodity without one; `pnpm tag --check` accepted proposals that agreed with `data/reference-tags.json` during the first review. The result is `data/tag-assignments.json` (committed, fully reviewed), read by `seed`.

## Run

- `pnpm tag` (root) or `pnpm --filter @magkano/api tag`. Reads `OPENAI_API_KEY` from the root `.env`; the key is needed only when some item has no entry. The first full run is about 454 items (177 Ingredients, 277 Commodities) and costs about $0.05.
- `pnpm tag --check`: no OpenAI call. Prints each disagreement next to its reference Tag, any proposal with no reference entry, and `Ingredients agree: a/b (x%)` / `Commodities agree: …`. Used once, for the first review: `reference-tags.json` is now deleted, so it fails with a clear message.
- Both exit 1 while anything is `proposed`; `tag` also exits 1 when an item is left untagged. Both rewrite the file with stable formatting (sorted keys, fixed field order).
- Review: set `status: "reviewed"`, correcting `tag` first if wrong. For a `proposedNewTag`, add the Tag to `data/tags.ts`, then point the entry at it. A reviewed `tag: null` means no Tag fits.

## Data flow

`data/recipes.ts` + `data/publications/*.json` → `taggingItems` (key, text, context) → `runTag` (skips every key that has an entry, batches of 40, re-asks bad answers) → `formatTagAssignments` → `tag-assignments.json`. During the first review only, `runCheck` compared it against `reference-tags.json`.

## Key files

- `tag.ts`: `runTag({ items, tagSlugs, assignments, client, batchSize? })` → `{ assignments, unresolved, stale }`. Items with an entry (reviewed or proposed) are never sent or changed. A slug outside the vocabulary, a missing answer or a failed request is asked again, up to 3 attempts; leftovers go to `unresolved` and get no entry, while everything answered is kept. `stale` lists entries whose item no longer exists; they are reported, not deleted.
- `check.ts`: `runCheck(assignments, reference)` → `{ assignments, disagreements, noReference, rates }`. Only `proposed` entries are compared; an equal Tag (including both null) with no `proposedNewTag` becomes `reviewed`. Rates count the proposals that had a reference entry, split by `ingredient:` / `commodity:`.
- `files.ts`: keys (`ingredient:<seed key>:<normalised name>`, `commodity:<commodity key>`), `normaliseName`, `taggingItems`, zod schemas for `tag-assignments.json` and the old reference file, `formatTagAssignments`, `loadPublicationFiles`.
- `openai.ts`: the `TaggingClient` interface (tests stub it; no test calls OpenAI) and `createOpenAiTaggingClient`: chat completions with a strict `json_schema` whose `tag` is an enum of every slug, `reasoning_effort: "low"`. Requests use short refs (`"0"`, `"1"`, …) that `runTag` maps back to keys. The SDK is built lazily, so a run with nothing to tag needs no key.
- `../../scripts/tag.ts`: the CLI (file I/O and printing only).

## Data files (`apps/api/data/`)

- `tags.ts`: the reviewed vocabulary (174 Tags; slug, name, optional parent, aliases, Unit Conversions as `g` / `ml` per unit). Hand-edited.
- `recipes.ts`: the 20 Seeded Recipes; Ingredients are `[name, quantity | null, unit | null, { optional?, prepNote? }]`, with **no Tags**. Renaming an Ingredient changes its key, so `tag` proposes it again and reports the old entry as stale.
- `tag-assignments.json`: `{ [key]: { tag, proposedNewTag, status } }` for every current item, all `reviewed`. First pass: 96.0% Ingredient / 97.8% Commodity agreement with the old reference; all 13 disagreements went to the reference Tag (see ticket 04).
- `reference-tags.json`: deleted after the first review.

## Tests

`tag.test.ts` (stubbed client: proposals, re-ask, persistent unknown slug, failed requests, entries untouched, stale, no call when complete), `check.test.ts` (marking, disagreements, reviewed untouched, no reference, rates), `files.test.ts` (keys from the real data match `tag-assignments.json` exactly, its slugs exist, everything reviewed, formatting).
