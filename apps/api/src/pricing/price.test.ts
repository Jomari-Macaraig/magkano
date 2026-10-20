import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { readSeedInput } from "../seed/input";
import { runSeed, type SeedPlan } from "../seed/seed";
import { type Catalog, type CatalogCommodity, catalogFromSeedPlan } from "./catalog";
import { type PriceRequest, priceDraft } from "./price";

let catalog: Catalog;

beforeAll(async () => {
  let plan: SeedPlan | undefined;
  const result = await runSeed(
    readSeedInput(join(import.meta.dirname, "../../data")),
    async (p) => {
      plan = p;
    },
  );
  if (!result.ok || !plan) throw new Error(`dataset fails seed checks: ${JSON.stringify(result)}`);
  catalog = catalogFromSeedPlan(plan);
});

/** One Recipe with these Ingredients, priced at its own servings unless `servings` is given. */
function priceIngredients(
  ingredients: Catalog["recipes"][number]["ingredients"],
  { servings = 4, lines = {} as PriceRequest["lines"], extra = [] as CatalogCommodity[] } = {},
) {
  const recipe = { id: "test", name: "Test", servings: 4, ingredients };
  return priceDraft(
    { ...catalog, recipes: [recipe], commodities: [...catalog.commodities, ...extra] },
    { recipes: [{ id: "test", servings }], lines },
  );
}

const ing = (
  name: string,
  quantity: number | null,
  unit: Catalog["recipes"][number]["ingredients"][number]["unit"],
  tag: string | null,
  extras: { optional?: boolean; prepNote?: string } = {},
) => ({
  name,
  quantity,
  unit,
  tag,
  prepNote: extras.prepNote ?? null,
  optional: extras.optional ?? false,
});

/** A 1 kg basmati Ingredient: one ₱170.00 bag. */
const basmatiKg = (optional: boolean) => ing("basmati", 1, "kg", "basmati-rice", { optional });

const matchKeys = (res: ReturnType<typeof priceDraft>, key: string) =>
  res.lines.find((l) => l.key === key)?.matches.map((m) => m.commodityKey) ?? [];

describe("priceDraft: matching", () => {
  it("prices generic chicken from chicken cuts, never chicken neck", () => {
    const res = priceIngredients([ing("manok", 1, "kg", "chicken")]);
    const line = res.lines.find((l) => l.key === "chicken");

    expect(line?.matches.map((m) => m.commodityKey)).toContain(
      "DA:POULTRY PRODUCTS:Whole Chicken, Local:Bounty Fresh",
    );
    expect(line?.matches.some((m) => m.commodityKey.includes("Neck"))).toBe(false);
    // 1 kg → 4 × 250 g of the cheapest priced cut.
    expect(line?.price.buy).toEqual({ units: 4, amount: 250, unit: "g", countUnit: null });
  });
});

describe("priceDraft: matching traps", () => {
  const keysFor = (tag: string) => matchKeys(priceIngredients([ing("x", 500, "g", tag)]), tag);

  it("kasim matches only shoulder rows, liempo only belly", () => {
    expect(keysFor("pork-shoulder").length).toBeGreaterThan(0);
    expect(keysFor("pork-shoulder").every((k) => k.includes("Shoulder"))).toBe(true);
    expect(keysFor("pork-belly").length).toBeGreaterThan(0);
    expect(keysFor("pork-belly").every((k) => k.includes("Belly"))).toBe(true);
  });

  it("sibuyas matches red and white onions; sibuyas puti only white", () => {
    const onion = keysFor("onion");
    expect(onion).toContain("DA:SPICES:Red Onion, Local:13-15 pcs/kg");
    expect(onion).toContain("DA:SPICES:White Onion, Local:");
    expect(keysFor("white-onion").every((k) => k.includes("White Onion"))).toBe(true);
  });

  it("siblings never match: red onion never prices from white onion", () => {
    expect(keysFor("red-onion").some((k) => k.includes("White"))).toBe(false);
  });

  it("gata never matches coconut oil, and tomato sauce never matches tomatoes", () => {
    expect(keysFor("coconut-milk").some((k) => k.includes("Cooking Oil"))).toBe(false);
    expect(keysFor("tomato-sauce")).not.toContain("DA:LOWLAND VEGETABLES:Tomato:15-18 pcs/kg");
  });

  it("canned sardinas never matches fresh tamban; corned beef never matches beef loaf", () => {
    expect(keysFor("canned-sardine")).not.toContain("DA:FISH PRODUCTS:Sardines (Tamban):");
    expect(keysFor("canned-sardine").length).toBeGreaterThan(0);
    expect(keysFor("corned-beef").some((k) => k.startsWith("DTI:BEEF LOAF"))).toBe(false);
  });

  it("an untagged Ingredient has no match and needs a price", () => {
    const res = priceIngredients([ing("mystery leaf", 1, "bundle", null)]);
    const line = res.lines[0];
    expect(line).toMatchObject({ key: "untagged:mystery leaf", status: "noPrice", matches: [] });
  });
});

