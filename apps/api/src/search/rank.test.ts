import { describe, expect, it } from "vitest";
import { type ChunkSimilarity, rankBySimilarity } from "./rank";

const card = (name: string) => ({
  id: name.toLowerCase().replace(/ /g, "-"),
  name,
  description: `${name}.`,
  servings: 4,
});

/** Ranks cards named after the keys, each with the given title and Ingredients similarity. */
function rank(similarities: Record<string, [title: number, ingredients: number]>) {
  const cards = Object.keys(similarities).map(card);
  const byId = new Map<string, ChunkSimilarity>(
    cards.map((c) => {
      const [title, ingredients] = similarities[c.name] ?? [0, 0];
      return [c.id, { title, ingredients }];
    }),
  );
  return rankBySimilarity(cards, byId).map((c) => c.name);
}

describe("rankBySimilarity", () => {
  it("weighs the title 0.6 and the Ingredients 0.4", () => {
    // A: 0.6 × 0.8 + 0.4 × 0.2 = 0.56. B: 0.6 × 0.5 + 0.4 × 0.9 = 0.66.
    expect(rank({ A: [0.8, 0.2], B: [0.5, 0.9] })).toEqual(["B", "A"]);
    // A: 0.6 × 0.9 + 0.4 × 0.2 = 0.62. B: 0.6 × 0.5 + 0.4 × 0.7 = 0.58.
    expect(rank({ A: [0.9, 0.2], B: [0.5, 0.7] })).toEqual(["A", "B"]);
  });

  it("returns at most 8 cards", () => {
    const many = Object.fromEntries(
      "ABCDEFGHIJ".split("").map((name, i) => [name, [0.9 - i * 0.01, 0.9] as [number, number]]),
    );

    expect(rank(many)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
  });

  it("hides anything below half the top score", () => {
    // Scores 0.8, 0.4 (exactly half: kept) and 0.36 (hidden).
    expect(rank({ Top: [0.8, 0.8], Half: [0.4, 0.4], Low: [0.36, 0.36] })).toEqual(["Top", "Half"]);
  });

  it("breaks ties by name", () => {
    expect(rank({ Pinakbet: [0.5, 0.5], Adobo: [0.5, 0.5], Menudo: [0.7, 0.7] })).toEqual([
      "Menudo",
      "Adobo",
      "Pinakbet",
    ]);
  });

  it("scores a Recipe with no chunks as 0", () => {
    const cards = [card("A"), card("B")];

    expect(rankBySimilarity(cards, new Map([["a", { title: 0.5, ingredients: 0.5 }]]))).toEqual([
      cards[0],
    ]);
  });
});
