import { describe, expect, it } from "vitest";
import { formatAmount, formatQuantity, ingredientLine, scaleQuantity } from "./amount";

describe("scaleQuantity", () => {
  it.each([
    [1, 4, 4, 1],
    [1, 4, 8, 2],
    [0.5, 4, 2, 0.25],
    [2, 4, 5, 2.5],
    [3, 4, 1, 0.75],
  ])("%s at %s servings → %s servings is %s", (quantity, from, to, expected) => {
    expect(scaleQuantity(quantity, from, to)).toBe(expected);
  });

  it("leaves a to-taste quantity empty", () => {
    expect(scaleQuantity(null, 4, 8)).toBeNull();
  });
});

describe("formatQuantity", () => {
  it.each([
    [1, "1"],
    [12, "12"],
    [0.5, "½"],
    [0.25, "¼"],
    [0.75, "¾"],
    [0.333, "⅓"],
    [0.666, "⅔"],
    [0.125, "⅛"],
    [2.5, "2½"],
    [1.333, "1⅓"],
    [0.999, "1"],
    [0.15, "0.15"],
    [1.1, "1.1"],
    [0.41625, "0.42"],
  ])("%s → %s", (quantity, expected) => {
    expect(formatQuantity(quantity)).toBe(expected);
  });
});

describe("formatAmount", () => {
  it.each([
    [1, "kg", "1 kg"],
    [0.5, "cup", "½ cup"],
    [2, "cup", "2 cups"],
    [1, "piece", "1 piece"],
    [3, "piece", "3 pieces"],
    [4, "clove", "4 cloves"],
    [1.5, "head", "1½ heads"],
    [2, "tbsp", "2 tbsp"],
    [250, "g", "250 g"],
    [6, null, "6"],
  ] as const)("%s %s → %s", (quantity, unit, expected) => {
    expect(formatAmount(quantity, unit)).toBe(expected);
  });
});

describe("ingredientLine", () => {
  it("scales the amount and keeps the prep note", () => {
    expect(
      ingredientLine({ quantity: 0.5, unit: "cup", prepNote: "chopped" }, { from: 4, to: 20 }),
    ).toEqual({ amount: "2½ cups", note: "chopped" });
  });

  it('shows a to-taste note in place of the amount, or "to taste" when there is none', () => {
    const at = { from: 4, to: 6 };
    expect(ingredientLine({ quantity: null, unit: null, prepNote: "for frying" }, at)).toEqual({
      amount: "for frying",
      note: null,
    });
    expect(ingredientLine({ quantity: null, unit: null, prepNote: null }, at)).toEqual({
      amount: "to taste",
      note: null,
    });
  });
});