describe("priceDraft: conversions and Purchase Units", () => {
  it("inherits a Unit Conversion from the parent Tag, unless the Tag sets its own", () => {
    // basmati has no cup conversion: it inherits rice's 185 g. Glutinous sets 200 g.
    const basmati = priceIngredients([
      ing("basmati", 1, "cup", "basmati-rice"),
      ing("basmati", 100, "g", "basmati-rice"),
    ]);
    expect(basmati.lines[0]?.need).toEqual({ quantity: 285, unit: "g", note: null });
    const glutinous = priceIngredients([
      ing("malagkit", 1, "cup", "glutinous-rice"),
      ing("malagkit", 100, "g", "glutinous-rice"),
    ]);
    expect(glutinous.lines[0]?.need).toEqual({ quantity: 300, unit: "g", note: null });
  });

  it("buys 200 g of cabbage as one whole head, priced by the Commodity's head weight", () => {
    const line = priceIngredients([ing("repolyo", 200, "g", "cabbage")]).lines[0];
    // Wonder Ball: ₱153.71/kg × 755 g = ₱116.05, cheaper than Rare Ball (755 g) and Scorpio (875 g).
    expect(line?.price).toMatchObject({
      commodityKey: "DA:HIGHLAND VEGETABLES:Cabbage (Wonder Ball):510 gm - 1 kg/head",
      buy: { units: 1, amount: 1, unit: "piece", countUnit: "head" },
      lineCentavos: 11605,
      rough: false,
    });
  });

  it("prices an unknown conversion as one Purchase Unit and flags a Rough Estimate", () => {
    // Pork belly has no piece weight anywhere on its chain.
    const res = priceIngredients([ing("liempo", 2, "piece", "pork-belly")]);
    expect(res.lines[0]?.price).toMatchObject({
      commodityKey: "DA:PORK MEAT PRODUCTS:Pork Belly (Liempo), Imported:",
      buy: { units: 1, amount: 250, unit: "g" },
      lineCentavos: 7566, // ₱302.63/kg × 250 g
      rough: true,
    });
    expect(res.total.counts.estimated).toBe(1);
  });

  it("adds one Purchase Unit for an unconvertible part, on top of the parts that convert", () => {
    // 1 kg → 4 × 250 g, plus 1 × 250 g for the 2 pieces nobody can weigh.
    const line = priceIngredients([
      ing("liempo", 1, "kg", "pork-belly"),
      ing("liempo", 2, "piece", "pork-belly"),
    ]).lines[0];
    expect(line?.price).toMatchObject({ buy: { units: 5, amount: 250 }, rough: true });
  });

  it("prices 'to taste' as one Purchase Unit, keeping its note", () => {
    const line = priceIngredients([ing("bawang", null, null, "garlic", { prepNote: "to taste" })])
      .lines[0];
    expect(line?.need).toEqual({ quantity: null, unit: null, note: "to taste" });
    expect(line?.price).toMatchObject({
      buy: { units: 1, amount: 250, unit: "g" },
      lineCentavos: 3756, // imported garlic ₱150.24/kg × 250 g
      rough: false,
    });
  });
});

