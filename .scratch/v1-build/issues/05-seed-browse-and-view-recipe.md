# 05: Seed, browse and view a Recipe

**What to build:** After `seed`, a shopper opens the app and sees all 20 Seeded Recipes listed by name. They open one and see its Ingredients rescaled live by a 1–20 servings stepper, with friendly fractions, prep notes, "to taste" notes and optional markers. No prices appear on the Recipe page. Spec: "Data files and scripts → `seed`", "API contract" (`GET /api/recipes`, `GET /api/recipes/:id`), "Frontend → Home, Recipe page", user stories 1, 7–13.

**Blocked by:** 03 (Tag script and check). You can build and test `seed` with fixture data at once. The final run on real data waits for 04 (Run the first tagging pass and review it).

**Status:** ready-for-agent

- [ ] `seed` checks everything first. On any failure it lists every problem and writes nothing:
  - vocabulary depth ≤ 3, no cycles, no duplicate aliases (case-insensitive);
  - every slug exists;
  - every Ingredient and Commodity has a `reviewed` Tag Assignment;
  - every JSON file passes its zod schema.
- [ ] `seed` wipes and reloads every table in one transaction:
  - Tags, aliases, Unit Conversions;
  - Recipes (id = seed key) and Ingredients with their Tags;
  - Publications, Commodities with their Tags, and price observations (`n/a` writes no row).
- [ ] Running `seed` twice gives the same database, and Recipe ids never change.
- [ ] `GET /api/recipes` returns all Recipe cards sorted by name. `GET /api/recipes/:id` returns the Recipe and its Ingredients, or 404.
- [ ] The home screen lists every Recipe card (name, description, servings), each linking to its Recipe page.
- [ ] The Recipe page shows Ingredients scaled by its servings stepper (starting at the Recipe's servings), with fractions like "2½", prep notes, an "optional" marker and "to taste" notes.
- [ ] Unit tests: each `seed` check failure is reported, nothing is written on failure, and the scaling/fraction formatting is correct.
- [ ] Once 04 is done: `seed` runs clean on the real data, and all 20 Recipes open in the app.
