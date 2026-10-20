import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { readSeedInput } from "./input.ts";
import { runSeed, type SeedInput, type SeedPlan } from "./seed.ts";

const dataDir = fileURLToPath(new URL("../../data/", import.meta.url));

/** The real committed dataset, deep-copied so each test can break its own copy. */
const realInput = (): SeedInput => structuredClone(readSeedInput(dataDir));

// biome-ignore lint/suspicious/noExplicitAny: tests break the real data in arbitrary places.
type Json = Record<string, any>;

/** Runs seed with a spy writer; returns the problems and whether anything was written. */
async function seedWith(input: SeedInput) {
  const write = vi.fn(async (_plan: SeedPlan) => {});
  const result = await runSeed(input, write);
  return { result, write, plan: write.mock.calls[0]?.[0] };
}

describe("runSeed on the real data", () => {
  it("passes every check and writes one plan", async () => {
    const { result, write, plan } = await seedWith(realInput());

    expect(result).toEqual({ ok: true });
    expect(write).toHaveBeenCalledTimes(1);
    expect(plan?.recipes).toHaveLength(20);
  });

  it("plans Recipes keyed by seed key, with each Ingredient's reviewed Tag", async () => {
    const { plan } = await seedWith(realInput());
    const adobo = plan?.recipes.find((r) => r.id === "chicken-adobo");

    expect(adobo).toMatchObject({ name: "Chicken Adobo", servings: 4 });
    expect(adobo?.ingredients[0]).toEqual({
      position: 0,
      name: "manok",
      quantity: 1,
      unit: "kg",
      prepNote: "cut into serving pieces",
      optional: false,
      tag: "chicken",
    });
    expect(adobo?.ingredients.at(-1)).toMatchObject({ name: "asukal", optional: true });
  });

  it("plans Tags parents first, with the display name as an alias and Unit Conversions", async () => {
    const { plan } = await seedWith(realInput());
    const slugs = plan?.tags.map((t) => t.slug) ?? [];

    for (const t of plan?.tags ?? []) {
      if (t.parent) expect(slugs.indexOf(t.parent)).toBeLessThan(slugs.indexOf(t.slug));
    }
    expect(plan?.tags.find((t) => t.slug === "garlic")).toMatchObject({
      aliases: ["Garlic", "bawang"],
      conversions: [
        { unit: "clove", amount: 5, baseUnit: "g" },
        { unit: "head", amount: 40, baseUnit: "g" },
        { unit: "tbsp", amount: 9, baseUnit: "g" },
        { unit: "tsp", amount: 3, baseUnit: "g" },
      ],
    });
  });

  it("plans every Commodity but a price only for rows that have one (n/a writes none)", async () => {
    const { plan } = await seedWith(realInput());

    expect(plan?.publications.map((p) => `${p.source} ${p.publishedOn}`)).toEqual([
      "DA 2026-10-08",
      "DTI 2026-05-11",
    ]);
    expect(plan?.commodities).toHaveLength(202 + 75);
    expect(plan?.priceObservations).toHaveLength(153 + 75);
  });
});

/** Seeds a broken copy of the real data and expects exactly these problems, with no write. */
async function expectProblems(corrupt: (input: Json) => void, problems: unknown[]) {
  const input: Json = realInput();
  corrupt(input);
  const { result, write } = await seedWith(input as SeedInput);

  expect(result).toEqual({ ok: false, problems });
  expect(write).not.toHaveBeenCalled();
}

