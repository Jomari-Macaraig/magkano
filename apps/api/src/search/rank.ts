import type { RecipeCard } from "../recipes";

/** Cosine similarity of the query to a Recipe's two chunks. */
export type ChunkSimilarity = { title: number; ingredients: number };

/** Share of the title chunk in a Recipe's score; the Ingredients chunk gets the rest. */
export const TITLE_WEIGHT = 0.6;
/** The most results a search returns. */
export const MAX_RESULTS = 8;
/** Results scoring below this share of the top score are hidden. */
export const RELATIVE_CUTOFF = 0.5;

/**
 * Ranks Recipes by 0.6 × title + 0.4 × Ingredients similarity (a Recipe with no chunks scores
 * 0). At most 8, hiding anything below half the top score; ties go by name.
 */
export function rankBySimilarity<T extends RecipeCard>(
  cards: T[],
  similarities: Map<string, ChunkSimilarity>,
): T[] {
  const scored = cards.map((card) => {
    const sim = similarities.get(card.id);
    const score = sim ? TITLE_WEIGHT * sim.title + (1 - TITLE_WEIGHT) * sim.ingredients : 0;
    return { card, score };
  });
  scored.sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name));
  const top = scored[0]?.score ?? 0;
  if (top <= 0) return [];
  return scored
    .filter((s) => s.score >= RELATIVE_CUTOFF * top)
    .slice(0, MAX_RESULTS)
    .map((s) => s.card);
}
