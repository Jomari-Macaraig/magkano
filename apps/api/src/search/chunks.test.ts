import { describe, expect, it } from "vitest";
import { realSeedPlan } from "../../test/seed-plan";
import { expandQuery, recipeChunkTexts } from "./chunks";

const plan = await realSeedPlan();
const recipe = (id: string) => {
  const found = plan.recipes.find((r) => r.id === id);
  if (!found) throw new Error(`no Recipe ${id}`);
  return found;
};

describe("recipeChunkTexts", () => {
  it("makes the title chunk from the name and description", () => {
    expect(recipeChunkTexts(plan.tags, recipe("chicken-adobo")).title).toBe(
      "Chicken Adobo. Chicken braised in soy sauce, vinegar and garlic.",
    );
  });

  it("writes each Ingredient bilingually: its name, its Tag's names, then its ancestors'", () => {
    const { ingredients } = recipeChunkTexts(plan.tags, recipe("lechon-kawali"));

    expect(ingredients).toMatch(/^Ingredients: /);
    expect(ingredients).toContain("liempo / Pork belly (a kind of Pork / baboy / karne ng baboy)");
  });

  it("never repeats a name that is already the Ingredient's own", () => {
    const { ingredients } = recipeChunkTexts(plan.tags, recipe("chicken-adobo"));

    expect(ingredients).toContain("manok / Chicken / karne ng manok;");
    expect(ingredients).toContain("bawang / Garlic;");
    expect(ingredients).toContain("toyo / Soy sauce;");
  });

  it("keeps an untagged Ingredient as its name", () => {
    const { ingredients } = recipeChunkTexts(plan.tags, {
      name: "Test",
      description: "A test.",
      ingredients: [{ name: "mystery leaf", tag: null }],
    });

    expect(ingredients).toBe("Ingredients: mystery leaf.");
  });
});

describe("expandQuery", () => {
  it("follows a known food with its Tag's aliases", () => {
    expect(expandQuery(plan.tags, "something with pork")).toBe(
      "something with pork (pork / baboy / karne ng baboy)",
    );
  });

  it("works the same for Tagalog", () => {
    expect(expandQuery(plan.tags, "Bawang")).toBe("bawang (garlic / bawang)");
  });

  it("matches the longest alias first", () => {
    expect(expandQuery(plan.tags, "karne ng baboy")).toBe(
      "karne ng baboy (pork / baboy / karne ng baboy)",
    );
    expect(expandQuery(plan.tags, "pork belly")).toBe("pork belly (pork belly / liempo)");
  });

  it("leaves a query with no known food as its words", () => {
    expect(expandQuery(plan.tags, "  Adobo! ")).toBe("adobo");
  });
});
