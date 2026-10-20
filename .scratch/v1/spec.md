# Magkano v1

Status: ready-for-agent

Synthesised from [map.md](map.md) and its resolved tickets under [issues/](issues/). Domain terms follow `GLOSSARY.md`. **Build budget: about 2 hours of agent build time from this spec, without lowering quality.** Cut scope, never correctness. The project owner's review of `tag --check` disagreements (likely 10–20 minutes) is counted separately.

## Problem Statement

Filipino households planning a meal want to know roughly how much the groceries will cost before they go to the market. The official price data exists: the DA publishes a Daily Price Index of NCR wet-market prices, and the DTI publishes SRP bulletins for packaged basics. But it comes as dense PDFs, priced per kilo or per pack, and no one turns "Sinigang na Baboy for 6" into a costed shopping list.

A shopper has to work out by hand three things:
- how much of each food a dish needs;
- how that maps to what the market sells (¼ kg of pork, one can of sardines);
- what each item costs.

Recipes and shoppers use Tagalog names ("bawang", "liempo", "gata"), while the price lists mix English, Tagalog and brand names, so matching the two is error-prone.

## Solution

Magkano is a mobile-first responsive web app with an English UI that understands Tagalog food names.

**What a user can do**
- Browse or search 20 Seeded Recipes ("sinigang", "something with pork", "manok").
- Open a Recipe to see its Ingredients at a chosen number of servings.
- Add one or more Recipes to a **Draft**: a Grocery List kept on the device, which survives a refresh.
- See a price estimate per line and a total, using the DA and DTI Publications in `sample/`.

**What each Grocery List line shows and allows**
- How much is needed and how much to buy in whole Purchase Units.
- The price, with its Price Source and Publication date.
- Using the cheapest Ingredient Match (the default), picking another one, or entering a Price Override for the whole line.
- Marking Have It, which takes the line out of the total.
- Lines with no known price stay visible but are left out of the total, and the coverage is shown. Rough Estimates are clearly labelled.

**Accounts**: users can sign up, sign in and sign out with Clerk. Nothing is locked behind an account in v1; saving lists comes in v2.

**Behind the scenes**
- The two sample PDFs are extracted deterministically into reviewed data files.
- Ingredients and Commodities are given Tags from one shared vocabulary by an LLM. Every Tag Assignment is reviewed and committed.
- The backend matches Ingredients to Commodities through those stored Tags; no LLM runs at match time. It prices every line deterministically.
- Recipes are found by embedding search in pgvector, with text/alias search as the fallback.

## User Stories

### Finding Recipes

1. As a shopper, I want to see all Seeded Recipes listed by name on the home screen, so that I can browse without typing.
2. As a shopper, I want to search for a dish by name ("adobo", "sinigang"), so that I can find a Recipe quickly.
3. As a shopper, I want to search in Tagalog or English ("manok" or "chicken", "bawang" or "garlic"), so that I can use the words I normally use.
4. As a shopper, I want to search by a food ("something with pork"), so that I find Recipes that use it.
5. As a shopper, I want at most 8 results with weak matches hidden, so that the list stays short and useful on my phone.
6. As a shopper, I want search to keep working with simpler text matching when the AI service is unavailable, with a small "basic search" note, so that the app is still usable.
7. As a shopper, I want an empty search box to show the full browse list, so that I'm never looking at a blank screen.
8. As a shopper, I want each Recipe card to show its name, one-line description and servings, so that I can tell Recipes apart.

### Viewing a Recipe

9. As a shopper, I want to open a Recipe without an account, so that I can see what it needs.
10. As a shopper, I want to see each Ingredient's name, quantity, unit, preparation note and whether it's optional, so that I know what the dish needs.
11. As a shopper, I want a servings stepper (1–20) on the Recipe page that rescales every quantity, so that I see amounts for my household.
12. As a shopper, I want "Add to list" on the Recipe page to add the Recipe at the servings I chose, so that I don't have to set them again.
13. As a shopper, I want "to taste" Ingredients to show their note instead of a quantity, so that the Recipe reads naturally.

