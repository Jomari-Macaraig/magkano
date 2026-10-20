import type { Source } from "../db/schema";

/**
 * Brands printed in each source's sample Publication. A Commodity's brand is the longest of its
 * source's brands found as whole words in its name or spec; an unlisted brand leaves it null.
 * Lists are per source because a DTI brand can be a DA variety ("Saba" sardines, "Banana (Saba)").
 */
const knownBrands: Record<Source, string[]> = {
  DA: ["Magnolia", "Bounty Fresh", "Jolly", "Minola", "Spring"],
  DTI: [
    "555",
    "Angel",
    "Argentina",
    "Atami",
    "Bear Brand",
    "Bingo",
    "Birch Tree",
    "Blend 45",
    "Café Puro",
    "CDO",
    "Datu Puti",
    "El Rancho",
    "Fidel",
    "Great Taste",
    "Ho-Mi",
    "Jersey",
    "King Cup",
    "Kopiko",
    "Lasap",
    "Lorins",
    "Lucky 7",
    "Lucky Me!",
    "Mariko",
    "Mikado",
    "Nelicom",
    "Nescafe",
    "Payless",
    "Pinoy",
    "Purefoods",
    "Quick Chow",
    "Saba",
    "Sallenas",
    "San Mig",
    "Silver Swan",
    "Star",
    "Toyo",
    "Winner",
    "Young's Town",
  ],
};

const wholeWord = (brand: string) =>
  new RegExp(`(?<![\\w])${brand.replace(/[.*+?^${}()|[\]\\!]/g, "\\$&")}(?![\\w])`, "i");

const patterns = Object.fromEntries(
  Object.entries(knownBrands).map(([source, brands]) => [
    source,
    [...brands]
      .sort((a, b) => b.length - a.length)
      .map((brand) => ({ brand, pattern: wholeWord(brand) })),
  ]),
) as Record<Source, { brand: string; pattern: RegExp }[]>;

export function brandOf(source: Source, row: { name: string; spec: string }): string | null {
  const text = `${row.name} ${row.spec}`;
  return patterns[source].find((p) => p.pattern.test(text))?.brand ?? null;
}
