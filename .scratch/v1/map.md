# Magkano v1 (2-hour rebuild)

Label: wayfinder:map

## Destination

A lean v1 spec at `.scratch/v1/spec.md` that `/to-tickets` can take with nothing left to decide. An agent should be able to build it from that spec in about 2 hours. v1 lets users search 20 Seeded Recipes, build a Draft, and see it priced from reviewed DA/DTI data.

## Notes

- **Product (v1)**:
  - Browse and semantically search 20 Seeded Recipes. View one and adjust its servings.
  - Add several Recipes to a Draft and see merged lines, need → buy in Purchase Units, line costs and a total.
  - On each line: cheapest Ingredient Match by default, pick another match, or set a Price Override; mark Have It.
  - Show each price's source and date; show no-price lines and Rough Estimates clearly.
  - Sign up, sign in and sign out with Clerk. The Draft lives on the device.
- **Stack (fixed)**: React + TypeScript (Vite), Hono + TypeScript, Drizzle, PostgreSQL + pgvector (local Docker), Clerk, OpenAI (`text-embedding-3-large` @1536, `gpt-6-luna` strict-enum tagging).
- **Build budget: about 2 hours from the spec, without lowering quality.** Pick the simplest option that keeps the behaviour correct and tested. Cut scope, not correctness.
- **Settled design**: the decisions under "Settled before charting" are fixed. Don't reopen them.
- **Vocabulary**: use the terms in `GLOSSARY.md`. Call `domain-modeling` when a ticket sharpens or adds a term.
- **Plan, don't build**: tickets produce decisions, not code.
- **Sample price PDFs** are in `sample/`.

### Settled before charting

- **Tags**: foods only, single-parent tree ≤ 3 deep, one Tag per item plus its ancestors, English slug and Tagalog aliases. Matching uses the same ancestor chain at the most specific shared Tag; siblings never match; a child must be usable in place of its parent (by-products are top-level).
- **Seeded Recipes**: the 20 dishes. Name, description, servings (4), Ingredients (display name, decimal or empty quantity, 15 fixed units, prep note, optional flag). Target servings 1–20, scaled linearly.
- **Pricing**: convert to g/ml/pieces; Unit Conversions on the Tag (inherited) and overridden by DA-parsed weights; Purchase Unit defaults per category; merge by Tag; round up to whole Purchase Units; default = lowest line cost after rounding (ties go to the lower unit price); unknown conversion → one Purchase Unit plus a Rough Estimate; empty quantity → one Purchase Unit.
- **PDF reading**: pdfjs-dist positional text, deterministic, no LLM. DA has one price per row, `n/a` = no price. Drop DTI non-food and water, DA feed grade, and non-Luzon/Nationwide DTI rows. Fail loudly on layout surprises.
- **Tagging context**: send the Recipe name with each Ingredient and the DA/DTI category with each Commodity. Schema `{items:[{ref, tag: enum|null, proposedNewTag}]}`.
- **Search chunks**: two chunks per Recipe (title + description; bilingual Ingredients with Tag and ancestor aliases), Recipe score ≈ 0.6 title + 0.4 Ingredients, at most 8 results, hide anything below 50% of the top score.
- **Grocery List screen**: line rows, line page, Have It, "estimate" pill, ₱ field on no-price lines, optional Ingredients not counted until added, picking a match clears a Price Override.
- **Pricing on the server**: the client posts the Draft (Recipes + target servings + line state keyed by Tag or untagged name) to one pricing endpoint and never does price maths. Money is in integer centavos.

### Settled while charting (no ticket)

- **Data is reviewed files in the repo** that `seed` loads into Postgres: the Tag vocabulary with Unit Conversions, Seeded Recipes, extracted Commodities and prices, and Tag Assignments. There is no admin CLI, upload endpoint, `fill-conversions` or `verified` flag.
- **Starting data**: a reviewed Tag vocabulary (about 175 Tags with Unit Conversions) and the 20 Seeded Recipes with reviewed Ingredient Tags are brought in ready-made.
- **AI tagging**: a tag script sends every item with no reviewed Tag Assignment to the LLM, validates the result, and writes proposals to a review file. A person reviews them. `seed` uses only reviewed Tag Assignments and fails when one is missing. In practice the LLM runs on the Commodities.
- **Search**: dish search only, with aliases expanded in the query and text/alias matching as the fallback. No "what I have" mode, Tag boost, query-embedding cache or rate limits.
- **Clerk is frontend-only**: no `users` table, webhook or protected API routes.
- **Repo**: pnpm workspaces with `apps/web` (Vite + React) and `apps/api` (Hono, which also holds the Drizzle schema, domain logic and the `extract`, `tag` and `seed` scripts). Types reach the web app through Hono RPC. Local only.
- **Grocery List screen, trimmed**: total card, one merged list with To buy / Needs price / Have it filters, a "Recipes on this list" strip with a servings stepper and Remove, and the full line page. No per-Recipe tabs.
- **Testing**: Vitest unit tests for pricing, matching, unit conversion and the parsers (against `sample/`). No Playwright, CI or API integration tests.
- **Leave room for later versions** without building them: no table or code that serves only v1.1–v5.

## Decisions so far

<!-- one line per closed ticket: [title](issues/NN-slug.md): gist -->

- [Define the v1 data prep files and scripts](issues/01-data-prep-files-and-scripts.md): committed files under `apps/api/data/` are the permanent record and Postgres is a copy (TypeScript for the hand-edited vocabulary and Recipes, JSON for script output); `extract` writes one JSON file per Publication; one `tag-assignments.json` for Ingredients and Commodities with proposed/reviewed status; the first `tag` run is a real `gpt-6-luna` pass checked against the existing reviewed Tags (agreements auto-reviewed, disagreements settled by hand, agreement rate printed); `seed` validates and then wipes and reloads in one transaction, with Recipe ids stable; embeddings are cached in a committed file, so a re-seed needs no API call.
- [Trim the data model and API to v1](issues/02-trim-data-model-and-api.md): Recipe id = seed key; Drafts store only Tag slugs and Commodity keys; 9 tables, with prices kept as `price_observations` (newest Publication wins); 4 anonymous endpoints (browse, search, Recipe with no prices, `POST /api/price` returning everything the list screen and line page need, with `droppedRecipeIds`); Draft in `localStorage` (`magkano.draft.v1`), cleaned up after each response; text/alias search fallback on OpenAI failure, after 3 s, or with no key.
- [Write the v1 spec](issues/03-write-v1-spec.md): [spec.md](spec.md) is written and ready for `/to-tickets`. Small gaps were confirmed (Recipe-page Add uses its servings, routes, Clerk header buttons, ₱ formatting), and the 2-hour budget counts agent build time only.

## Not yet specified

Nothing. The way is clear: the destination spec is written.

## Out of scope

- **v1.1**: deployment (Vercel, Neon, preview branches, migrations in the build).
- **v2**: saving, reopening, editing, renaming and deleting private Grocery Lists; the `users` table, Clerk backend middleware and webhook.
- **v3**: user Recipes (create, edit, Copy to my Recipes, delete), with tagging and embedding on save, `pending` tagging status, and save rate limits.
- **v4**: ongoing ingestion of later DA/DTI Publications (upload endpoint, price history, price-movement warnings).
- **v5**: "what I have" discovery (search mode, Tag overlap, pantry coverage, missing-Ingredient explanations).
- Native apps, regions outside NCR, public Recipes, users retagging items, and admin UIs.