### Building a Draft

14. As a shopper, I want to tap "+ Add" on a search result or browse card to add that Recipe to my Draft without leaving the screen, so that I can add several dishes quickly.
15. As a shopper, I want a newly added Recipe to start at its own servings (4), so that I have a sensible default.
16. As a shopper, I want an added card to show "✓ on list" and a servings stepper, so that I can see what's already on my list.
17. As a shopper, I want a sticky "View Grocery List · n recipes · ₱total" button, so that I always see the running total and can open the list.
18. As a shopper, I want a "Recipes on this list" strip on the list screen with a servings stepper and Remove for each Recipe, so that I can manage dishes there.
19. As a shopper, I want every quantity to scale linearly with my chosen servings, so that the amounts are right for my household.
20. As a shopper, I want my Draft kept on my device, so that it survives a refresh or closing the tab.
21. As a shopper, I want a Recipe that no longer exists removed from my Draft with a short notice, so that a stale Draft never breaks the page.

### Reading the Grocery List

22. As a shopper, I want the same food from several Recipes merged into one line, so that I buy it once in the right amount.
23. As a shopper, I want related but different foods ("onion" and "red onion") kept as separate lines, so that I keep the specific item a Recipe asked for.
24. As a shopper, I want each line to show "need → buy" (for example "1325 g → 6 × 250 g"), so that I know what to ask for at the market.
25. As a shopper, I want the amount to buy rounded up to whole Purchase Units (¼ kg, one can, one piece), so that the estimate reflects what I'd actually buy.
26. As a shopper, I want the needed amount shown in the Recipe's unit with friendly fractions when all parts share a unit ("2½ pieces"), and in g or ml otherwise, so that it's easy to read.
27. As a shopper, I want "to taste" Ingredients priced as one Purchase Unit with their note shown, so that seasonings still appear on the list.
28. As a shopper, I want each line to show its Price Source and Publication date ("DA Oct 8"), so that I know where and when the price came from.
29. As a shopper, I want the default price to be the cheapest Ingredient Match after rounding, so that the estimate is a realistic minimum.
30. As a shopper, I want an estimated total card with counts of priced, no price, have it and estimated lines, so that I know how complete the estimate is.
31. As a shopper, I want Rough Estimate lines to carry an amber "estimate" pill with an explanation on the line page, so that I know that number is rough.
32. As a shopper, I want lines with no price shown under "Needs price" and left out of the total, so that the total isn't silently wrong.
33. As a shopper, I want a ₱ field on a "Needs price" line, so that I can enter my own price and have it counted.
34. As a shopper, I want optional Ingredients listed under "Optional · not in total" with "+ Add", so that I include them only when I want them.
35. As a shopper, I want a merged line to count as optional only when every Recipe marks it optional, so that a food some Recipe needs is always counted.
36. As a shopper, I want To buy / Needs price / Have it filters with counts, so that I can focus on what's left.

### Line page

37. As a shopper, I want to tap a line to open a full-screen line page, so that I can see its details and change it.
38. As a shopper, I want the line page to show each Recipe's share of the need, the total needed and "You'll buy", so that I understand the amount.
39. As a shopper, I want to see every Ingredient Match cheapest first, each with units × Purchase Unit, price each, source, Publication, date and line cost, so that I can compare options.
40. As a shopper, I want to pick a different match (for example a branded item), so that the estimate reflects what I actually buy.
41. As a shopper, I want to enter my own price for the whole line, with a Clear action, so that I can use a price I saw at my market.
42. As a shopper, I want a line with my own price to show a "your price" badge, so that I remember it isn't from DA/DTI.
43. As a shopper, I want picking a different match to clear my own price, so that the line has one clear price.
44. As a shopper, I want an include toggle for optional lines and an "I already have this" action, so that I can change those from the line page too.
45. As a shopper, I want a note when a match I picked is no longer available, with the line falling back to the cheapest, so that I understand why it changed.

