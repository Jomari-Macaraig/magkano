import { ExtractError } from "./extract-error";
import { closestAnchor, isoDate, joinFragments, type PdfItem, parsePriceText } from "./pdf-text";

/**
 * DTI's 26 leaf categories, as printed, each with its parent from the hand-written map
 * (the PDF prints parents and leaves in the same font, so the hierarchy can't be read).
 * Any header that is neither a leaf nor in `dtiParentHeaders` fails the extract.
 */
export const dtiCategories = {
  "CANNED SARDINES IN TOMATO SAUCE": null,
  "CONDENSED MILK": "PROCESSED MILK",
  "EVAPORATED MILK": "PROCESSED MILK",
  "POWDERED MILK": "PROCESSED MILK",
  "COFFEE 3-IN-1 ORIGINAL": null,
  BREAD: null,
  "INSTANT MAMI NOODLES CHICKEN & BEEF FLAVOR": null,
  "IODIZED ROCK SALT": "SALT",
  "IODIZED SALT": "SALT",
  "DISTILLED WATER": "BOTTLED WATER",
  "PURIFIED WATER": "BOTTLED WATER",
  "MINERALIZED WATER": "BOTTLED WATER",
  "DETERGENT SOAP/LAUNDRY SOAP": null,
  CANDLES: null,
  "LUNCHEON MEAT": null,
  "MEAT LOAF": null,
  "CORNED BEEF": null,
  "BEEF LOAF": null,
  "VINEGAR - GIN AND PET BOTTLE": "CONDIMENTS",
  "VINEGAR - DOY / REFILL PACK": "CONDIMENTS",
  "PATIS - GIN / PET BOTTLE": "CONDIMENTS",
  "PATIS - DOY PACK / BUDGET PACK": "CONDIMENTS",
  "SOY SAUCE - GIN / PET BOTTLE": "CONDIMENTS",
  "SOY SAUCE - DOY PACK / REFILL PACK": "CONDIMENTS",
  "TOILET SOAP": null,
  BATTERIES: null,
} as const satisfies Record<string, string | null>;
export type DtiCategory = keyof typeof dtiCategories;

/** Headers that group leaves (or start a section) and never hold rows themselves. */
export const dtiParentHeaders = [
  "PROCESSED MILK",
  "SALT",
  "BOTTLED WATER",
  "CONDIMENTS",
  "PRIME COMMODITIES",
] as const;

export const DTI_ROW_RANGE = { min: 120, max: 220 } as const;

export type DtiRow = {
  category: DtiCategory;
  /** From the hand-written parent map; null for a top-level leaf. */
  parentCategory: string | null;
  name: string;
  /** The pack size as printed in the UNIT column, e.g. "155g", "370mL". */
  spec: string;
  priceCentavos: number | null;
};

export type DtiPublication = {
  source: "DTI";
  title: string;
  /** ISO date the SRPs take effect, e.g. "2026-05-11". */
  publishedOn: string;
  rows: DtiRow[];
};

/**
 * The three side-by-side column groups of the A3 template (points from the left edge):
 * where each starts, and where its UNIT and SRP sub-columns start.
 */
const COLUMNS = [
  { start: 0, unit: 200, srp: 250 },
  { start: 290, unit: 460, srp: 505 },
  { start: 550, unit: 720, srp: 765 },
] as const;
/** How far a wrapped name line may sit from its row's SRP. */
const ROW_REACH = 13;

/** Whether these PDF items look like a DTI SRP bulletin (its title block). */
export function isDtiPublication(items: PdfItem[]): boolean {
  return /SUGGESTED RETAIL PRICES/i.test(titleBlock(items));
}

export function readDtiPublication(items: PdfItem[]): DtiPublication {
  const title = titleBlock(items);
  if (!/SUGGESTED RETAIL PRICES/i.test(title)) {
    throw new ExtractError("This is not a DTI SRP bulletin (no header found).");
  }
  const [, day = "", monthName = "", year = ""] =
    title.match(/effective (\d{1,2}) (\w+) (\d{4})/i) ?? [];
  const publishedOn = isoDate(day, monthName, year);
  if (!publishedOn) {
    throw new ExtractError(
      'No effective date found in the header (expected "effective 11 May 2026").',
    );
  }

  const rows = readRows(items);
  if (rows.length < DTI_ROW_RANGE.min || rows.length > DTI_ROW_RANGE.max) {
    throw new ExtractError(
      `Found ${rows.length} rows; a DTI Publication has ${DTI_ROW_RANGE.min}-${DTI_ROW_RANGE.max}. The template may have changed.`,
    );
  }
  return {
    source: "DTI",
    title: `BNPC Suggested Retail Prices (effective ${Number(day)} ${capitalise(monthName)} ${year})`,
    publishedOn,
    rows,
  };
}

