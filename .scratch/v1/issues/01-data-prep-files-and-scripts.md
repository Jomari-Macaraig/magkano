# Define the v1 data prep files and scripts

Type: grilling
Status: resolved
Blocked by: none

## Question

What exactly are the reviewed data files, and what do the `extract`, `tag` and `seed` scripts do with them?

Covers:
- **Extract**: the shape of the Commodities file produced from the DA and DTI PDFs (fields per Commodity, the Publication it came from with its date, the price, price basis, Purchase Unit default, parsed piece weight). Is it one file per Publication? How is a row marked reviewed, and what happens when it is re-run on the same PDF?
- **Tag**: the shape of the Tag Assignment review file for Commodities and Ingredients. How a proposal is approved or corrected, and what happens to `proposedNewTag` (add the Tag to the vocabulary file by hand?). What validation runs Also covers whether existing reviewed Commodity Tags should pre-fill the reviewed Tag Assignments.
- **Seed**: what it loads, in what order, and what it checks (every Tag slug exists, every Commodity used for pricing has a reviewed Tag Assignment). Whether it is idempotent (wipe and reload vs upsert), and how embeddings are produced: at seed time from OpenAI each run, or cached in a file so a re-seed needs no API call.
- Where the files live in `apps/api`, and which ready-made reviewed files are brought in as-is.

## Answer

Resolved by grilling, 2026-10-21. Every recommendation was accepted. For Q3 the user chose the real LLM run.

**Where the data lives**
- The committed files under `apps/api/data/` are the permanent record of the reviewed dataset. Postgres is a copy that `seed` rebuilds from them.
- Why: seeding wipes the database, a review must survive re-seeds, review happens as a git diff, and any new database (a teammate's machine, tests, the v1.1 deploy) gets identical data with no OpenAI calls.
- This covers the **initial** dataset only. v4 ingestion may write straight to the database.

**Formats**
- Files edited by hand are TypeScript, so `tsc` catches typos and comments are allowed. That covers the Tag vocabulary with its Unit Conversions (`tags.ts`) and the 20 Seeded Recipes (`recipes.ts`, which holds **no Tags**). Both come in ready-made.
- Files scripts write are JSON with stable formatting, checked with zod when seed loads them.

**`extract <pdf>`**: one file per Publication
- It writes `data/publications/<da|dti>-<YYYY-MM-DD>.json`.
- **Publication:** source, title, publication date, file hash.
- **Commodities:** category, name, spec, origin, brand, size label, price in centavos or `null` for `n/a`, price basis, default Purchase Unit, count unit and weight.
- **Dropped rows:** each with its reason.
- Deterministic parsing and filters, failing loudly on layout surprises. There's no per-row "reviewed" marker: you review by reading the file or its diff, then commit. Re-running on the same PDF rewrites an identical file. v1 extracts only the two sample PDFs.

**`tag`**: Tag Assignments
- **One file for both kinds of item:** `data/tag-assignments.json`.
  - Keys: `ingredient:<recipe seed key>:<normalised name>` and `commodity:<source>:<category>:<name>:<spec>`.
  - Entry: `{ tag: slug | null, proposedNewTag: string | null, status: "proposed" | "reviewed" }`.
- **What it does:**
  - It sends every Ingredient and Commodity with no entry to `gpt-6-luna`, with the vocabulary as a strict enum. Ingredients go with their Recipe name; Commodities go with their DA/DTI category.
  - It writes the results as `proposed`.
  - It re-asks for any slug not in the vocabulary.
  - It never changes a `reviewed` entry.
  - It reports entries whose item no longer exists, and exits non-zero while anything is still `proposed`.
- **How you review:**
  - To approve, set `status: "reviewed"`, correcting `tag` first if it's wrong.
  - For a `proposedNewTag`, add that Tag to `tags.ts` yourself, then point the entry at it.
  - A reviewed `tag: null` means no Tag fits, so the line will show as needing a price.
- **First run is a real LLM run over everything.** The existing reviewed Tags are committed for now as `data/reference-tags.json`, keyed the same way.
  - `tag --check` marks every proposal that agrees with its reference Tag as `reviewed`, and leaves disagreements `proposed` with the reference Tag shown alongside.
  - It also prints the agreement rate for Ingredients and for Commodities: the first real measure of the tagger's accuracy.
  - You settle the disagreements, then `reference-tags.json` is deleted.
  - Cost: about $0.05.

**`seed`**: wipe and reload
- Everything runs in one transaction, loading every file each time. The database is local and holds no user data in v1.
- **Checks first.** If any fails, it lists every problem and changes nothing:
  - the vocabulary is at most 3 levels deep, with no cycles and no duplicate aliases (case-insensitive);
  - every slug used exists;
  - every Ingredient and every Commodity has a `reviewed` Tag Assignment.
- **Recipe ids stay the same across re-seeds**, so a Draft saved on the device keeps working. How they stay stable is for [Trim the data model and API to v1](02-trim-data-model-and-api.md).
- **Embeddings:**
  - Two chunks per Recipe.
  - Cached in a committed `data/embeddings.json` (a hash of the chunk text mapped to a 1536-dimension vector).
  - Seed calls OpenAI only for chunks that aren't cached yet and writes the new vectors back, so a re-seed makes no API call. The file is about 0.6 MB.
  - Tags get no embeddings.

**Order of data prep**: `extract` (both PDFs) → `tag` → `tag --check` → review → `seed`. `OPENAI_API_KEY` comes from a gitignored `.env`.