### Have It

46. As a shopper, I want a Have It checkbox on each line, so that I can mark what's already at home.
47. As a shopper, I want Have It lines struck through, moved to "Have it" and removed from the total, so that the total shows only what I'll spend.

### Accounts

48. As a visitor, I want to sign up, sign in and sign out with Clerk from the app header, so that I have an account ready for saved lists later.
49. As a shopper, I want everything in v1 to work without an account, so that I can use the app freely.
50. As a shopper, I want my Draft to survive signing in or out, so that I don't lose my list.

### Data preparation (project owner)

51. As the project owner, I want `extract <pdf>` to turn a DA or DTI PDF into one reviewable JSON file of Commodities, prices and dropped rows, so that I can check the data before it is used.
52. As the project owner, I want extraction to fail loudly on an unfamiliar layout, so that a template change never silently corrupts prices.
53. As the project owner, I want `tag` to have the LLM propose a Tag for every Ingredient and Commodity without a Tag Assignment, so that matching is prepared for me.
54. As the project owner, I want `tag --check` to accept proposals that agree with the existing reviewed Tags, show me only the disagreements, and report the tagger's agreement rate, so that review is short and I learn how accurate the LLM is.
55. As the project owner, I want to approve or correct a proposal by editing one JSON file, so that review is a plain git diff.
56. As the project owner, I want `seed` to check all data and then rebuild the database from the committed files, with no AI calls when nothing changed, so that seeding is repeatable and reuses reviewed Tag Assignments.
57. As the project owner, I want `seed` to refuse to run and list every problem when any Tag Assignment is unreviewed or any slug is unknown, so that unreviewed data never reaches the app.

## Implementation Decisions

### Stack and layout

- **Stack:** Vite + React + TypeScript SPA with React Router; Hono + TypeScript API; Drizzle ORM; PostgreSQL with pgvector; Clerk; OpenAI.
- **pnpm workspaces with two apps:**
  - `apps/web`: the SPA.
  - `apps/api`: the Hono app, the Drizzle schema and migrations, the domain logic (parsers, filters, Tag tree and matching, unit conversion, pricing, chunking, search), the `extract`, `tag` and `seed` scripts, and the data files under `apps/api/data/`.
- **Types** reach the SPA through Hono RPC (`hc<AppType>`), with zod validators on every input. The web app proxies `/api` to the API in dev, so everything is on one origin.
- **Local only:** a Docker `pgvector/pgvector` Postgres, with `CREATE EXTENSION vector` in the first migration.
- **Env vars:** `.env` is gitignored and `.env.example` is committed.
  - API: `DATABASE_URL`, `OPENAI_API_KEY` (optional for running the app; search then falls back).
  - Web: `VITE_CLERK_PUBLISHABLE_KEY`.
- **Tooling:** Biome for lint and format, `tsc` for typecheck, Vitest for tests.
- **Reuse:** ready-made, tested implementations of the DA/DTI parsers, pricing, Tag matching, recipe chunking and draft storage are available (see project memory). Adapt them freely rather than rewriting.

### Models and vectors

- **Embeddings:** `text-embedding-3-large` with `dimensions: 1536`.
- **Tagging:** `gpt-6-luna` with Structured Outputs (strict json_schema) and low reasoning effort.
- **Tagging schema:**

  ```ts
  { items: [{ ref: string, tag: <enum of all Tag slugs> | null, proposedNewTag: string | null }] }
  // tag null + proposal    → no Tag fits
  // tag null + no proposal → not food for people
  ```

  The whole vocabulary is the enum. Ingredients are sent with their Recipe name, and Commodities with their DA/DTI category.
- **pgvector:** HNSW index with `vector_cosine_ops`, queried with cosine distance.

### Tags

