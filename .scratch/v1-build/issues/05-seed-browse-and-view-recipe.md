# 05: Seed, browse and view a Recipe

**What to build:** After `seed`, a shopper opens the app and sees all 20 Seeded Recipes listed by name. They open one and see its Ingredients rescaled live by a 1–20 servings stepper, with friendly fractions, prep notes, "to taste" notes and optional markers. No prices appear on the Recipe page. Spec: "Data files and scripts → `seed`", "API contract" (`GET /api/recipes`, `GET /api/recipes/:id`), "Frontend → Home, Recipe page", user stories 1, 7–13.

**Blocked by:** 03 (Tag script and check). You can build and test `seed` with fixture data at once. The final run on real data waits for 04 (Run the first tagging pass and review it).

**Status:** resolved

- [x] `seed` checks everything first. On any failure it lists every problem and writes nothing:
  - vocabulary depth ≤ 3, no cycles, no duplicate aliases (case-insensitive);
  - every slug exists;
  - every Ingredient and Commodity has a `reviewed` Tag Assignment;
  - every JSON file passes its zod schema.
- [x] `seed` wipes and reloads every table in one transaction:
  - Tags, aliases, Unit Conversions;
  - Recipes (id = seed key) and Ingredients with their Tags;
  - Publications, Commodities with their Tags, and price observations (`n/a` writes no row).
- [x] Running `seed` twice gives the same database, and Recipe ids never change.
- [x] `GET /api/recipes` returns all Recipe cards sorted by name. `GET /api/recipes/:id` returns the Recipe and its Ingredients, or 404.
- [x] The home screen lists every Recipe card (name, description, servings), each linking to its Recipe page.
- [x] The Recipe page shows Ingredients scaled by its servings stepper (starting at the Recipe's servings), with fractions like "2½", prep notes, an "optional" marker and "to taste" notes.
- [x] Unit tests: each `seed` check failure is reported, nothing is written on failure, and the scaling/fraction formatting is correct.
- [x] Once 04 is done: `seed` runs clean on the real data, and all 20 Recipes open in the app.

## Comments

- Done. `pnpm seed` on the real data: 174 Tags, 20 Recipes, 177 Ingredients, 2 Publications, 277 Commodities, 228 Price Observations. Seeding twice gives identical `pg_dump` data (ids included). All 20 `GET /api/recipes/:id` answer 200 through the web dev proxy. Beyond the listed checks, `seed` also rejects duplicate Recipe seed keys, duplicate Commodity keys within a file and two files for one (source, date) Publication. Each would otherwise fail the write partway through. Search, "+ Add" and "Add to list" are left to tickets 06 and 08.
