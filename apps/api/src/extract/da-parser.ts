import { ExtractError } from "./extract-error.ts";
import { closestAnchor, isoDate, joinFragments, type PdfItem, parsePriceText } from "./pdf-text.ts";

/** DA's 14 category headers, as printed. Any other header fails the extract. */
export const daCategories = [
  "IMPORTED COMMERCIAL RICE",
  "LOCAL COMMERCIAL RICE",
  "CORN PRODUCTS",
  "LEGUMES",
  "FISH PRODUCTS",
  "BEEF MEAT PRODUCTS",
  "PORK MEAT PRODUCTS",
  "OTHER LIVESTOCK MEAT PRODUCTS",
  "POULTRY PRODUCTS",
  "LOWLAND VEGETABLES",
  "HIGHLAND VEGETABLES",
  "SPICES",
  "FRUITS",
  "OTHER BASIC COMMODITIES",
] as const;
export type DaCategory = (typeof daCategories)[number];

export const DA_ROW_RANGE = { min: 150, max: 260 } as const;

export type DaRow = {
  category: DaCategory;
  name: string;
  /** '' when the row has no specification. */
  spec: string;
  /** null for `n/a` (not available that day). */
  priceCentavos: number | null;
};

export type DaPublication = {
  source: "DA";
  title: string;
  /** ISO date, e.g. "2026-10-08". */
  publishedOn: string;
  rows: DaRow[];
};

// Column x bands of the DA template (points from the left edge).
const SPEC_X = 260;
const PRICE_X = 440;
/** How far a wrapped name or spec line may sit from its row's price. */
const ROW_REACH = 9;
/** How far apart the two lines of a wrapped category header may be. */
const HEADER_WRAP = 16;

/** Whether these PDF items look like a DA Daily Price Index (its page-1 header). */
export function isDaPublication(items: PdfItem[]): boolean {
  return /DAILY PRICE INDEX/i.test(headerText(items));
}

const headerText = (items: PdfItem[]) =>
  joinFragments(items.filter((i) => i.page === 1 && i.y < 200));

export function readDaPublication(items: PdfItem[]): DaPublication {
  const firstPage = headerText(items);
  if (!isDaPublication(items)) {
    throw new ExtractError("This is not a DA Daily Price Index (no header found).");
  }
  const [, weekday = "", monthName = "", day = "", year = ""] =
    firstPage.match(/\((\w+day), (\w+) (\d{1,2}), (\d{4})\)/i) ?? [];
  const publishedOn = isoDate(day, monthName, year);
  if (!publishedOn) {
    throw new ExtractError(
      'No publication date found in the header (expected "(Thursday, October 8, 2026)").',
    );
  }

  const rows = readRows(items);
  if (rows.length < DA_ROW_RANGE.min || rows.length > DA_ROW_RANGE.max) {
    throw new ExtractError(
      `Found ${rows.length} rows; a DA Publication has ${DA_ROW_RANGE.min}-${DA_ROW_RANGE.max}. The template may have changed.`,
    );
  }
  return {
    source: "DA",
    title: `Daily Price Index NCR (${weekday}, ${monthName} ${day}, ${year})`,
    publishedOn,
    rows,
  };
}

type Anchor = { price: PdfItem; name: PdfItem[]; spec: PdfItem[] };
type Header = { page: number; y: number; items: PdfItem[] };

function readRows(all: PdfItem[]): DaRow[] {
  const anchors: Anchor[] = [];
  const headers: Header[] = [];
  const orphans: string[] = [];

  const pages = [...new Set(all.map((i) => i.page))].sort((a, b) => a - b);
  for (const page of pages) {
    const body = tableBody(all, page);
    if (body === "notes") break;
    const { items, headerFont, endsAtNotes } = body;

    const pageAnchors = items
      .filter((i) => i.x >= PRICE_X)
      .map((price) => ({ price, name: [], spec: [] }) as Anchor);
    for (const item of items) {
      if (item.x >= PRICE_X) continue;
      if (item.x < SPEC_X && item.font === headerFont) {
        const last = headers.at(-1);
        const wrapsLast =
          last?.page === page &&
          item.y - last.y <= HEADER_WRAP &&
          !pageAnchors.some((a) => a.price.y > last.y && a.price.y < item.y);
        if (last && wrapsLast) {
          last.items.push(item);
          last.y = item.y;
        } else headers.push({ page, y: item.y, items: [item] });
        continue;
      }
      const nearest = closestAnchor(pageAnchors, item.y, ROW_REACH);
      if (!nearest) orphans.push(`page ${page}: "${item.text}"`);
      else (item.x < SPEC_X ? nearest.name : nearest.spec).push(item);
    }
    anchors.push(...pageAnchors);
    if (endsAtNotes) break;
  }

  type Entry = { page: number; y: number } & ({ header: Header } | { anchor: Anchor });
  const entries: Entry[] = [
    ...headers.map((header) => ({ page: header.page, y: header.items[0]?.y ?? header.y, header })),
    ...anchors.map((anchor) => ({ page: anchor.price.page, y: anchor.price.y, anchor })),
  ].sort((a, b) => a.page - b.page || a.y - b.y);

  const rows: DaRow[] = [];
  let category: DaCategory | undefined;
  for (const entry of entries) {
    if ("header" in entry) {
      const text = joinFragments(entry.header.items, 2).toUpperCase();
      if (!(daCategories as readonly string[]).includes(text)) {
        throw new ExtractError(`Unknown DA category header "${text}".`);
      }
      category = text as DaCategory;
      continue;
    }
    const { price, name, spec } = entry.anchor;
    const nameText = joinFragments(name);
    if (!category || !nameText) {
      orphans.push(`page ${price.page}: price "${price.text}" with no category or name`);
      continue;
    }
    rows.push({
      category,
      name: nameText,
      spec: joinFragments(spec),
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

/** The items below a page's column header, minus the footer, cut at "Note(s):". */
function tableBody(
  all: PdfItem[],
  page: number,
): "notes" | { items: PdfItem[]; headerFont: string; endsAtNotes: boolean } {
  const onPage = all.filter((i) => i.page === page);
  const notes = onPage.find((i) => /^Note\(s\):?$/i.test(i.text.trim()));
  const unitHeader = onPage.find((i) => /UNIT \(P\/UNIT\)/i.test(i.text));
  const commodityHeader = onPage.find((i) => i.text.trim().toUpperCase() === "COMMODITY");
  if (!unitHeader || !commodityHeader) {
    if (notes) return "notes";
    throw new ExtractError(`Page ${page} has no COMMODITY / PRICE column header.`);
  }
  const footer = onPage.find((i) => /^Page( \d+ of \d+)?$/.test(i.text.trim()));
  const bottom = Math.min(notes?.y ?? Infinity, footer?.y ?? Infinity);
  return {
    items: onPage.filter((i) => i.y > unitHeader.y + 2 && i.y < bottom - 2),
    headerFont: commodityHeader.font,
    endsAtNotes: Boolean(notes),
  };
}