/** The text above the first column header row on page 1. */
function titleBlock(items: PdfItem[]): string {
  const firstPage = items.filter((i) => i.page === 1);
  const top = Math.min(
    ...firstPage.filter((i) => i.text.trim() === "SRP").map((i) => i.y),
    Number.POSITIVE_INFINITY,
  );
  return joinFragments(firstPage.filter((i) => i.y < Math.min(top, 200)));
}

type Anchor = { price: PdfItem; name: PdfItem[]; unit: PdfItem[] };
type Entry = { y: number } & ({ header: string } | { anchor: Anchor });

function readRows(all: PdfItem[]): DtiRow[] {
  const entries: Entry[] = [];
  const orphans: string[] = [];

  const pages = [...new Set(all.map((i) => i.page))].sort((a, b) => a - b);
  for (const page of pages) {
    const onPage = all.filter((i) => i.page === page);
    const headerRow = onPage.filter((i) => i.text.trim() === "SRP");
    const columnHeader = onPage.find((i) => /^BASIC NECESSITIES$/i.test(i.text.trim()));
    if (!headerRow.length || !columnHeader) {
      throw new ExtractError(`Page ${page} has no BASIC NECESSITIES / UNIT / SRP column header.`);
    }
    const top = Math.max(...headerRow.map((i) => i.y));
    const note = onPage.find((i) => /^NOTE:/i.test(i.text.trim()));
    const bottom = note?.y ?? Number.POSITIVE_INFINITY;
    const body = onPage.filter((i) => i.y > top + 2 && i.y < bottom - 2);

    COLUMNS.forEach((column, c) => {
      const end = COLUMNS[c + 1]?.start ?? Number.POSITIVE_INFINITY;
      const items = body.filter((i) => i.x >= column.start && i.x < end);
      const anchors = items
        .filter((i) => i.x >= column.srp)
        .map((price) => ({ price, name: [], unit: [] }) as Anchor);
      const columnEntries: Entry[] = anchors.map((anchor) => ({ y: anchor.price.y, anchor }));
      for (const item of items) {
        if (item.x >= column.srp) continue;
        if (item.x < column.unit && item.font === columnHeader.font) {
          columnEntries.push({ y: item.y, header: item.text.trim().toUpperCase() });
          continue;
        }
        const nearest = closestAnchor(anchors, item.y, ROW_REACH);
        if (!nearest) orphans.push(`page ${page}: "${item.text}"`);
        else (item.x < column.unit ? nearest.name : nearest.unit).push(item);
      }
      entries.push(...columnEntries.sort((a, b) => a.y - b.y));
    });
  }

  const rows: DtiRow[] = [];
  // Categories run on from the bottom of one column to the top of the next.
  let category: DtiCategory | undefined;
  for (const entry of entries) {
    if ("header" in entry) {
      if (entry.header in dtiCategories) category = entry.header as DtiCategory;
      else if ((dtiParentHeaders as readonly string[]).includes(entry.header)) category = undefined;
      else throw new ExtractError(`Unknown DTI category header "${entry.header}".`);
      continue;
    }
    const { price, name, unit } = entry.anchor;
    const nameText = joinFragments(name);
    const unitText = joinFragments(unit);
    if (!category || !nameText || !unitText) {
      orphans.push(`page ${price.page}: SRP "${price.text}" with no category, name or unit`);
      continue;
    }
    rows.push({
      category,
      parentCategory: dtiCategories[category],
      name: nameText,
      spec: unitText,
      priceCentavos: parsePriceText(price.text, nameText),
    });
  }
  if (orphans.length) {
    throw new ExtractError(
      `${orphans.length} line(s) could not be placed in a row: ${orphans.slice(0, 10).join("; ")}`,
    );
  }
  return rows;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
