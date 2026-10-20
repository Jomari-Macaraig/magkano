import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Commodity,
  extractFromItems,
  extractPublication,
  formatPublicationFile,
  type PublicationFile,
} from "./extract.ts";
import { type PdfItem, readPdfItems } from "./pdf-text.ts";

const sample = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../../../sample/${name}`, import.meta.url)));
const DA_PDF = "Daily-Price-Index-October-8-2026.pdf";
const DTI_PDF = "BNPC+SRP+BULLETIN.11+MAY+2026.0010.PSU+[CLEAN+A3-final].pdf";
const HASH = "0".repeat(64);

const finder = (file: () => PublicationFile) => (name: string, spec?: string) =>
  file().commodities.filter((c) => c.name === name && (spec === undefined || c.spec === spec));

describe("extractPublication on the DA October 8, 2026 sample", () => {
  let file: PublicationFile;
  beforeAll(async () => {
    file = await extractPublication(sample(DA_PDF));
  });
  const find = finder(() => file);

  it("reads the source and date from the header", () => {
    expect(file.publication).toMatchObject({
      source: "DA",
      title: "Daily Price Index NCR (Thursday, October 8, 2026)",
      publishedOn: "2026-10-08",
    });
    expect(file.publication.fileHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("finds all 204 rows, 155 of them priced", () => {
    const rows = [...file.commodities, ...file.dropped];
    expect(rows).toHaveLength(204);
    expect(rows.filter((r) => r.priceCentavos !== null)).toHaveLength(155);
  });

  it("drops the feed grade rows, with their reason", () => {
    expect(file.dropped).toEqual([
      {
        category: "CORN PRODUCTS",
        name: "Corn Cracked (Yellow, Feed Grade)",
        spec: "",
        priceCentavos: expect.any(Number),
        reason: "feed grade",
      },
      {
        category: "CORN PRODUCTS",
        name: "Corn Grits (Feed Grade)",
        spec: "",
        priceCentavos: expect.any(Number),
        reason: "feed grade",
      },
    ]);
  });

  it("writes a meat row priced per kg and bought by 250 g", () => {
    expect(find("Pork Picnic Shoulder (Kasim), Imported")).toEqual<Commodity[]>([
      {
        key: "DA:PORK MEAT PRODUCTS:Pork Picnic Shoulder (Kasim), Imported:",
        category: "PORK MEAT PRODUCTS",
        name: "Pork Picnic Shoulder (Kasim), Imported",
        spec: "",
        origin: "Imported",
        brand: null,
        sizeLabel: null,
        priceCentavos: 23789,
        priceBasis: { amount: 1000, unit: "g" },
        purchaseUnit: { amount: 250, unit: "g" },
        countUnit: null,
        countWeightG: null,
      },
    ]);
  });

  it("reassembles wrapped names and specs, and keeps n/a as a null price", () => {
    expect(find("Tambakol (Yellow-Fin Tuna), Local")[0]).toMatchObject({
      spec: "Medium, Fresh or Chilled",
      priceCentavos: 28078,
      sizeLabel: "Medium",
    });
    expect(find("Ginger, Local")[0]?.spec).toBe("Fresh, Loose, Medium (150-300 gm)");
    expect(find("Broccoli, Local")[0]).toMatchObject({
      spec: "Medium (8-10 cm diameter/bunch hd)",
      priceCentavos: null,
    });
  });

  it("prices cooking oil per bottle, not per litre", () => {
    expect(find("Cooking Oil (Palm)").map((c) => [c.priceBasis, c.purchaseUnit])).toEqual([
      [
        { amount: 350, unit: "ml" },
        { amount: 350, unit: "ml" },
      ],
      [
        { amount: 1000, unit: "ml" },
        { amount: 1000, unit: "ml" },
      ],
    ]);
    expect(find("Cooking Oil (Palm Olein, Jolly Brand)")[0]).toMatchObject({
      brand: "Jolly",
      priceCentavos: 16089,
      priceBasis: { amount: 1000, unit: "ml" },
    });
  });

  it("prices eggs per piece", () => {
    expect(find("Chicken Egg (White, Medium)")[0]).toMatchObject({
      priceBasis: { amount: 1, unit: "piece" },
      purchaseUnit: { amount: 1, unit: "piece" },
      countUnit: "piece",
      countWeightG: 58,
    });
  });

  it("buys produce by the piece when the spec gives a weight, else by 250 g", () => {
    expect(find("Red Onion, Local")[0]).toMatchObject({
      purchaseUnit: { amount: 1, unit: "piece" },
      countUnit: "piece",
      countWeightG: 71.429,
    });
    expect(find("Cabbage (Scorpio)")[0]).toMatchObject({
      purchaseUnit: { amount: 1, unit: "piece" },
      countUnit: "head",
      countWeightG: 875,
    });
    expect(find("Garlic, Native/Local")[0]).toMatchObject({
      origin: "Native/Local",
      purchaseUnit: { amount: 250, unit: "g" },
      countWeightG: null,
    });
  });

  it("buys rice, sugar and salt by the kg", () => {
    for (const name of ["Well Milled", "Sugar (Brown)", "Salt (Rock)"]) {
      expect(find(name)[0]?.purchaseUnit).toEqual({ amount: 1000, unit: "g" });
    }
  });

  it("keeps rows that differ only by spec apart, with the brand read from the spec", () => {
    expect(find("Chicken Breast, Local").map((c) => [c.spec, c.brand])).toEqual([
      ["Magnolia", "Magnolia"],
      ["Bounty Fresh", "Bounty Fresh"],
      ["Unbranded, Fresh", null],
    ]);
  });

  it("never reads a DTI brand into a DA row, nor a bundle's size as the produce's", () => {
    expect(find("Banana (Saba)")[0]?.brand).toBeNull();
    expect(find("Eggplant")[0]).toMatchObject({ countUnit: "bundle", sizeLabel: null });
  });

  it("carries categories across pages", () => {
    const counts: Record<string, number> = {};
    for (const r of [...file.commodities, ...file.dropped]) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    }
    expect(counts).toEqual({
      "IMPORTED COMMERCIAL RICE": 7,
      "LOCAL COMMERCIAL RICE": 5,
      "CORN PRODUCTS": 6,
      LEGUMES: 1,
      "FISH PRODUCTS": 20,
      "BEEF MEAT PRODUCTS": 30,
      "PORK MEAT PRODUCTS": 24,
      "OTHER LIVESTOCK MEAT PRODUCTS": 9,
      "POULTRY PRODUCTS": 35,
      "LOWLAND VEGETABLES": 7,
      "HIGHLAND VEGETABLES": 24,
      SPICES: 12,
      FRUITS: 10,
      "OTHER BASIC COMMODITIES": 14,
    });
  });

  it("produces an identical file when re-run on the same PDF", async () => {
    const again = await extractPublication(sample(DA_PDF));
    expect(formatPublicationFile(again)).toBe(formatPublicationFile(file));
  });
});

describe("extractPublication on the DTI 11 May 2026 sample", () => {
  let file: PublicationFile;
  beforeAll(async () => {
    file = await extractPublication(sample(DTI_PDF));
  });
  const find = finder(() => file);

  it("reads the source and effective date from the header", () => {
    expect(file.publication).toMatchObject({
      source: "DTI",
      title: "BNPC Suggested Retail Prices (effective 11 May 2026)",
      publishedOn: "2026-05-11",
    });
  });

  it("keeps 75 Luzon food rows of the 167, every one priced", () => {
    expect(file.commodities.length + file.dropped.length).toBe(167);
    expect(file.commodities).toHaveLength(75);
    expect(file.commodities.every((c) => c.priceCentavos !== null)).toBe(true);
  });

  it("writes one SRP per pack, the pack also being the Purchase Unit", () => {
    expect(find("Saba Philippines Sardines")).toEqual<Commodity[]>([
      {
        key: "DTI:CANNED SARDINES IN TOMATO SAUCE:Saba Philippines Sardines:155g",
        category: "CANNED SARDINES IN TOMATO SAUCE",
        name: "Saba Philippines Sardines",
        spec: "155g",
        origin: null,
        brand: "Saba",
        sizeLabel: "155g",
        priceCentavos: 2150,
        priceBasis: { amount: 155, unit: "g" },
        purchaseUnit: { amount: 155, unit: "g" },
        countUnit: null,
        countWeightG: null,
      },
    ]);
    expect(find("Angel Filled Milk")[0]?.priceBasis).toEqual({ amount: 370, unit: "ml" });
    expect(find("Lasap Rock Salt", "1kg")[0]?.priceBasis).toEqual({ amount: 1000, unit: "g" });
  });

  it("reassembles a name wrapped over several lines", () => {
    expect(
      find("Lucky Me! (Instant Mami Chicken na Chicken and Instant Mami Beef na Beef)")[0],
    ).toMatchObject({ brand: "Lucky Me!", spec: "55g", priceCentavos: 900 });
  });

  it("drops non-food and all water, and keeps no such category", () => {
    const reasons: Record<string, number> = {};
    for (const d of file.dropped) reasons[d.reason] = (reasons[d.reason] ?? 0) + 1;
    expect(reasons).toEqual({
      "not food": expect.any(Number),
      water: expect.any(Number),
      "outside Luzon": 6,
    });
    const kept = new Set(file.commodities.map((c) => c.category));
    for (const category of [
      "CANDLES",
      "TOILET SOAP",
      "BATTERIES",
      "DISTILLED WATER",
      "PURIFIED WATER",
      "MINERALIZED WATER",
    ]) {
      expect(kept.has(category)).toBe(false);
    }
  });

  it("keeps Luzon rows and channel qualifiers in the name, and drops other regions", () => {
    expect(find("Fidel Refined (Blue) - Luzon").map((c) => c.spec)).toEqual(["250g", "500g"]);
    expect(find("El Rancho - SMKT")).toHaveLength(2);
    expect(find("Winner - Supermarket (SMKT)")[0]?.brand).toBe("Winner");
    expect(file.commodities.some((c) => /visayas|mindanao/i.test(c.name))).toBe(false);
  });

  it("produces an identical file when re-run on the same PDF", async () => {
    const again = await extractPublication(sample(DTI_PDF));
    expect(formatPublicationFile(again)).toBe(formatPublicationFile(file));
  });
});

describe("extractFromItems on a broken layout", () => {
  let da: PdfItem[];
  let dti: PdfItem[];
  beforeAll(async () => {
    da = await readPdfItems(sample(DA_PDF));
    dti = await readPdfItems(sample(DTI_PDF));
  });
  const replaceText = (items: PdfItem[], from: string, to: string) => {
    let done = false;
    return items.map((i) => {
      if (done || i.text.trim() !== from) return i;
      done = true;
      return { ...i, text: to };
    });
  };

  it("reads the unmodified items", () => {
    expect(extractFromItems(da, HASH).commodities).toHaveLength(202);
    expect(extractFromItems(dti, HASH).commodities).toHaveLength(75);
  });

  it("fails on an unknown category header", () => {
    expect(() => extractFromItems(replaceText(da, "FRUITS", "TROPICAL FRUITS"), HASH)).toThrow(
      'Unknown DA category header "TROPICAL FRUITS".',
    );
    expect(() => extractFromItems(replaceText(dti, "BREAD", "BAKERY"), HASH)).toThrow(
      'Unknown DTI category header "BAKERY".',
    );
  });

  it("fails on a line that belongs to no row", () => {
    const anchor = da.find((i) => i.page === 2 && i.x >= 440);
    if (!anchor) throw new Error("no price on page 2");
    const stray: PdfItem = { ...anchor, x: 300, y: anchor.y + 30, text: "Stray note" };
    // Place it between rows, far from any price.
    const ys = da.filter((i) => i.page === 2 && i.x >= 440).map((i) => i.y);
    const gap = ys.sort((a, b) => a - b).find((y, n) => (ys[n + 1] ?? 0) - y > 20);
    if (gap === undefined) throw new Error("no gap between rows on page 2");
    expect(() => extractFromItems([...da, { ...stray, y: gap + 10.5 }], HASH)).toThrow(
      /could not be placed in a row: page 2: "Stray note"/,
    );
  });

  it("fails on a price that is neither a number nor n/a", () => {
    expect(() => extractFromItems(replaceText(da, "237.89", "23T.89"), HASH)).toThrow(
      /Price "23T.89" .* neither a number nor n\/a/,
    );
    expect(() => extractFromItems(replaceText(dti, "21.50", "2I.50"), HASH)).toThrow(
      /Price "2I.50" .* neither a number nor n\/a/,
    );
  });

  it("fails on a row count outside the source's range", () => {
    const lastPage = Math.max(...da.map((i) => i.page));
    const fewer = da.filter((i) => i.page === 1 || i.page === lastPage);
    expect(() => extractFromItems(fewer, HASH)).toThrow(
      /Found \d+ rows; a DA Publication has 150-260/,
    );
  });

  it("fails on a PDF that is neither source", () => {
    expect(() =>
      extractFromItems(
        da.filter((i) => i.page !== 1),
        HASH,
      ),
    ).toThrow(/neither a DA Daily Price Index nor a DTI SRP bulletin/);
  });
});
