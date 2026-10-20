# extract

Turns a DA Daily Price Index or a DTI SRP bulletin PDF into one reviewable JSON file per Publication under `apps/api/data/publications/<da|dti>-<YYYY-MM-DD>.json`. Deterministic parsing from pdfjs-dist positional text; no LLM.

## Run

- `pnpm extract <pdf>` from the repo root (or `pnpm --filter @magkano/api extract <pdf>`). The PDF path resolves from where you typed the command.
- Any doubt about the layout throws `ExtractError`; the CLI prints it, exits 1 and writes nothing.
- Re-running on the same PDF rewrites a byte-identical file. The committed files come from the two PDFs in `sample/`.

## Data flow

`readPdfItems` (positioned text, normalised quotes and dashes) → `isDaPublication` / `isDtiPublication` pick the parser → `readDaPublication` / `readDtiPublication` (rows with category, name, spec, price) → drop filters → per-source Commodity terms → `publicationFileSchema.parse` → `formatPublicationFile`.

## Key files

- `extract.ts`: the seam. `extractPublication(pdf)`, `extractFromItems(items, fileHash)`, `publicationFileSchema` (zod; later scripts load the files through it), `commodityKey`, `publicationFileName`, `formatPublicationFile`. Duplicate Commodity keys fail.
- `write.ts`: `writePublicationFile(pdfPath, outDir)`, used by `scripts/extract.ts`.
- `pdf-text.ts`: `readPdfItems`, `joinFragments` (joins split hyphens and touching fragments), `parsePriceText` (centavos, `null` for `n/a`, anything else fails).
- `da-parser.ts`: DA's 14 category headers (bold = header, wrapped headers joined), x bands for name / spec / price, wrapped lines attached to the nearest price within 9 pt, categories carried across pages, stops at "Note(s):". Row count must be 150–260.
- `dti-parser.ts`: DTI's three A3 column groups, 26 leaf categories with a hand-written parent map, categories carried from one column into the next. Row count must be 120–220.
- `da-commodity.ts`: price basis and default Purchase Unit from the category (per kg; eggs per piece; oil per bottle from the spec), `parseCountWeight` (midpoint of a range: pcs/kg, gm/pc, per head, bundles, bracketed grams), feed grade filter.
- `dti-commodity.ts`: food allowlist (no water, soap, candles, batteries), region filter (keeps none, Luzon, Nationwide, NCR; channel qualifiers like "- SMKT" stay in the name), pack size as both price basis and Purchase Unit.
- `brands.ts`: brands printed in each source's sample, kept per source (DTI "Saba" sardines vs DA "Banana (Saba)"); unlisted brands stay `null`.

## File shape

`{ publication: { source, title, publishedOn, fileHash }, commodities: [{ key, category, name, spec, origin, brand, sizeLabel, priceCentavos | null, priceBasis, purchaseUnit, countUnit, countWeightG }], dropped: [{ category, name, spec, priceCentavos, reason }] }`. Amounts are `{ amount, unit: g | ml | piece }`.

## Tests

`extract.test.ts` (both samples end to end, plus broken layouts made by editing the sample's positioned text), `rules.test.ts` (weight parsing, filters, pack sizes), `write.test.ts` (file written; nothing written on failure).
