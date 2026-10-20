# 02: Extract DA and DTI Publications

**What to build:** The project owner runs `extract` on either sample PDF and gets one reviewable JSON file per Publication. It holds the Publication (source, title, date, file hash), every kept Commodity, and every dropped row with its reason. An unfamiliar layout makes it fail loudly and write nothing. Spec: "Data files and scripts → `extract`", "Unit Conversions and Purchase Units". Ready-made tested parsers are available to adapt (see project memory).

**Blocked by:** 01 (Project skeleton with Clerk sign-in).

**Status:** ready-for-agent

- [ ] Deterministic parsing of both sample PDFs with pdfjs-dist positional text, with no LLM, covering the layout pitfalls the spec lists.
- [ ] Source and publication date are read from the PDF header: DA 8 Oct 2026, DTI 11 May 2026.
- [ ] Each Commodity has:
  - key, category, name, spec, origin, brand, size label;
  - a price in centavos, or `null` for `n/a`;
  - price basis (DA per kg, eggs per piece, oil per bottle; DTI per pack);
  - the default Purchase Unit for its category;
  - a count unit and weight parsed from DA specs, using the midpoint of a range.
- [ ] Filters drop DTI non-food rows and all water, DA feed grade, and DTI rows for regions other than Luzon/Nationwide. Channel qualifiers stay in the name.
- [ ] It fails, writing nothing, on: an unknown category header, orphan lines, a price that is neither numeric nor `n/a`, or a row count outside DA 150–260 / DTI 120–220.
- [ ] Re-running on the same PDF produces an identical file.
- [ ] Both sample Publication files are generated and committed.
- [ ] Unit tests against `sample/`: row counts (DA 204 rows, 155 priced), 0 orphans, dates, oil per bottle, filters, spec-weight parsing, and a loud failure on a broken layout.
