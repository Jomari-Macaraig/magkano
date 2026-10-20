import { describe, expect, it } from "vitest";
import { daDropReason, parseCountWeight } from "./da-commodity";
import { dtiCommodityTerms, dtiDropReason } from "./dti-commodity";

describe("parseCountWeight", () => {
  it.each([
    ["13-15 pcs/kg", { countUnit: "piece", countWeightG: 71.429 }],
    ["Medium (4-6 pcs/kg)", { countUnit: "piece", countWeightG: 200 }],
    ["Ripe, 3-4 pcs/kg", { countUnit: "piece", countWeightG: 285.714 }],
    ["Medium (151-250gm/pc)", { countUnit: "piece", countWeightG: 200.5 }],
    ["56-60 grams/pc", { countUnit: "piece", countWeightG: 58 }],
    ["510 gm - 1 kg/head", { countUnit: "head", countWeightG: 755 }],
    ["750 gm - 1 kg/head", { countUnit: "head", countWeightG: 875 }],
    ["Medium (301-400 g)", { countUnit: "piece", countWeightG: 350.5 }],
    ["Fresh, Loose, Medium (150-300 gm)", { countUnit: "piece", countWeightG: 225 }],
    ["3-4 Small Bundles", { countUnit: "bundle", countWeightG: 285.714 }],
  ])("%s", (spec, expected) => {
    expect(parseCountWeight(spec)).toEqual(expected);
  });

  it.each([
    [""],
    ["Medium (8-10 cm diameter/bunch hd)"],
    ["Large (1-2 pcs)"],
    ["5% broken"],
    ["350 ml/bottle"],
  ])("finds no weight in %j", (spec) => {
    expect(parseCountWeight(spec)).toBeNull();
  });
});

describe("daDropReason", () => {
  it("drops Feed Grade rows, wherever DA writes it", () => {
    expect(daDropReason({ name: "Corn Grits (Feed Grade)", spec: "" })).toBe("feed grade");
    expect(daDropReason({ name: "Corn", spec: "Yellow, Feed Grade" })).toBe("feed grade");
    expect(daDropReason({ name: "Corn Grits (White, Food Grade)", spec: "" })).toBeNull();
  });
});

describe("dtiDropReason", () => {
  const row = (category: string, name: string) => ({ category, name });

  it("drops candles, soaps and batteries as not food", () => {
    for (const category of ["CANDLES", "TOILET SOAP", "DETERGENT SOAP/LAUNDRY SOAP", "BATTERIES"]) {
      expect(dtiDropReason(row(category, "Anything"))).toBe("not food");
    }
  });

  it("drops all water", () => {
    for (const category of ["DISTILLED WATER", "PURIFIED WATER", "MINERALIZED WATER"]) {
      expect(dtiDropReason(row(category, "Wilkins"))).toBe("water");
    }
  });

  it("keeps rows with no region, Luzon or Nationwide, and drops other regions", () => {
    expect(dtiDropReason(row("IODIZED SALT", "Lasap Iodized Salt"))).toBeNull();
    expect(dtiDropReason(row("IODIZED SALT", "Fidel Refined (Blue) - Luzon"))).toBeNull();
    expect(dtiDropReason(row("CORNED BEEF", "Argentina - Nationwide"))).toBeNull();
    for (const name of [
      "Fidel Refined (Blue) - Visayas / Mindanao",
      "Fidel Coarse (Red) - Visayas/ Mindanao",
      "Fidel Free Flowing (Green) - Visayas & Mindanao",
      "Fidel Refined (Blue) - Mindanao",
    ]) {
      expect(dtiDropReason(row("IODIZED SALT", name))).toBe("outside Luzon");
    }
  });

  it("keeps channel qualifiers, which are not regions", () => {
    expect(dtiDropReason(row("CORNED BEEF", "El Rancho - SMKT"))).toBeNull();
    expect(dtiDropReason(row("MEAT LOAF", "Winner - Supermarket (SMKT)"))).toBeNull();
    expect(dtiDropReason(row("PATIS - DOY PACK / BUDGET PACK", "Lorins - Pouch"))).toBeNull();
  });
});

describe("dtiCommodityTerms", () => {
  it.each([
    ["155g", { amount: 155, unit: "g" }],
    ["1kg", { amount: 1000, unit: "g" }],
    ["370mL", { amount: 370, unit: "ml" }],
    ["1L", { amount: 1000, unit: "ml" }],
    ["6.6L", { amount: 6600, unit: "ml" }],
  ])("prices %s as one pack", (spec, pack) => {
    expect(dtiCommodityTerms({ name: "Some pack", spec })).toMatchObject({
      priceBasis: pack,
      purchaseUnit: pack,
    });
  });

  it("fails on a kept row whose pack size it can't read", () => {
    expect(() => dtiCommodityTerms({ name: "Mystery can", spec: "#03" })).toThrow(
      'No pack size (g, kg, mL or L) in "#03" of "Mystery can".',
    );
  });
});