describe("runSeed checks: lists every problem and writes nothing", () => {
  it("reports each file that fails its zod schema, naming the file and field", async () => {
    await expectProblems(
      (input) => {
        input.publications[0].content.commodities[0].priceCentavos = "12.50";
        input.tagAssignments["commodity:nope"] = {
          tag: "rice",
          proposedNewTag: null,
          status: "done",
        };
        input.recipes[0].servings = 0;
      },
      [
        expect.stringMatching(/^recipes\.ts at 0\.servings: /),
        expect.stringMatching(/^tag-assignments\.json at commodity:nope\./),
        expect.stringMatching(
          /^publications\/da-2026-10-08\.json at commodities\.0\.priceCentavos: /,
        ),
      ],
    );
  });

  const tag = (slug: string, extra: Json = {}) => ({ slug, name: slug, aliases: [], ...extra });

  it("reports a Tag whose parent does not exist", async () => {
    await expectProblems(
      (input) => input.tags.push(tag("orphan", { parent: "no-such-tag" })),
      ['tags.ts: Tag "orphan" has unknown parent "no-such-tag"'],
    );
  });

  it("reports a duplicate slug", async () => {
    await expectProblems(
      (input) => input.tags.push(tag("garlic", { name: "Garlic again" })),
      ['tags.ts: slug "garlic" is used by more than one Tag'],
    );
  });

  it("reports a parent cycle", async () => {
    await expectProblems(
      (input) =>
        input.tags.push(tag("loop-a", { parent: "loop-b" }), tag("loop-b", { parent: "loop-a" })),
      ['tags.ts: Tag "loop-a" is in a parent cycle (loop-a → loop-b → loop-a)'],
    );
  });

  it("reports a Tag more than 3 levels deep", async () => {
    await expectProblems(
      (input) =>
        input.tags.push(
          tag("deep-1"),
          tag("deep-2", { parent: "deep-1" }),
          tag("deep-3", { parent: "deep-2" }),
          tag("deep-4", { parent: "deep-3" }),
        ),
      ['tags.ts: Tag "deep-4" is 4 levels deep (at most 3)'],
    );
  });

  it("reports an alias shared by two Tags, ignoring case and counting display names", async () => {
    await expectProblems(
      (input) =>
        input.tags.push(tag("dup-a", { aliases: ["BAWANG"] }), tag("dup-b", { name: "garlic" })),
      [
        'tags.ts: alias "BAWANG" of "dup-a" is already an alias of "garlic"',
        'tags.ts: alias "garlic" of "dup-b" is already an alias of "garlic"',
      ],
    );
  });

  it("reports an Ingredient or Commodity with no Tag Assignment", async () => {
    const commodity = "commodity:DA:IMPORTED COMMERCIAL RICE:Basmati Rice:";
    await expectProblems(
      (input) => {
        delete input.tagAssignments["ingredient:chicken-adobo:manok"];
        delete input.tagAssignments[commodity];
      },
      [
        "tag-assignments.json: no entry for ingredient:chicken-adobo:manok",
        `tag-assignments.json: no entry for ${commodity}`,
      ],
    );
  });

  it("reports a Tag Assignment that is still proposed", async () => {
    await expectProblems(
      (input) => {
        input.tagAssignments["ingredient:chicken-adobo:manok"].status = "proposed";
      },
      ["tag-assignments.json: ingredient:chicken-adobo:manok is proposed, not reviewed"],
    );
  });

  it("reports a Tag Assignment pointing at a slug that does not exist", async () => {
    await expectProblems(
      (input) => {
        input.tagAssignments["ingredient:chicken-adobo:manok"].tag = "unicorn";
      },
      ['tag-assignments.json: ingredient:chicken-adobo:manok has unknown Tag "unicorn"'],
    );
  });

  it("reports a duplicate Recipe seed key, Commodity key or Publication", async () => {
    await expectProblems(
      (input) => {
        input.recipes.push(structuredClone(input.recipes[0]));
        input.publications.push({ file: "da-copy.json", content: input.publications[0].content });
        const dti = input.publications[1].content.commodities;
        dti.push(structuredClone(dti[0]));
      },
      [
        'recipes.ts: seed key "chicken-adobo" is used by more than one Recipe',
        expect.stringMatching(
          /^publications\/dti-2026-05-11\.json: Commodity key "DTI:.*" appears more than once$/,
        ),
        "publications/da-copy.json: DA 2026-10-08 is already in publications/da-2026-10-08.json",
      ],
    );
  });

  it("lists problems from every check at once", async () => {
    await expectProblems(
      (input) => {
        input.tags.push(tag("orphan", { parent: "no-such-tag" }));
        delete input.tagAssignments["ingredient:chicken-adobo:manok"];
      },
      [
        'tags.ts: Tag "orphan" has unknown parent "no-such-tag"',
        "tag-assignments.json: no entry for ingredient:chicken-adobo:manok",
      ],
    );
  });
});
