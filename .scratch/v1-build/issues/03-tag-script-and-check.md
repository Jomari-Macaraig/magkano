# 03: Tag script and check

**What to build:** The project owner can run `tag` to have the LLM propose a Tag Assignment for every Ingredient and Commodity that lacks one. They can then run `tag --check`, which accepts proposals that agree with the existing reviewed Tags, leaves only the disagreements to review, and prints the tagger's agreement rate. This ticket also brings in the reviewed Tag vocabulary and the 20 Seeded Recipes. Spec: "Data files and scripts" (`tags.ts`, `recipes.ts`, `tag-assignments.json`, `reference-tags.json`, `tag`, `tag --check`), "Models and vectors". Ready-made vocabulary, Recipes and reviewed Tags are available (see project memory).

**Blocked by:** 02 (Extract DA and DTI Publications), because Commodity keys come from the Publication files.

**Status:** resolved

- [x] The type-checked Tag vocabulary (174 Tags, with aliases and Unit Conversions) and the 20 Seeded Recipes, which carry **no Tags**, are committed as hand-edited TypeScript data.
- [x] `reference-tags.json` holds the existing reviewed Tags, keyed `ingredient:<recipe seed key>:<normalised name>` and `commodity:<commodity key>`.
- [x] `tag`:
  - sends every item with no entry to `gpt-6-luna` in batches, using Structured Outputs with the vocabulary as a strict enum;
  - includes the Recipe name with each Ingredient and the DA/DTI category with each Commodity;
  - writes `{ tag, proposedNewTag, status: "proposed" }` with stable JSON formatting.
- [x] `tag` also:
  - re-asks for any slug not in the vocabulary;
  - never changes a `reviewed` entry;
  - reports entries whose item no longer exists;
  - exits non-zero while anything is `proposed`.
- [x] `tag --check` marks agreements with the reference as `reviewed`, prints each disagreement next to its reference Tag, and prints the agreement rates for Ingredients and for Commodities.
- [x] Unit tests with a stubbed OpenAI client cover: unknown slug re-asked, reviewed entries untouched, stale entries reported, and `--check` marking and rates. No test calls OpenAI.

## Comments

Resolved. `pnpm tag` / `pnpm tag --check` are documented in `apps/api/src/tagging/CLAUDE.md`. Data: `apps/api/data/tags.ts` (174 Tags), `recipes.ts` (20 Recipes, 177 Ingredients, no Tags), `reference-tags.json` (454 reviewed Tags: 177 Ingredients and 277 Commodities, covering every current item). `tag-assignments.json` doesn't exist yet: the first `tag` run is ticket 04.

Beyond the ticket: a failed request or a missing answer is retried like an unknown slug (3 attempts), and what is still left is reported and makes `tag` exit 1, while the answers already received are written. `--check` accepts an agreement only when it carries no `proposedNewTag`, lists proposals with no reference entry, and refuses to run before `tag`.
