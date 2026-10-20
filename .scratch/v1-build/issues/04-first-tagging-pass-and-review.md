# 04: Run the first tagging pass and review it

**What to build:** The real reviewed Tag Assignments for v1. The project owner runs the LLM over every Ingredient and Commodity, settles the disagreements with the existing reviewed Tags, and commits the result, so `seed` has a complete reviewed dataset. Spec: "Data files and scripts → Review", "Order". Expected time: 10–20 minutes. Expected cost: about $0.05.

**Blocked by:** 03 (Tag script and check).

**Status:** resolved

- [x] `OPENAI_API_KEY` is set in `.env`, and `tag` has run over all Ingredients and Commodities.
- [x] `tag --check` has run, and the agreement rates for Ingredients and Commodities are recorded in a comment on this ticket.
- [x] Every disagreement is settled: the entry's `tag` corrected if needed, then `status: "reviewed"`.
- [x] Every `proposedNewTag` is either added to the vocabulary and pointed to, or replaced by an existing Tag (or a reviewed `tag: null`).
- [x] `tag` exits 0 because nothing is `proposed`, `reference-tags.json` is deleted, and `tag-assignments.json` is committed.

## Comments

Resolved (2026-10-21). `tag` proposed all 454 items (177 Ingredients, 277 Commodities); no `proposedNewTag`, no `tag: null`.

`tag --check` agreement rates:
- Ingredients agree: 170/177 (96.0%)
- Commodities agree: 271/277 (97.8%)

All 13 disagreements were settled to the reference Tag, which the vocabulary's own aliases back:
- `itlog` (arroz-caldo, pork-giniling, tortang-talong): proposed `chicken-egg` → `egg` (`itlog` is an alias of `egg`).
- `sibuyas` (pork-giniling, pork-menudo): proposed `red-onion` → `onion` (alias of `onion`).
- `tagiliran` (bistek-tagalog): proposed `beef-flank` → `beef-sirloin` (alias of `beef-sirloin`).
- `papaya` (tinolang-manok): proposed `papaya` → `green-papaya` (tinola uses unripe papaya). No Commodity is tagged `green-papaya`, so this line will show "Needs price".
- DA Cooking Oil (Minola), 1 L and 500 ml: proposed `cooking-oil` → `coconut-oil` (Minola is a coconut oil).
- DA Carabeef Forequarter / Rump Steak, Imported and Local: proposed `beef-forequarter` / `beef-rump` → `carabeef` (carabao, not beef).

`reference-tags.json` is deleted; `files.test.ts` now checks `tag-assignments.json` instead (keys match every current item, slugs exist, everything reviewed).

The final file matches the old reference Tags exactly. The owner can override any of the 13 settlements by editing `tag-assignments.json`.
