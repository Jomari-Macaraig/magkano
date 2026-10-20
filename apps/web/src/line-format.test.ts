import { describe, expect, it } from "vitest";
import {
  coverage,
  filterLines,
  formatBuy,
  formatNeed,
  formatPeso,
  formatSource,
  type ListLine,
  parsePesos,
} from "./line-format";

describe("formatPeso", () => {
  it.each([
    [123450, "₱1,234.50"],
    [0, "₱0.00"],
    [5, "₱0.05"],
    [12345678, "₱123,456.78"],
  ])("%i centavos → %s", (centavos, text) => {
    expect(formatPeso(centavos)).toBe(text);
  });
});

describe("formatNeed", () => {
  it("reads in the Recipe's unit with kitchen fractions", () => {
    expect(formatNeed({ quantity: 2.5, unit: "piece", note: null })).toBe("2½ pieces");
    expect(formatNeed({ quantity: 1.5, unit: "kg", note: null })).toBe("1½ kg");
  });

  it("reads g and ml totals plainly, with kg and L for whole ones", () => {
    expect(formatNeed({ quantity: 1325, unit: "g", note: null })).toBe("1325 g");
    expect(formatNeed({ quantity: 2000, unit: "g", note: null })).toBe("2 kg");
    expect(formatNeed({ quantity: 1000, unit: "ml", note: null })).toBe("1 L");
  });

  it("shows the note, or 'to taste', when there is no quantity", () => {
    expect(formatNeed({ quantity: null, unit: null, note: "to taste" })).toBe("to taste");
    expect(formatNeed({ quantity: null, unit: null, note: null })).toBe("to taste");
    expect(formatNeed(null)).toBe("see recipes");
  });
});

describe("formatBuy", () => {
  it("reads weights and volumes as units × size", () => {
    expect(formatBuy({ units: 6, amount: 250, unit: "g", countUnit: null })).toBe("6 × 250 g");
    expect(formatBuy({ units: 1, amount: 1000, unit: "ml", countUnit: null })).toBe("1 × 1 L");
  });

  it("reads count Purchase Units as a count of the Commodity's count unit", () => {
    expect(formatBuy({ units: 1, amount: 1, unit: "piece", countUnit: "head" })).toBe("1 head");
    expect(formatBuy({ units: 3, amount: 1, unit: "piece", countUnit: "bundle" })).toBe(
      "3 bundles",
    );
    expect(formatBuy({ units: 2, amount: 1, unit: "piece", countUnit: null })).toBe("2 pieces");
  });
});

describe("formatSource", () => {
  it("reads as the source and a short date", () => {
    expect(formatSource("DA", "2026-10-08")).toBe("DA Oct 8");
    expect(formatSource("DTI", null)).toBe("DTI");
  });
});

const line = (key: string, status: ListLine["status"]): ListLine => ({ key, status });

describe("filterLines", () => {
  const lines = [
    line("a", "priced"),
    line("b", "noPrice"),
    line("c", "haveIt"),
    line("d", "optionalExcluded"),
    line("e", "priced"),
  ];

  it("To buy shows every line still to buy, optional ones apart; the others filter by status", () => {
    expect(filterLines(lines, "toBuy")).toEqual({
      main: [lines[0], lines[1], lines[4]],
      optional: [lines[3]],
    });
    expect(filterLines(lines, "needsPrice")).toEqual({ main: [lines[1]], optional: [] });
    expect(filterLines(lines, "haveIt")).toEqual({ main: [lines[2]], optional: [] });
  });
});

describe("coverage", () => {
  it("gives each counted status its share of the bar", () => {
    expect(coverage({ priced: 6, noPrice: 2, haveIt: 2 })).toEqual({
      priced: 60,
      noPrice: 20,
      haveIt: 20,
    });
    expect(coverage({ priced: 0, noPrice: 0, haveIt: 0 })).toEqual({
      priced: 0,
      noPrice: 0,
      haveIt: 0,
    });
  });
});

describe("parsePesos", () => {
  it.each([
    ["125", 12500],
    ["1,234.50", 123450],
    ["₱ 9.5", 950],
    ["0", 0],
  ])("%s → %i centavos", (text, centavos) => {
    expect(parsePesos(text)).toBe(centavos);
  });

  it.each(["", "abc", "-5", "1.234", "1.2.3"])("rejects %j", (text) => {
    expect(parsePesos(text)).toBeNull();
  });
});