- A Tag is a food only. Origin, brand, grade, size and price-list category are Commodity fields, never Tags. There are no category Tags.
- **Tree:** single-parent, at most 3 levels deep. A parent is a more general form of the same food, and **a child must be usable in place of its parent in a Recipe**. So by-products (feet, neck, liver, skin/rind, head, offal, tongue, salmon head) are top-level Tags; pork liver may sit under pork offal.
- **One Tag per item:** each Ingredient and each Commodity carries exactly one Tag, the most specific that fits, and through it all of that Tag's ancestors.
- **Naming:** an English kebab-case singular slug, an English display name, and aliases (Tagalog and other English). Aliases are unique across all Tags, ignoring case, and the display name also counts as an alias.
- **Matching rule:**
  - An Ingredient and a Commodity match when their Tags lie on the same ancestor chain: one is the other or its ancestor.
  - Siblings never match.
  - Of the matching Commodities, keep only those at the most specific shared Tag. All of those are Ingredient Matches.
  - A Commodity with no price still counts as a match, and a line is priced when any match has a price.
  - An Ingredient with no Tag, or with no Commodity on its chain, has no match.
- **In memory:** the API loads the whole Tag tree and caches it, and works out ancestor chains there.

### Unit Conversions and Purchase Units

- **Base units:** every amount becomes g, ml or pieces before any maths.
  - Mass (g, kg) and volume (ml, L, tsp, tbsp, cup) convert directly.
  - Count units (piece, clove, head, thumb, stalk, bundle, can, pack), and volume units that need a density, convert through a Unit Conversion.
- **Unit Conversions on the Tag:** unit → amount in g or ml, inherited down the chain unless a more specific Tag sets its own. Cans and packs convert through mass.
- **Commodity weights override the Tag:** a count weight parsed from a DA spec ("13-15 pcs/kg", "151-250 gm/pc", "510 gm - 1 kg/head", using the midpoint of a range) beats the Tag's. A per-kg price becomes a per-piece price as ₱/kg × piece weight.
- **Default Purchase Unit per Commodity**, set by `extract`:
  - DTI: the pack as listed.
  - DA meat, poultry and fish: 250 g.
  - DA produce: 1 piece when a piece weight is known, else 250 g.
  - DA rice, sugar and salt: 1 kg.
  - DA eggs: 1 piece.
  - DA cooking oil: the bottle.

### Pricing (one server-side function, the only place price maths happens)

1. Scale each Ingredient quantity by target servings ÷ Recipe servings.
2. Convert to the base quantity.
3. Merge Ingredients that share a Tag and sum them. Untagged Ingredients merge by normalised name (lowercased, trimmed, repeated spaces collapsed). Different Tags stay separate lines.
4. For each Ingredient Match, round the sum up to whole Purchase Units and price it as multiples × price per Purchase Unit.
5. The default match is the lowest line cost after rounding. Ties go to the lower price per base unit. For example, 400 g of corned beef picks 2 × 260 g over 3 × 150 g when that is cheaper.

Special cases:
- **Empty quantity ("to taste"):** priced as one Purchase Unit of the match.
- **Unknown conversion:** when a match's unit can't be reached from the Ingredient's unit, that match is priced as one Purchase Unit and flagged `rough` (a Rough Estimate).
- **Optional Ingredients:**
  - A merged line is optional only when every part is optional. In a mixed line, the optional part's quantity is left out.
  - Optional lines aren't counted unless included.
- **Have It** lines are out of the total.
- **Price Override:**
  - It is the **line's total** in centavos, fixed even when servings change, until cleared.
  - Picking a match clears it; the client sends both changes in the same state update.
- **Picked match:** if it is no longer an Ingredient Match, the line falls back to the cheapest and sets `pickUnavailable`.
- **Current price:** a Commodity's row from its newest Publication.
- **Money:** always integer centavos. The UI formats it as `₱1,234.50`.

### Data model (9 tables, Drizzle)

