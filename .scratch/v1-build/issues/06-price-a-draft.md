# 06: Price a Draft on the Grocery List screen

**What to build:** A shopper adds one or more Recipes to a Draft from the home screen or a Recipe page, then opens the Grocery List.
- They see merged lines with need → buy in whole Purchase Units, each line's price with its Price Source and date, and an estimated total with coverage counts.
- They can filter To buy / Needs price / Have it, tick Have It, type their own price on a "Needs price" line, and add optional Ingredients.
- The Draft survives a refresh.

All price maths happens on the server. Spec: "Pricing", "Tags → Matching rule", "Unit Conversions and Purchase Units", "API contract → `POST /api/price`", "Frontend → Home, List screen, Draft storage", user stories 14–36, 46–47, 50. Ready-made tested pricing, matching and draft storage are available to adapt (see project memory).

**Blocked by:** 05 (Seed, browse and view a Recipe).

**Status:** resolved

- [x] **One server-side pricing function:**
  - scale by servings, then convert to g / ml / pieces using Tag Unit Conversions (inherited) or Commodity count weights;
  - merge by Tag, or by normalised name when untagged;
  - find Ingredient Matches by the ancestor-chain rule (siblings never match);
  - round up to whole Purchase Units, and default to the lowest line cost (ties go to the lower unit price).
- [x] **Count units (owner decisions, 2026-10-21):**
  - a Purchase Unit of `1 piece` means one of the Commodity's count unit: one head of cabbage, one bundle of pechay. Its weight is `count_weight_g` and its price is ₱/kg × that weight (200 g of cabbage buys 1 head of 755 g, not 250 g);
  - DA "3-4 Small Bundles" specs are read as bundles per kg (about 286 g each), as `extract` already does;
  - a DA row with no parsed count weight ("Bangus, Large (1-2 pcs)") is bought by 250 g, as `extract` already sets.
- [x] **Special cases:**
  - "to taste" and unknown conversions are priced as one Purchase Unit, and an unknown conversion is a Rough Estimate;
  - a merged line is optional only when every part is optional;
  - Have It lines are out of the total;
  - a Price Override is the line total;
  - a picked match that is no longer an Ingredient Match falls back to the cheapest, with `pickUnavailable`.
- [x] **`POST /api/price`:**
  - validates the Draft (≤ 20 unique Recipes, servings 1–20, ≤ 200 line states);
  - skips unknown Recipe ids into `droppedRecipeIds` and ignores state for lines not on the list;
  - returns the full response shape in the spec.
- [x] **Adding Recipes:**
  - home cards have "+ Add", which becomes "✓ on list" with a 1–20 servings stepper;
  - the Recipe page's "Add to list" uses its chosen servings, or updates them if the Recipe is already on the list;
  - a sticky "View Grocery List · n recipes · ₱total" button appears when the Draft isn't empty.
- [x] **List screen:**
  - total card with a coverage bar and counts (priced, no price, have it, estimated);
  - "Recipes on this list" strip with a servings stepper and Remove;
  - To buy / Needs price / Have it filters with counts.
- [x] **List rows:**
  - each shows Have It, name, need → buy, source Recipes, source badge and date, and the price, plus the "estimate" and "your price" badges;
  - "Needs price" rows have an inline ₱ field;
  - optional lines sit under "Optional · not in total" with "+ Add".
  - An empty Draft prompts back to search.
- [x] **Draft storage:**
  - kept in `localStorage` as `magkano.draft.v1`, in the request shape, with try/catch, and corrupt or wrong-version data starts empty;
  - re-priced with a debounce of about 300 ms;
  - after each response, stale line state is pruned and dropped Recipes are removed with a toast;
  - unaffected by sign-in or sign-out.
- [x] **Money** is formatted as `₱1,234.50`.
- [x] **Unit tests:**
  - matching traps: pork cuts, onion colours, gata vs coconut oil, sardinas vs tamban, corned beef vs beef loaf, siblings, generic chicken not defaulting to neck;
  - conversion inheritance and overrides;
  - rounding and cheapest selection (corned beef 2 × 260 g vs 3 × 150 g);
  - merging, scaling, "to taste", optional rules, Have It, Price Override, pick fallback, totals and counts;
  - price request handling (dropped ids, stale state, caps);
  - Draft storage round-trip and pruning.
