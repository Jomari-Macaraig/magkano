import { describe, expect, it } from "vitest";
import { runCheck } from "./check.ts";
import type { TagAssignments } from "./tag.ts";

const proposed = (tag: string | null, proposedNewTag: string | null = null) => ({
  tag,
  proposedNewTag,
  status: "proposed" as const,
});

const assignments: TagAssignments = {
  "ingredient:chicken-adobo:bawang": proposed("garlic"),
  "ingredient:tinolang-manok:sibuyas": proposed("red-onion"),
  "ingredient:pinakbet:kamatis": { tag: "onion", proposedNewTag: null, status: "reviewed" },
  "commodity:DA:FISH PRODUCTS:Bangus, Large:Large (1-2 pcs)": proposed(null, "bangus"),
  "commodity:DA:PORK MEAT PRODUCTS:Pork Belly (Liempo), Local:": proposed("pork-belly"),
  "commodity:DA:SPICES:Garlic, Imported:": proposed("garlic"),
  "ingredient:pinakbet:bagoong": proposed(null, "shrimp-paste-sauteed"),
};

const reference = {
  "ingredient:chicken-adobo:bawang": { tag: "garlic" },
  "ingredient:tinolang-manok:sibuyas": { tag: "onion" },
  "ingredient:pinakbet:kamatis": { tag: "tomato" },
  "commodity:DA:FISH PRODUCTS:Bangus, Large:Large (1-2 pcs)": { tag: "milkfish" },
  "commodity:DA:PORK MEAT PRODUCTS:Pork Belly (Liempo), Local:": { tag: "pork-belly" },
  "ingredient:pinakbet:bagoong": { tag: null },
};

describe("runCheck", () => {
  const result = runCheck(assignments, reference);

  it("marks proposals that agree with the reference as reviewed", () => {
    expect(result.assignments["ingredient:chicken-adobo:bawang"]).toEqual({
      tag: "garlic",
      proposedNewTag: null,
      status: "reviewed",
    });
    expect(
      result.assignments["commodity:DA:PORK MEAT PRODUCTS:Pork Belly (Liempo), Local:"]?.status,
    ).toBe("reviewed");
  });

  it("leaves disagreements proposed and lists each with its reference Tag", () => {
    expect(result.assignments["ingredient:tinolang-manok:sibuyas"]).toEqual(proposed("red-onion"));
    expect(result.disagreements).toEqual([
      {
        key: "commodity:DA:FISH PRODUCTS:Bangus, Large:Large (1-2 pcs)",
        tag: null,
        proposedNewTag: "bangus",
        referenceTag: "milkfish",
      },
      {
        key: "ingredient:pinakbet:bagoong",
        tag: null,
        proposedNewTag: "shrimp-paste-sauteed",
        referenceTag: null,
      },
      {
        key: "ingredient:tinolang-manok:sibuyas",
        tag: "red-onion",
        proposedNewTag: null,
        referenceTag: "onion",
      },
    ]);
  });

  it("never accepts a proposal that still carries a new Tag, so the owner sees it", () => {
    expect(result.assignments["ingredient:pinakbet:bagoong"]?.status).toBe("proposed");
  });

  it("leaves reviewed entries alone, even when they differ from the reference", () => {
    expect(result.assignments["ingredient:pinakbet:kamatis"]).toEqual(
      assignments["ingredient:pinakbet:kamatis"],
    );
  });

  it("leaves a proposal with no reference Tag proposed and lists it", () => {
    expect(result.assignments["commodity:DA:SPICES:Garlic, Imported:"]).toEqual(proposed("garlic"));
    expect(result.noReference).toEqual(["commodity:DA:SPICES:Garlic, Imported:"]);
  });

  it("computes the agreement rate over the checked proposals, for Ingredients and Commodities", () => {
    expect(result.rates).toEqual({
      ingredients: { agreed: 1, checked: 3 },
      commodities: { agreed: 1, checked: 2 },
    });
  });
});