- **Ids:**
  - A Recipe's id **is its seed key**: text, for example `chicken-adobo`.
  - Every other table uses integer identity. Integer ids change on each re-seed, so nothing on the device ever stores them.
- `tags(id, slug unique, name, parent_id nullable)`.
- `tag_aliases(tag_id, alias)`, with alias unique case-insensitive.
- `unit_conversions(tag_id, unit, amount, base_unit g|ml)`, keyed by (tag_id, unit).
- `recipes(id text PK, name, description, servings)`.
- `ingredients(id, recipe_id → recipes cascade, position, name, quantity numeric(8,3) nullable, unit enum(15 units) nullable, prep_note nullable, optional, tag_id nullable)`. An empty quantity and unit means "to taste".
- `recipe_chunks(recipe_id cascade, kind title|ingredients, content, embedding vector(1536))`, keyed by (recipe_id, kind), with an HNSW cosine index.
- `publications(id, source DA|DTI, title, published_on, file_hash)`, unique on (source, published_on).
- `commodities(id, key unique, source, category, name, spec, origin nullable, brand nullable, size_label nullable, price_basis_amount, price_basis_unit g|ml|piece, purchase_unit_amount, purchase_unit_unit g|ml|piece, count_unit piece|head|bundle nullable, count_weight_g nullable, tag_id nullable)`.
  - `key` = `<source>:<category>:<name>:<spec>`, with whitespace trimmed and collapsed.
- `price_observations(commodity_id, publication_id, price_centavos)`, keyed by both. `n/a` writes no row.
- Later versions add tables and nullable columns without destructive migrations (for example `users` in v2, `recipes.owner_id` in v3, more Publications in v4).

### Data files and scripts (`apps/api/data/`)

The committed files are the permanent record of the dataset. Postgres is a copy rebuilt by `seed`.

**Edited by hand (TypeScript, type-checked):**
- `tags.ts`: the reviewed Tag vocabulary of about 175 Tags, each with slug, name, optional parent, aliases and Unit Conversions.
- `recipes.ts`: the 20 Seeded Recipes, each with seed key, name, description, servings 4 and Ingredients (display name, quantity or null, unit or null, prep note, optional). **No Tags.**

Both come ready-made (see project memory).

**Written by scripts (JSON, stable formatting, zod-checked when loaded):**
- **`publications/<da|dti>-<YYYY-MM-DD>.json`**, written by `extract <pdf>`. It holds:
  - the Publication: source, title, publication date, file hash;
  - its Commodities: key, category, name, spec, origin, brand, size label, price in centavos or `null` for `n/a`, price basis, default Purchase Unit, count unit and weight;
  - dropped rows, each with its reason.

  Re-running on the same PDF rewrites an identical file.
- **`tag-assignments.json`**, written by `tag`:
  - Keys: `ingredient:<recipe seed key>:<normalised name>` and `commodity:<commodity key>`.
  - Entry: `{ tag: slug | null, proposedNewTag: string | null, status: "proposed" | "reviewed" }`.
- **`reference-tags.json`**: the existing reviewed Tags (ready-made), keyed the same way. It is used only by `tag --check` during the first review and deleted afterwards.
- **`embeddings.json`**, written by `seed`: a hash of the chunk text mapped to a 1536-dimension vector.

**`extract <pdf>`**
- Parsing is deterministic with pdfjs-dist positional text, no LLM:
  - cluster lines by y and split columns by x bands;
  - bold lines are headers;
  - attach wrapped name lines to the nearest priced line;
  - handle repeated page headers, categories carrying over pages, split hyphens, curly quotes, en dashes, DA merged spec cells and DTI's three A3 columns.
