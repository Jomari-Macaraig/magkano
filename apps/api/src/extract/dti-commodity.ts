import type { Amount, CommodityTerms } from "./da-commodity";
import type { DtiCategory } from "./dti-parser";
import { ExtractError } from "./extract-error";

/** Leaves sold as food for people; every other DTI leaf is dropped. */
const foodCategories = new Set<string>([
  "CANNED SARDINES IN TOMATO SAUCE",
  "CONDENSED MILK",
  "EVAPORATED MILK",
  "POWDERED MILK",
  "COFFEE 3-IN-1 ORIGINAL",
  "BREAD",
  "INSTANT MAMI NOODLES CHICKEN & BEEF FLAVOR",
  "IODIZED ROCK SALT",
  "IODIZED SALT",
  "LUNCHEON MEAT",
  "MEAT LOAF",
  "CORNED BEEF",
  "BEEF LOAF",
  "VINEGAR - GIN AND PET BOTTLE",
  "VINEGAR - DOY / REFILL PACK",
  "PATIS - GIN / PET BOTTLE",
  "PATIS - DOY PACK / BUDGET PACK",
  "SOY SAUCE - GIN / PET BOTTLE",
  "SOY SAUCE - DOY PACK / REFILL PACK",
]);
const waterCategories = new Set<string>(["DISTILLED WATER", "PURIFIED WATER", "MINERALIZED WATER"]);

const regionWords = /\b(luzon|visayas|mindanao|nationwide|ncr)\b/i;
const keptRegions = /^(luzon|nationwide|ncr)$/i;

/**
 * Why a DTI row is not stored, or null to keep it: only food categories (never water), and
 * only rows with no region qualifier, "Luzon", "Nationwide" or "NCR" (which is in Luzon). Channel qualifiers such as
 * "- SMKT" are not regions and stay in the name.
 */
export function dtiDropReason(row: {
  category: DtiCategory | string;
  name: string;
}): string | null {
  if (waterCategories.has(row.category)) return "water";
  if (!foodCategories.has(row.category)) return "not food";
  const qualifier = row.name.match(/\s-\s*([^-]+)$/)?.[1]?.trim();
  if (qualifier && regionWords.test(qualifier) && !keptRegions.test(qualifier)) {
    return "outside Luzon";
  }
  return null;
}

/** A DTI SRP is for one pack as listed, and the pack is also the Purchase Unit. */
export function dtiCommodityTerms(row: { name: string; spec: string }): CommodityTerms {
  const m = row.spec.trim().match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l)$/i);
  if (!m) {
    throw new ExtractError(`No pack size (g, kg, mL or L) in "${row.spec}" of "${row.name}".`);
  }
  const value = Number(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  const pack: Amount =
    unit === "g" || unit === "kg"
      ? { amount: unit === "kg" ? value * 1000 : value, unit: "g" }
      : { amount: unit === "l" ? round(value * 1000) : value, unit: "ml" };
  return { priceBasis: pack, purchaseUnit: pack, countUnit: null, countWeightG: null };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
