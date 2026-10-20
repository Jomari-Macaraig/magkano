# 08: Semantic Recipe search

**What to build:** A shopper types into the search box on the home screen, in Tagalog or English, and gets up to 8 relevant Seeded Recipes: "adobo", "bawang", "something with pork". If the AI service is unavailable, results still come back from simple text matching, with a small "basic search" note. An empty box shows the browse list. Spec: "Search", "Data files and scripts → `seed` (embeddings)", "API contract → `GET /api/search`", user stories 2–8. Ready-made tested chunking and ranking are available to adapt (see project memory).

**Blocked by:** 05 (Seed, browse and view a Recipe). It can run alongside 06 and 07.

**Status:** resolved

- [x] **Two chunks per Recipe:**
  - title: name plus description;
  - Ingredients: each Ingredient as bilingual text, i.e. its display name plus its Tag's and ancestors' aliases.
- [x] **Embeddings in `seed`:**
  - `seed` embeds chunks with `text-embedding-3-large` at 1536 dimensions;
  - it uses a committed `embeddings.json` cache keyed by a hash of the chunk text, calling OpenAI only for new text and writing the new vectors back;
  - a re-seed with no changes makes no OpenAI call.
- [x] **Query handling:** known foods in the query (exact Tag aliases, longest first) are expanded with their aliases before embedding.
- [x] **Scoring:** Recipe score ≈ 0.6 × title + 0.4 × Ingredients by cosine similarity; at most 8 results; hide anything below 50% of the top score; ties go by name.
- [x] **`GET /api/search?q=`** returns `{ fallback, results }`:
  - an empty query returns no results;
  - it falls back to case-insensitive substring matching on Recipe names, Ingredient names and Tag aliases (title hits first) when embedding fails, takes over 3 s, or `OPENAI_API_KEY` is unset, and sets `fallback: true`.
- [x] **Search box:** debounced, showing results in place of the browse list, the "basic search" note when `fallback` is set, and the browse list when empty. Cards keep "+ Add" when ticket 06 is done.
- [x] **Unit tests:** chunk text and query expansion, scoring (weights, cap, cutoff), the fallback, and the embedding cache (no call when cached), all with a stubbed embedder.

## Comments

- Done. `pnpm seed` embedded the 40 chunks with `text-embedding-3-large` (1536 dimensions) into the committed `apps/api/data/embeddings.json` (keyed by SHA-256 of the chunk text); a second `pnpm seed` reported 0 newly embedded and made no OpenAI call. The cache keeps only vectors the current chunks use, so edited text drops its old vector. Checked against the real API: "adobo", "bawang"/"garlic", "manok"/"chicken", "something with pork" and "sour soup" put the expected Recipes first; with `OPENAI_API_KEY` empty every query answers `fallback: true` from text matching. Real cosine similarities sit close together (about 0.2–0.6), so the 50% cutoff rarely trims and most semantic queries return 8 cards, with the best matches on top. Beyond plain substring matching, the fallback also looks for every alias of each known food the query names, so "something with pork" finds the pork Recipes, and "manok" finds the Recipes titled "Chicken …" as title hits. Queries over 200 characters answer 400 `invalid_input`.
