# Trim the data model and API to v1

Type: grilling
Status: resolved
Blocked by: 01

## Question

Which Postgres tables (in Drizzle) and which Hono endpoints does v1 need, at the smallest size that still serves v1?

Covers:
- Tables and key columns: Tags, aliases, Unit Conversions, Recipes, Ingredients, Recipe chunks, Publications, Commodities and prices. There are no users, saved Grocery Lists, rate limits, query cache or `pending` status. Is `price_observations` needed when there is no ingestion yet, or is one price per Commodity plus its Publication enough? Which columns stay so v2–v4 can add without a destructive migration?
- Endpoints: search, Recipe view, the pricing endpoint for a Draft, and anything the line page needs. Their request and response shapes, the `droppedRecipeIds` behaviour, Draft size caps and the error shape.
- The Draft in browser storage: what is stored, what happens to line state for a Tag that is no longer on the Draft, and what happens when a stored Recipe id no longer exists after a re-seed.
- Search fallback behaviour when OpenAI is unavailable, and how the response signals it.

## Comments

- From [Define the v1 data prep files and scripts](01-data-prep-files-and-scripts.md): `seed` wipes and reloads every table in one transaction from files under `apps/api/data/`, so the schema needs no upsert keys or history for seeding. **Recipe ids must stay the same across re-seeds**, because Drafts on the device hold them; this ticket decides how (for example the seed key as id, or a uuid derived from it). Commodity files carry: source, category, name, spec, origin, brand, size label, price in centavos or null, price basis, default Purchase Unit, and count unit and weight. Each Publication has a source, title, publication date and file hash. Recipe chunk embeddings come from a cache file. Tags have no embeddings.

## Answer

Resolved by grilling, 2026-10-21. Every recommendation was accepted. On the Recipe page the user first asked for a price estimate, then settled on none: prices appear only on the Grocery List.

**Stable ids** (seed wipes and reloads, so integer ids change on each run)
- A Seeded Recipe's id **is its seed key**: a text primary key such as `chicken-adobo`, also used in URLs (`/recipes/chicken-adobo`). In v3, user Recipes can put uuids in the same column.
- A Draft never stores integer ids:
  - Line state is keyed by **Tag slug**, or by the normalised Ingredient name when there's no Tag.
  - A picked match stores the **Commodity key** `<source>:<category>:<name>:<spec>`, the same key as in `tag-assignments.json`, kept as a unique `commodities.key`.

**Tables (9)**

| Table | Columns |
|---|---|
| `tags` | id, slug unique, name, parent_id |
| `tag_aliases` | tag_id, alias (unique, case-insensitive) |
| `unit_conversions` | tag_id, unit, amount, base_unit (g / ml), keyed by (tag_id, unit) |
| `recipes` | id text, name, description, servings |
| `ingredients` | id, recipe_id, position, name, quantity numeric(8,3) nullable, unit (the 15 fixed units) nullable, prep_note, optional, tag_id nullable |
| `recipe_chunks` | recipe_id, kind (title / ingredients), content, embedding vector(1536), keyed by (recipe_id, kind); HNSW `vector_cosine_ops` index |
| `publications` | id, source (DA / DTI), title, published_on, file_hash; unique on (source, published_on) |
| `commodities` | id, key unique, source, category, name, spec, origin, brand, size_label, price_basis amount + unit (g / ml / piece), purchase_unit amount + unit, count_unit (piece / head / bundle) and count_weight_g nullable, tag_id nullable |
| `price_observations` | commodity_id, publication_id, price_centavos, keyed by both |

- **Prices:**
  - Kept as observations: a Commodity's current price is its row from the newest Publication.
  - `n/a` writes no row, so a Commodity with no row has no price.
  - There's no `latest_prices` table. In v4, new Publications only add rows.
- Money is always integer centavos.
- **Not in v1:** `users`, Grocery List tables, rate-limit counters, the query-embedding cache, `proposed_tag`, `tagging_status`, Tag embeddings and the `verified` flag. Later versions add them without destructive migrations (for example a nullable `recipes.owner_id` in v3).
- The Tag tree is loaded into memory and cached by the API; ancestor chains are worked out there.

**Endpoints (4)**
- All anonymous with no Clerk middleware, using Hono RPC (`hc<AppType>`) with zod validators on one origin under `/api/*`.
- `GET /api/recipes`: every Recipe card (id, name, description, servings), sorted by name, for browsing.
- `GET /api/search?q=`: `{ fallback, results: card[≤8] }`. An empty query returns no results, and the page shows the browse list.
- `GET /api/recipes/:id`: the Recipe with its Ingredients and **no prices**. The Recipe page scales quantities on the client by the servings chosen there and offers "Add to list".
- `POST /api/price`: prices a Draft and is the only place price maths happens.
- **Errors** have the shape `{ error: code, message }`: 400 `invalid_input`, 404 `not_found`, 500 `internal`.

**`POST /api/price` request**
- `{ recipes: [{ id, servings 1–20 }] (≤20, unique ids), lines: { [lineKey]: { haveIt?, pickedCommodityKey?, overrideCentavos?, includeOptional? } } (≤200 entries) }`.
- Untouched lines aren't sent.
- Unknown Recipe ids are skipped and returned as `droppedRecipeIds`.
- State for a line key that isn't on the list is ignored.
- A `pickedCommodityKey` that is no longer an Ingredient Match falls back to the cheapest, with `pickUnavailable: true`.

**`POST /api/price` response**
- `recipes`: `[{ id, name, servings }]`, for the "Recipes on this list" strip, in request order.
- `total`: `{ centavos, counts: { priced, noPrice, haveIt, estimated, optionalExcluded } }`.
- `lines[]`, each with:
  - `key` and `name` (the Tag display name, or the Ingredient name if untagged);
  - `fromRecipes: [{ id, name, amount }]`;
  - `need` (amount + unit);
  - `optional`, `included`, `haveIt`;
  - `status`: `priced | noPrice | haveIt | optionalExcluded`;
  - the chosen price `{ commodityKey | null, buy, lineCentavos, rough, overridden }`;
  - `pickUnavailable`;
  - `matches[]`, cheapest first: `{ commodityKey, name, spec, source, publishedOn, publicationTitle, buy, unitPriceCentavos, lineCentavos, rough, cheapest }`.
- `droppedRecipeIds`.
- It holds everything the list screen, filters and line page need, so no extra calls are made.

**Draft on the device**
- `localStorage` key `magkano.draft.v1`, in the same shape as the price request.
- After each response, the client removes line state for keys no longer returned and drops `droppedRecipeIds`, with a toast.
- Unreadable or wrong-version data starts an empty Draft.
- It re-prices with a debounce of about 300 ms on every change.

**Search fallback**
- Text/alias matching is used when the OpenAI query embedding fails or takes over 3 s, or when `OPENAI_API_KEY` is unset.
- It's a case-insensitive substring match on Recipe names, Ingredient names and Tag aliases, ranked with title hits first.
- The response sets `fallback: true`, and the UI shows a small "basic search" note.