describe("priceDraft: rounding and the cheapest match", () => {
  const can = (key: string, grams: number, centavos: number): CatalogCommodity => ({
    key,
    source: "DTI",
    name: key,
    spec: `${grams}g`,
    tag: "corned-beef",
    priceBasis: { amount: grams, unit: "g" },
    purchaseUnit: { amount: grams, unit: "g" },
    countUnit: null,
    countWeightG: null,
    price: { centavos, publishedOn: "2026-05-11", publicationTitle: "test" },
  });

  it("picks 2 × 260 g over 3 × 150 g when the line costs less", () => {
    const line = priceIngredients([ing("corned beef", 400, "g", "corned-beef")], {
      extra: [can("Big Can", 260, 3300)],
    }).lines[0];
    // 2 × ₱33.00 = ₱66.00 beats Bingo's 3 × ₱23.00 = ₱69.00.
    expect(line?.price).toMatchObject({ commodityKey: "Big Can", lineCentavos: 6600 });
    expect(line?.price.buy?.units).toBe(2);
    const bingo = line?.matches.find((m) => m.commodityKey === "DTI:CORNED BEEF:Bingo:150g");
    expect(bingo).toMatchObject({ buy: { units: 3 }, lineCentavos: 6900, cheapest: false });
    expect(line?.matches[0]).toMatchObject({ commodityKey: "Big Can", cheapest: true });
  });

  it("breaks a line-cost tie by the lower price per gram", () => {
    // 2 × ₱34.50 = ₱69.00 ties Bingo's ₱69.00, but ₱0.133/g beats ₱0.153/g.
    const line = priceIngredients([ing("corned beef", 400, "g", "corned-beef")], {
      extra: [can("Big Can", 260, 3450)],
    }).lines[0];
    expect(line?.price.commodityKey).toBe("Big Can");
  });

  it("lists unpriced matches last", () => {
    const line = priceIngredients([ing("repolyo", 200, "g", "cabbage")]).lines[0];
    expect(line?.matches.at(-1)).toMatchObject({
      commodityKey: "DA:HIGHLAND VEGETABLES:Cabbage, Imported:",
      lineCentavos: null,
    });
  });
});

describe("priceDraft: merging and scaling", () => {
  it("merges the same Tag across Recipes and scales each by its servings", () => {
    const res = priceDraft(catalog, {
      recipes: [
        { id: "chicken-adobo", servings: 4 },
        { id: "tinolang-manok", servings: 2 },
      ],
      lines: {},
    });
    const chicken = res.lines.find((l) => l.key === "chicken");
    expect(chicken?.fromRecipes.map((r) => [r.id, r.amount.quantity, r.amount.unit])).toEqual([
      ["chicken-adobo", 1, "kg"],
      ["tinolang-manok", 0.5, "kg"],
    ]);
    expect(chicken?.need).toEqual({ quantity: 1.5, unit: "kg", note: null });
    expect(chicken?.price.buy?.units).toBe(6); // 1500 g → 6 × 250 g
    expect(res.recipes).toEqual([
      { id: "chicken-adobo", name: "Chicken Adobo", servings: 4 },
      { id: "tinolang-manok", name: "Tinolang Manok", servings: 2 },
    ]);
  });

  it("merges untagged Ingredients by normalised name, and keeps different Tags apart", () => {
    const res = priceIngredients([
      ing("  Mystery  Leaf", 1, "bundle", null),
      ing("mystery leaf", 2, "bundle", null),
      ing("sibuyas", 1, "piece", "onion"),
      ing("pulang sibuyas", 1, "piece", "red-onion"),
    ]);
    expect(res.lines.map((l) => l.key)).toEqual(["untagged:mystery leaf", "onion", "red-onion"]);
    expect(res.lines[0]).toMatchObject({
      name: "Mystery  Leaf",
      need: { quantity: 3, unit: "bundle" },
    });
  });
});

