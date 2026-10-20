# search

Semantic Recipe search behind `GET /api/search?q=`, plus the Recipe chunk vectors that `seed` builds. Answers `{ fallback, results }`: at most 8 Recipe cards (`{ id, name, description, servings }`).

## Data flow

- **Seed time:** `embedRecipeChunks(plan, cache, embed)` builds two chunks per Recipe and looks each text up in `data/embeddings.json` (SHA-256 of the text → 1536 numbers). Only texts that aren't there go to OpenAI. The returned cache holds exactly the vectors the current chunks use, so stale ones drop out. The seed CLI writes the file back, then `writeSeedPlan` inserts the chunks into `recipe_chunks` in the same transaction as everything else. A re-seed with no text changes makes no OpenAI call.
- **Query time:** `createRecipeSearch(deps).search(q)`:
  1. A query with no words returns `{ fallback: false, results: [] }` without embedding.
  2. `loadIndex()` reads the vocabulary and every Recipe with its Ingredients' Tags from Postgres, on every request; it's small.
  3. `expandQuery` follows each known food (an exact Tag alias, longest first) with its Tag's names: "something with pork (pork / baboy / karne ng baboy)".
  4. `embedQuery` embeds the expanded text. `similarities(vector)` gets the cosine similarity of each `recipe_chunks` row in Postgres (`1 - (embedding <=> vector)`).
  5. `rankBySimilarity`: score = 0.6 × title + 0.4 × Ingredients. At most 8 results, anything below 50% of the top score hidden, ties by name.
- **Fallback** (`fallback: true`): used when there is no embedder (no `OPENAI_API_KEY`), or embedding throws or takes over 3 s (`EMBED_TIMEOUT_MS`). `textSearch` matches case-insensitive substrings on Recipe names, Ingredient names and the aliases of each Ingredient's Tag and its ancestors. Besides the whole query, it also looks for every alias of each known food the query names, so "something with pork" also looks for "baboy". Title hits come first, then the rest, each by name; at most 8.

## Chunk text

- **Title:** `"<name>. <description>"`.
- **Ingredients:** `"Ingredients: <line>; <line>."`. Each line is the Ingredient name and its Tag's names, then each ancestor's names, with case-insensitive duplicates removed: `"liempo / Pork belly (a kind of Pork / baboy / karne ng baboy)"`. An untagged Ingredient is just its name.
- Any change to these strings, or to a Tag's aliases or a Recipe's text, changes the hashes, so the next `seed` re-embeds the affected chunks (about 40 in all, a fraction of a cent).

## Key files

- `chunks.ts`: `SearchTag` (aliases with the display name first), `recipeChunkTexts`, `expandQuery`, `findFoods` (longest alias first), `toWords` (lowercase, no accents or punctuation), `tagChain`.
- `rank.ts`: `rankBySimilarity` and its constants (`TITLE_WEIGHT`, `MAX_RESULTS`, `RELATIVE_CUTOFF`).
- `search.ts`: the `RecipeSearch` interface the route reads through, `createRecipeSearch(deps)` (embedding path, timeout, fallback) and `textSearch`.
- `embeddings.ts`: `embedRecipeChunks`, `chunkHash`, `formatEmbeddingCache` (sorted by hash, one entry per line), `parseEmbeddingCache` (zod; every vector must be 1536 long).
- `openai.ts`: `createOpenAiEmbedder(apiKey, { timeoutMs, maxRetries })` for `text-embedding-3-large` at `dimensions: 1536`. The SDK is built on the first call, so a fully cached seed needs no key. The server uses a 3 s timeout with no retries; seed uses 120 s with 2 retries.
- `store.ts`: `createPgSearchSource(db)`, which supplies `loadIndex` and `similarities` from Postgres.
- Wiring: `buildApp` (`src/build-app.ts`) builds the search (no embedder without `OPENAI_API_KEY`); `scripts/seed.ts` reads and writes `data/embeddings.json`.

## Tests

None need a database or the network; the embedder is always a stub.

- `chunks.test.ts`: chunk text and query expansion on the real vocabulary and Recipes.
- `rank.test.ts`: the weights, the cap of 8, the 50% cutoff and ties by name.
- `search.test.ts`: `textSearch` on the real data (Tagalog = English, title hits first, foods inside longer queries), and `createRecipeSearch` with stubs: the embedding path, the empty query, and the three fallbacks (no key, failure, a timeout using fake timers).
- `embeddings.test.ts`: the cache, which makes no call when everything is cached, embeds only new text, writes the new vector back and drops stale entries; also the file format round-trip.
- Route: `test/search.test.ts` with a stub `RecipeSearch`.
