import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ExtractError } from "./extract-error";

/** One positioned piece of text. `y` is measured from the top of the page. */
export type PdfItem = {
  page: number;
  x: number;
  y: number;
  width: number;
  font: string;
  text: string;
};

/** Every non-blank text item in the PDF, with its position and font. */
export async function readPdfItems(data: Uint8Array): Promise<PdfItem[]> {
  // pdf.js takes ownership of the buffer it is given, so hand it a copy.
  const task = getDocument({
    data: data.slice(),
    verbosity: 0,
    useSystemFonts: false,
  });
  const doc = await task.promise;
  try {
    const items: PdfItem[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const height = page.getViewport({ scale: 1 }).height;
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        items.push({
          page: p,
          x: item.transform[4],
          y: height - item.transform[5],
          width: item.width,
          font: item.fontName,
          text: normaliseText(item.str),
        });
      }
    }
    return items;
  } finally {
    await task.destroy();
  }
}

/** Straight quotes and hyphens, and single spaces. */
export function normaliseText(text: string): string {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[\s ]+/g, " ");
}

/**
 * Joins fragments into text: fragments on one line join with a space unless they
 * touch (so "4", "-", "6" stays "4-6"); a line that ends in a hyphen joins the next
 * line without a space ("(150-" + "300 gm)").
 */
export function joinFragments(items: PdfItem[], lineTolerance = 2): string {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: PdfItem[][] = [];
  for (const item of sorted) {
    const line = lines.at(-1);
    if (line?.[0] && Math.abs(line[0].y - item.y) <= lineTolerance) line.push(item);
    else lines.push([item]);
  }
  let out = "";
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    let text = "";
    let end = Number.NEGATIVE_INFINITY;
    for (const item of line) {
      const touches = item.x - end < 1;
      text += text && !touches ? ` ${item.text.trim()}` : item.text.trim();
      end = item.x + item.width;
    }
    out += out && !out.endsWith("-") ? ` ${text}` : text;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** A printed price in centavos, null for `n/a`; anything else fails the extract. */
export function parsePriceText(text: string, name: string): number | null {
  const t = text.trim();
  if (/^n\/a$/i.test(t)) return null;
  const m = t.replace(/,/g, "").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) {
    throw new ExtractError(`Price "${t}" for "${name}" is neither a number nor n/a.`);
  }
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** An ISO date from a printed day, month name and year, or null if the month is unknown. */
export function isoDate(day: string, monthName: string, year: string): string | null {
  const month = months.indexOf(monthName.toLowerCase()) + 1;
  if (!year || !day || month === 0) return null;
  return `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** A row anchored on its printed price; wrapped text lines attach to the nearest one. */
export type PriceAnchor = { price: PdfItem };

/** The anchor whose price sits nearest `y`, within `reach` points. */
export function closestAnchor<A extends PriceAnchor>(anchors: A[], y: number, reach: number) {
  let best: A | undefined;
  for (const a of anchors) {
    const d = Math.abs(a.price.y - y);
    if (d <= reach && (!best || d < Math.abs(best.price.y - y))) best = a;
  }
  return best;
}
