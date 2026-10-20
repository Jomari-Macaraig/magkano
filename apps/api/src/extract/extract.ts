import { createHash } from "node:crypto";
import { z } from "zod";
import { countUnits, measureUnits, type Source, sources } from "../db/schema";
import { brandOf } from "./brands";
import { type CommodityTerms, daCommodityTerms, daDropReason } from "./da-commodity";
import { isDaPublication, readDaPublication } from "./da-parser";
import { dtiCommodityTerms, dtiDropReason } from "./dti-commodity";
import { isDtiPublication, readDtiPublication } from "./dti-parser";
import { ExtractError } from "./extract-error";
import { type PdfItem, readPdfItems } from "./pdf-text";

const amountSchema = z.object({ amount: z.number().positive(), unit: z.enum(measureUnits) });

const rowSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  spec: z.string(),
  /** null for `n/a`. */
  priceCentavos: z.number().int().nonnegative().nullable(),
});

const commoditySchema = z.object({
  key: z.string().min(1),
  category: z.string().min(1),
  name: z.string().min(1),
  spec: z.string(),
  origin: z.string().nullable(),
  brand: z.string().nullable(),
  sizeLabel: z.string().nullable(),
  priceCentavos: z.number().int().nonnegative().nullable(),
  priceBasis: amountSchema,
  purchaseUnit: amountSchema,
  countUnit: z.enum(countUnits).nullable(),
  countWeightG: z.number().positive().nullable(),
});

/** The reviewable JSON file `extract` writes for one Publication. */
export const publicationFileSchema = z.object({
  publication: z.object({
    source: z.enum(sources),
    title: z.string().min(1),
    publishedOn: z.iso.date(),
    fileHash: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  commodities: z.array(commoditySchema),
  dropped: z.array(rowSchema.extend({ reason: z.string().min(1) })),
});
export type PublicationFile = z.infer<typeof publicationFileSchema>;
export type Commodity = z.infer<typeof commoditySchema>;

type Row = z.infer<typeof rowSchema>;

/** What differs between DA and DTI once a Publication is parsed. */
type SourceRules = {
  dropReason(row: Row): string | null;
  terms(row: Row): CommodityTerms;
  origin(row: Row): string | null;
  sizeLabel(row: Row): string | null;
};

// A size word describes the produce, except in "3-4 Small Bundles", where it sizes the bundle.
const sizeWords =
  /\b(extra small|small|medium|large|extra large|jumbo|pewee|pullet)\b(?!\s+bundles?)/i;

const rules: Record<Source, SourceRules> = {
  DA: {
    dropReason: daDropReason,
    terms: daCommodityTerms,
    origin: (row) => row.name.match(/, (Local|Imported|Native\/Local)$/i)?.[1] ?? null,
    sizeLabel: (row) => `${row.name} ${row.spec}`.match(sizeWords)?.[1] ?? null,
  },
  DTI: {
    dropReason: dtiDropReason,
    terms: dtiCommodityTerms,
    origin: () => null,
    sizeLabel: (row) => row.spec,
  },
};

/** Reads a DA or DTI PDF into its Publication file. Throws `ExtractError` when unsure. */
export async function extractPublication(pdf: Uint8Array): Promise<PublicationFile> {
  const fileHash = createHash("sha256").update(pdf).digest("hex");
  return extractFromItems(await readPdfItems(pdf), fileHash);
}

/** The same, from a PDF's positioned text. */
export function extractFromItems(items: PdfItem[], fileHash: string): PublicationFile {
  const parsed = isDaPublication(items)
    ? readDaPublication(items)
    : isDtiPublication(items)
      ? readDtiPublication(items)
      : undefined;
  if (!parsed) {
    throw new ExtractError(
      "This is neither a DA Daily Price Index nor a DTI SRP bulletin (no known header found).",
    );
  }
  const source = parsed.source;
  const sourceRules = rules[source];

  const commodities: Commodity[] = [];
  const dropped: PublicationFile["dropped"] = [];
  const seen = new Set<string>();
  for (const parsedRow of parsed.rows) {
    const row: Row = {
      category: parsedRow.category,
      name: collapse(parsedRow.name),
      spec: collapse(parsedRow.spec),
      priceCentavos: parsedRow.priceCentavos,
    };
    const reason = sourceRules.dropReason(row);
    if (reason) {
      dropped.push({ ...row, reason });
      continue;
    }
    const key = commodityKey(source, row);
    if (seen.has(key)) throw new ExtractError(`Commodity "${key}" appears twice.`);
    seen.add(key);
    const terms = sourceRules.terms(row);
    commodities.push({
      key,
      category: row.category,
      name: row.name,
      spec: row.spec,
      origin: sourceRules.origin(row),
      brand: brandOf(source, row),
      sizeLabel: sourceRules.sizeLabel(row),
      priceCentavos: row.priceCentavos,
      priceBasis: terms.priceBasis,
      purchaseUnit: terms.purchaseUnit,
      countUnit: terms.countUnit,
      countWeightG: terms.countWeightG,
    });
  }

  return publicationFileSchema.parse({
    publication: { source, title: parsed.title, publishedOn: parsed.publishedOn, fileHash },
    commodities,
    dropped,
  });
}

/** `<source>:<category>:<name>:<spec>`, whitespace trimmed and collapsed. */
export function commodityKey(
  source: string,
  row: { category: string; name: string; spec: string },
) {
  return [source, row.category, row.name, row.spec].map(collapse).join(":");
}

/** Where `extract` writes a Publication, relative to `data/publications/`. */
export function publicationFileName(file: PublicationFile): string {
  return `${file.publication.source.toLowerCase()}-${file.publication.publishedOn}.json`;
}

/** Stable formatting, so re-running on the same PDF rewrites an identical file. */
export function formatPublicationFile(file: PublicationFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

function collapse(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}