- **DA:** one prevailing NCR price per row. The unit comes from the category: per kg, except eggs per piece and cooking oil per bottle.
- **DTI:** one SRP per pack, with a hand-written parent map for its two-level categories.
- **Source and date** come from the header: DA "(Thursday, October 8, 2026)", DTI "effective 11 May 2026".
- **Filters:**
  - DTI keeps only an allowlist of food categories: no candles, soap, batteries or any water.
  - DA drops "Feed Grade" specs.
  - DTI keeps rows with no region qualifier, "Luzon" or "Nationwide".
  - Channel qualifiers ("- SMKT") stay in the name.
- **Fail loudly and write nothing** when:
  - a category header is unknown for the source (DA's 14, DTI's 26 leaves);
  - there are orphan lines;
  - a price is neither numeric nor `n/a`;
  - the row count is outside DA 150–260 or DTI 120–220.

**`tag`**
- Sends every Ingredient and Commodity that has no entry in `tag-assignments.json` to the LLM in batches, and writes the results as `proposed`.
- Re-asks for any slug not in the vocabulary.
- Never changes a `reviewed` entry.
- Reports entries whose item no longer exists.
- Exits non-zero while anything is `proposed`.

**`tag --check`**
- Marks each proposal that agrees with `reference-tags.json` as `reviewed`.
- Leaves disagreements `proposed`, with the reference Tag printed alongside.
- Prints the agreement rate for Ingredients and for Commodities.

**Review**
- To approve, set `status: "reviewed"`, correcting `tag` first if it's wrong.
- For a `proposedNewTag`, add that Tag to `tags.ts`, then point the entry at it.
- A reviewed `tag: null` means no Tag fits, so the line will show as "Needs price".

**`seed`**
- **Check first.** If any check fails, list every problem and change nothing:
  - the vocabulary is at most 3 levels deep, with no cycles and no duplicate aliases;
  - every slug exists;
  - every Ingredient and Commodity has a `reviewed` Tag Assignment;
  - every file passes its zod schema.
- **Then wipe and reload** every table in one transaction.
- **Embeddings:** build two chunks per Recipe and embed only those whose text hash isn't in `embeddings.json`, writing new vectors back. A re-seed with no changes makes no OpenAI call.

**Order:** `extract` (both sample PDFs) → `tag` → `tag --check` → settle the disagreements → delete `reference-tags.json` → `seed`. The first `tag` run costs about $0.05.

### Search

- **Two chunks per Recipe:**
  - title: name plus description;
  - Ingredients: each Ingredient as bilingual text, meaning its display name plus its Tag's and ancestors' aliases ("liempo / pork belly (a kind of pork / baboy)").
- **Query:** known foods in the query (exact Tag aliases, longest match first) are expanded with their aliases before embedding.
- **Recipe score:** ≈ 0.6 × title similarity + 0.4 × Ingredients similarity.
- **Results:** at most 8, hiding anything below 50% of the top score. Ties go by name.
- **Fallback:** used when the query embedding fails, takes over 3 s, or `OPENAI_API_KEY` is unset. It's a case-insensitive substring match on Recipe names, Ingredient names and Tag aliases, with title hits ranked first, and the response sets `fallback: true`.
- **Empty query:** returns no results, and the page shows the browse list.

### API contract (`/api/*`, all anonymous, no Clerk on the server)

