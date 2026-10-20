# pricing

`POST /api/price` and the one pricing function. All price maths in the app happens here; the web app only formats what comes back.

## Data flow

`createCatalogStore(db)` (`store.ts`) loads the whole Catalog from Postgres (Tags with their Unit Conversions, Recipes with Ingredients, Commodities with their newest price) and caches it for 60 s, so a re-seed shows up within a minute. Integer ids are mapped to Tag slugs, Recipe ids and Commodity keys there and never leave the server.

The route validates the body with `priceRequestSchema` (`request.ts`), then calls `priceDraft(catalog, request)` (`price.ts`), which is pure.

## `priceDraft`

1. Skips unknown Recipe ids into `droppedRecipeIds`; scales each Ingredient by target ÷ Recipe servings.
2. Merges by Tag slug, or `untagged:<normalised name>` (lowercased, trimmed, spaces collapsed). These are the line keys.
3. Finds Ingredient Matches with `buildTagTree(tags).matches` (`tags.ts`): same ancestor chain, kept at the most specific shared Tag; siblings never match.
4. Per match: converts each counted part to the match's Purchase Unit dimension (g / ml / piece). A Commodity's own count unit and weight beat the Tag's Unit Conversion, which is inherited down the chain. Rounds up to whole Purchase Units, and adds one Purchase Unit for each part whose unit can't be reached (setting `rough`, a Rough Estimate). "To taste" alone is one Purchase Unit. The line cost is units × the price of one unit rounded to the centavo, so the two always agree.
5. A `1 piece` Purchase Unit is one of the Commodity's count unit (one head, one bundle), priced ₱/kg × `countWeightG`.
6. Sorts matches by line cost, then price per base unit, unpriced last. The first priced one is `cheapest` and the default.
7. Applies line state: `pickedCommodityKey` (falls back to the cheapest with `pickUnavailable` when gone), `overrideCentavos` (the line total; makes the line priced even with no match), `includeOptional`, `haveIt`. State for a key not on the list is ignored.
8. Status: `haveIt` > `optionalExcluded` > `noPrice` > `priced`. The total sums `priced` lines; `estimated` counts priced lines still `rough`.

A line is optional only when every part is; in a mixed line the optional parts' quantities are left out. `need` is in the Recipes' unit when every counted part shares one, else g or ml, else the chosen match's unit, else null.

## Request caps (`request.ts`)

≤ 20 unique Recipe ids, servings integer 1–20, ≤ 200 line states, override a non-negative integer, unknown fields rejected. 400 `invalid_input` otherwise.

## Tests

- `price.test.ts` runs `priceDraft` on the real dataset: `runSeed` with a capturing writer, then `catalogFromSeedPlan` (`catalog.ts`). No database. Matching traps, conversions, cabbage by the head, rounding and the cheapest pick (with one synthetic 260 g corned beef can), merging, optional, Have It, override, pick fallback, totals.
- `../../test/price.test.ts`: the route with a stub `CatalogStore`: request handling and caps.
