# 03: Tag script and check

**What to build:** The project owner can run `tag` to have the LLM propose a Tag Assignment for every Ingredient and Commodity that lacks one. They can then run `tag --check`, which accepts proposals that agree with the existing reviewed Tags, leaves only the disagreements to review, and prints the tagger's agreement rate. This ticket also brings in the reviewed Tag vocabulary and the 20 Seeded Recipes. Spec: "Data files and scripts" (`tags.ts`, `recipes.ts`, `tag-assignments.json`, `reference-tags.json`, `tag`, `tag --check`), "Models and vectors". Ready-made vocabulary, Recipes and reviewed Tags are available (see project memory).

**Blocked by:** 02 (Extract DA and DTI Publications), because Commodity keys come from the Publication files.

**Status:** ready-for-agent

- [ ] The type-checked Tag vocabulary (about 175 Tags, with aliases and Unit Conversions) and the 20 Seeded Recipes, which carry **no Tags**, are committed as hand-edited TypeScript data.
- [ ] `reference-tags.json` holds the existing reviewed Tags, keyed `ingredient:<recipe seed key>:<normalised name>` and `commodity:<commodity key>`.
- [ ] `tag`:
  - sends every item with no entry to `gpt-6-luna` in batches, using Structured Outputs with the vocabulary as a strict enum;
  - includes the Recipe name with each Ingredient and the DA/DTI category with each Commodity;
  - writes `{ tag, proposedNewTag, status: "proposed" }` with stable JSON formatting.
- [ ] `tag` also:
  - re-asks for any slug not in the vocabulary;
  - never changes a `reviewed` entry;
  - reports entries whose item no longer exists;
  - exits non-zero while anything is `proposed`.
- [ ] `tag --check` marks agreements with the reference as `reviewed`, prints each disagreement next to its reference Tag, and prints the agreement rates for Ingredients and for Commodities.
- [ ] Unit tests with a stubbed OpenAI client cover: unknown slug re-asked, reviewed entries untouched, stale entries reported, and `--check` marking and rates. No test calls OpenAI.