describe("priceDraft: optional, Have It, Price Override and picks", () => {
  it("leaves an all-optional line out of the total until it is included", () => {
    const excluded = priceIngredients([basmatiKg(true)]);
    expect(excluded.lines[0]).toMatchObject({ optional: true, included: false });
    expect(excluded.lines[0]?.status).toBe("optionalExcluded");
    expect(excluded.total).toMatchObject({ centavos: 0, counts: { optionalExcluded: 1 } });

    const included = priceIngredients([basmatiKg(true)], {
      lines: { "basmati-rice": { includeOptional: true } },
    });
    expect(included.lines[0]?.status).toBe("priced");
    expect(included.total.centavos).toBe(17000);
  });

  it("counts a mixed line as required, leaving out the optional part's quantity", () => {
    const line = priceIngredients([basmatiKg(false), basmatiKg(true)]).lines[0];
    expect(line).toMatchObject({ optional: false, included: true, status: "priced" });
    expect(line?.need).toEqual({ quantity: 1, unit: "kg", note: null });
  });

  it("takes Have It lines out of the total", () => {
    const res = priceIngredients([basmatiKg(false)], {
      lines: { "basmati-rice": { haveIt: true } },
    });
    expect(res.lines[0]?.status).toBe("haveIt");
    expect(res.total).toMatchObject({ centavos: 0, counts: { haveIt: 1, priced: 0 } });
  });

  it("uses a Price Override as the line total, even on a line with no price", () => {
    const res = priceIngredients([basmatiKg(false), ing("mystery leaf", 1, "bundle", null)], {
      lines: {
        "basmati-rice": { overrideCentavos: 12345 },
        "untagged:mystery leaf": { overrideCentavos: 500 },
      },
    });
    expect(res.lines[0]?.price).toMatchObject({ lineCentavos: 12345, overridden: true });
    expect(res.lines[1]).toMatchObject({ status: "priced", price: { lineCentavos: 500 } });
    expect(res.total.centavos).toBe(12845);
  });

  it("uses a picked match, and falls back to the cheapest when it is gone", () => {
    const pick = "DA:POULTRY PRODUCTS:Whole Chicken, Local:Magnolia";
    const picked = priceIngredients([ing("manok", 1, "kg", "chicken")], {
      lines: { chicken: { pickedCommodityKey: pick } },
    }).lines[0];
    // 4 × ₱52.34 (₱209.34/kg × 250 g, rounded to the centavo).
    expect(picked?.price).toMatchObject({ commodityKey: pick, lineCentavos: 20936 });
    expect(picked?.pickUnavailable).toBe(false);

    const gone = priceIngredients([ing("manok", 1, "kg", "chicken")], {
      lines: { chicken: { pickedCommodityKey: "DA:GONE:Nothing:" } },
    }).lines[0];
    expect(gone?.pickUnavailable).toBe(true);
    expect(gone?.price.commodityKey).toBe(gone?.matches[0]?.commodityKey);
  });
});

describe("priceDraft: the request", () => {
  it("prices every match as whole units × the price of one unit", () => {
    const res = priceDraft(catalog, {
      recipes: catalog.recipes.map((r) => ({ id: r.id, servings: 7 })),
      lines: {},
    });
    const mismatched = res.lines
      .flatMap((l) => l.matches)
      .filter(
        (m) => m.unitPriceCentavos !== null && m.lineCentavos !== m.buy.units * m.unitPriceCentavos,
      );
    expect(mismatched).toEqual([]);
  });

  it("skips unknown Recipe ids into droppedRecipeIds", () => {
    const res = priceDraft(catalog, {
      recipes: [
        { id: "gone", servings: 4 },
        { id: "chicken-adobo", servings: 4 },
      ],
      lines: {},
    });
    expect(res.droppedRecipeIds).toEqual(["gone"]);
    expect(res.recipes.map((r) => r.id)).toEqual(["chicken-adobo"]);
  });

  it("ignores state for a line that is not on the list", () => {
    const res = priceIngredients([basmatiKg(false)], {
      lines: { "no-such-line": { haveIt: true } },
    });
    expect(res.lines.map((l) => l.key)).toEqual(["basmati-rice"]);
    expect(res.total.counts.haveIt).toBe(0);
  });

  it("totals and counts a whole list", () => {
    const res = priceIngredients(
      [
        basmatiKg(false), // priced ₱170.00
        ing("liempo", 2, "piece", "pork-belly"), // priced rough ₱75.66
        ing("mystery leaf", 1, "bundle", null), // no price
        ing("repolyo", 200, "g", "cabbage"), // have it
        ing("bawang", null, null, "garlic", { optional: true }), // optional, excluded
      ],
      { lines: { cabbage: { haveIt: true } } },
    );
    expect(res.total).toEqual({
      centavos: 17000 + 7566,
      counts: { priced: 2, noPrice: 1, haveIt: 1, estimated: 1, optionalExcluded: 1 },
    });
  });
});