- `GET /api/recipes`: `card[]` (id, name, description, servings), sorted by name.
- `GET /api/search?q=`: `{ fallback: boolean, results: card[≤8] }`.
- `GET /api/recipes/:id`: the Recipe with Ingredients (name, quantity, unit, prep note, optional), **no prices**. 404 if unknown.
- `POST /api/price`:
  - **Request:** `{ recipes: [{ id, servings 1–20 }] (≤20, unique ids), lines: { [lineKey]: { haveIt?, pickedCommodityKey?, overrideCentavos?, includeOptional? } } (≤200) }`.
    - `lineKey` is the Tag slug, or `untagged:<normalised name>`.
    - Unknown Recipe ids are skipped and listed in `droppedRecipeIds`.
    - State for a line key that isn't on the list is ignored.
  - **Response:**
    - `recipes`: `[{ id, name, servings }]`, in request order.
    - `total`: `{ centavos, counts: { priced, noPrice, haveIt, estimated, optionalExcluded } }`.
    - `lines[]`, each with:
      - `key` and `name` (the Tag display name, or the Ingredient name if untagged);
      - `fromRecipes: [{ id, name, amount }]`;
      - `need` (amount + unit, or the "to taste" note);
      - `optional`, `included`, `haveIt`;
      - `status`: `priced | noPrice | haveIt | optionalExcluded`;
      - `price`: `{ commodityKey | null, buy, lineCentavos, rough, overridden }`;
      - `pickUnavailable`;
      - `matches[]`, cheapest first: `{ commodityKey, name, spec, source, publishedOn, publicationTitle, buy, unitPriceCentavos, lineCentavos, rough, cheapest }`.
    - `droppedRecipeIds`.
  - The response holds everything the list screen, filters and line page need.
- **Errors** have the shape `{ error: code, message }`: 400 `invalid_input` (zod), 404 `not_found`, 500 `internal`.

### Frontend

- **Header:** the app name, plus Clerk `<SignInButton>` / `<SignUpButton>` when signed out and `<UserButton>` (with sign out) when signed in. The app is wrapped in `<ClerkProvider>`. Nothing is gated.
- **Home (`/`):**
  - A search box, debounced, which calls `/api/search`.
  - Below it, the results, or the full browse list when the query is empty, plus a "basic search" note when `fallback` is set.
  - Each card links to the Recipe page and has "+ Add". Once added, the card shows "✓ on list" and a 1–20 servings stepper.
  - The sticky "View Grocery List · n recipes · ₱total" button appears when the Draft isn't empty.
