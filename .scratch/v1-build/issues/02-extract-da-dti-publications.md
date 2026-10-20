# 02: Extract DA and DTI Publications

**What to build:** The project owner runs `extract` on either sample PDF and gets one reviewable JSON file per Publication. It holds the Publication (source, title, date, file hash), every kept Commodity, and every dropped row with its reason. An unfamiliar layout makes it fail loudly and write nothing. Spec: "Data files and scripts → `extract`", "Unit Conversions and Purchase Units". Ready-made tested parsers are available to adapt (see project memory).

**Blocked by:** 01 (Project skeleton with Clerk sign-in).

**Status:** resolved

- [x] Deterministic parsing of both sample PDFs with pdfjs-dist positional text, with no LLM, covering the layout pitfalls the spec lists.
- [x] Source and publication date are read from the PDF header: DA 8 Oct 2026, DTI 11 May 2026.
- [x] Each Commodity has:
  - key, category, name, spec, origin, brand, size label;
  - a price in centavos, or `null` for `n/a`;
  - price basis (DA per kg, eggs per piece, oil per bottle; DTI per pack);
  - the default Purchase Unit for its category;
  - a count unit and weight parsed from DA specs, using the midpoint of a range.
- [x] Filters drop DTI non-food rows and all water, DA feed grade, and DTI rows for regions other than Luzon/Nationwide. Channel qualifiers stay in the name.
- [x] It fails, writing nothing, on: an unknown category header, orphan lines, a price that is neither numeric nor `n/a`, or a row count outside DA 150–260 / DTI 120–220.
- [x] Re-running on the same PDF produces an identical file.
- [x] Both sample Publication files are generated and committed.
- [x] Unit tests against `sample/`: row counts (DA 204 rows, 155 priced), 0 orphans, dates, oil per bottle, filters, spec-weight parsing, and a loud failure on a broken layout.

## Comments

Resolved. `pnpm extract <pdf>` writes `apps/api/data/publications/da-2026-10-08.json` (202 Commodities, 2 feed grade dropped) and `dti-2026-05-11.json` (75 Commodities, 92 dropped: 52 non-food, 34 water, 6 outside Luzon). Docs: `apps/api/src/extract/CLAUDE.md`.

Open for the owner (no change made):
- Bundle and head produce (eggplant, pechay, sitao, cabbage) get a Purchase Unit of 1 `piece`, meaning one bundle or head; pricing should read `piece` as "one count unit".
- "3-4 Small Bundles" is read as bundles per kg (≈286 g each); the PDF doesn't say.
- "Bangus, Large (1-2 pcs)" gets no piece weight because the PDF omits "/kg".
