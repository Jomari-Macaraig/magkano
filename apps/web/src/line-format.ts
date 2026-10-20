// How priced lines read on screen. No price maths: every number and status comes from
// `POST /api/price`.
import type { Amount, Buy, LineStatus } from "@magkano/api";
import { formatAmount } from "./amount";

/** "₱1,234.50". */
export function formatPeso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** What the line needs: "2½ pieces", "1325 g", "to taste". */
export function formatNeed(need: Amount | null): string {
  if (!need) return "see recipes";
  if (need.quantity === null) return need.note || "to taste";
  if (need.unit === "g" || need.unit === "ml") return formatMetric(need.quantity, need.unit);
  return formatAmount(need.quantity, need.unit);
}

/** "6 × 250 g"; count Purchase Units read as a count: "1 head", "3 bundles". */
export function formatBuy(buy: Buy): string {
  if (buy.unit === "piece") return formatAmount(buy.units * buy.amount, buy.countUnit ?? "piece");
  return `${buy.units} × ${formatMetric(buy.amount, buy.unit)}`;
}

/** The Price Source badge: "DA Oct 8". */
export function formatSource(source: string, publishedOn: string | null): string {
  if (!publishedOn) return source;
  const day = new Date(`${publishedOn}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${source} ${day}`;
}

/** 250 g, 1325 g, 1 kg, 350 ml, 1 L: kg and L only for whole ones. */
function formatMetric(amount: number, unit: "g" | "ml"): string {
  if (amount >= 1000 && amount % 1000 === 0) return `${amount / 1000} ${unit === "g" ? "kg" : "L"}`;
  return `${Number(amount.toFixed(1))} ${unit}`;
}

export type ListLine = { key: string; status: LineStatus };
export type ListFilter = "toBuy" | "needsPrice" | "haveIt";

/**
 * The lines a filter shows. To buy is every line still to buy, priced or not, with excluded
 * optional lines listed apart under "Optional · not in total".
 */
export function filterLines<L extends ListLine>(
  lines: L[],
  filter: ListFilter,
): { main: L[]; optional: L[] } {
  const by = (...statuses: LineStatus[]) => lines.filter((l) => statuses.includes(l.status));
  if (filter === "needsPrice") return { main: by("noPrice"), optional: [] };
  if (filter === "haveIt") return { main: by("haveIt"), optional: [] };
  return { main: by("priced", "noPrice"), optional: by("optionalExcluded") };
}

/** Percentages of the total card's bar for priced, no price and have it lines. */
export function coverage(counts: { priced: number; noPrice: number; haveIt: number }) {
  const all = counts.priced + counts.noPrice + counts.haveIt;
  const share = (n: number) => (all === 0 ? 0 : (100 * n) / all);
  return {
    priced: share(counts.priced),
    noPrice: share(counts.noPrice),
    haveIt: share(counts.haveIt),
  };
}

/** Pesos as typed ("125", "1,234.50") to centavos, or null when it isn't an amount. */
export function parsePesos(text: string): number | null {
  const cleaned = text.replace(/[₱,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