- **Recipe page (`/recipes/:id`):** Ingredients scaled on the client by a 1–20 servings stepper (starting at the Recipe's servings), with friendly fractions, prep notes, an "optional" marker and "to taste" notes. "Add to list" adds the Recipe at the chosen servings, or updates its servings if it's already on the list. No price.
- **List screen (`/list`), top to bottom:**
  - header with back;
  - estimated total card with a coverage bar and counts;
  - "Recipes on this list" strip (name, servings stepper, Remove);
  - To buy / Needs price / Have it filter with counts;
  - lines.
  - Each row has: Have It checkbox, name, need → buy, source Recipes, source badge and date ("DA Oct 8"), price and ›.
  - Badges: amber "estimate" and "your price".
  - "Needs price" rows have an inline ₱ field that sets a Price Override.
  - Optional lines sit at the bottom of To buy under "Optional · not in total", each with "+ Add".
  - An empty Draft shows a prompt back to search.
- **Line page (`/list/:lineKey`, full screen):**
  - per-Recipe breakdown, total needed and "You'll buy";
  - "Pick a price": every match, with a "cheapest" pill;
  - "Or enter your own price" with Clear;
  - an include toggle for optional lines and "I already have this";
  - the Rough Estimate explanation: "we don't know how much a piece weighs, so this is the price of one Purchase Unit";
  - the "Your pick is no longer available, using the cheapest" note.
- **Draft storage:**
  - `localStorage` key `magkano.draft.v1`, in the same shape as the `/api/price` request. Every read and write is wrapped in try/catch, and unreadable or wrong-version data starts an empty Draft.
  - The client re-prices on every change with a debounce of about 300 ms.
  - After each response, it removes line state for keys no longer returned and drops `droppedRecipeIds`, with a toast.
  - The Draft is independent of sign-in state.
- Mobile-first responsive, English UI.

## Testing Decisions

- **What makes a good test:**
  - It exercises external behaviour through a public seam (a pure function's inputs and outputs, or a script's output files), never internal helpers or call order.
  - It uses realistic data (the sample PDFs, the Seeded Recipes and the vocabulary) instead of invented fixtures where possible.
  - It never calls OpenAI: the client is stubbed.
- **Unit tests (Vitest), table-driven where natural:**
  - **DA and DTI parsers** against the PDFs in `sample/`: row counts (DA 204 rows with 155 priced; DTI food rows after filtering), 0 orphans, publication dates, oil priced per bottle, and a loud failure on a broken layout.
  - **Filters:** non-food, water, feed grade, region qualifiers.
  - **DA spec weight parsing:** midpoints, pcs/kg, gm/pc, per head, bundles.
  - **Tag-chain matching** with the trap cases:
    - kasim matches only shoulder rows; liempo only belly;
    - "sibuyas" matches red and white onions, and "sibuyas puti" only white;
    - gata never matches coconut oil; tomato sauce never matches tomatoes;
    - canned sardinas never matches fresh tamban; corned beef never matches beef loaf;
    - siblings never match;
    - generic "manok" defaults to a meat cut, not chicken neck.
  - **Unit conversion:** inheritance down the chain, Commodity weight overriding the Tag, and an unknown conversion producing a Rough Estimate.
  - **Pricing:**
    - Purchase Unit rounding and lowest-line-cost selection (for example corned beef 2 × 260 g over 3 × 150 g);
    - merging by Tag and untagged name, servings scaling and "to taste";
    - optional rules;
    - Have It, Price Override as a line total, pick-unavailable fallback;
    - totals and counts.
  - **Price request handling:** unknown Recipe ids dropped, stale line state ignored, caps enforced.
  - **Chunk text and query expansion:** bilingual aliases.
  - **Search scoring:** weighting, the 8 cap, the 50% cutoff; plus the text fallback.
  - **`tag` validation:** an unknown slug is re-asked, reviewed entries are untouched, stale entries are reported, and `--check` marks agreements and computes the rate.
  - **`seed` checks:** each failure is reported, and nothing is written when any check fails.
  - **Draft storage:** round-trip, corrupt data starts empty, pruning after a response.
- **Not in v1:** API integration tests against Postgres, Playwright, CI.

## Out of Scope

- **v1.1:** deployment (hosting, a managed database, preview environments, migrations in a build).
- **v2:** saving, reopening, editing, renaming and deleting private Grocery Lists; the `users` table, Clerk on the server and webhooks.
- **v3:** user Recipes (create, edit, Copy to my Recipes, delete), with tagging and embedding on save.
- **v4:** importing later DA/DTI Publications through an ongoing ingestion workflow, price history views and price-movement warnings.
- **v5:** "what I have" discovery: an ingredient-list search mode, pantry coverage and missing-Ingredient explanations.
- **Not planned:** native apps, regions outside NCR, public Recipes, users retagging items, admin UIs and admin CLIs, fetching PDFs from URLs.
- **Recipes:** cooking steps, photos, Ingredient groups, quantity ranges and free-text Tagalog units ("tasa").
- **Pricing:** fractional Purchase Units, staleness flags, Unit Conversion `verified` flags.
- **Search and screens:** query-embedding caching, rate limits, a Tag boost in search, Tag embeddings, a single-Recipe price estimate, and per-Recipe tabs on the list screen.

## Further Notes

- **Expected coverage:** with reviewed Tags, about 86% of main Ingredients are priceable, and only 7 of 20 Seeded Recipes are fully priced. The gaps include tomato sauce, sinigang mix, coconut milk, misua, oyster sauce, kangkong, malunggay, radish, okra, green papaya, spring onion, ground pork, beef shank and green peas. This is accepted, and handled by "Needs price" and Price Override.
- **Known risks:**
  - The real `gpt-6-luna` tagging accuracy is unmeasured until the first `tag --check`.
  - The search weights were tuned without real embeddings; revisit them only if results are poor.
  - Hard-coded PDF x bands will break when a template changes; the loud-failure checks are the guard.
- **Expected OpenAI spend:** about $0.05 for the first `tag` run and well under a cent to embed 40 chunks. A re-seed is free.
