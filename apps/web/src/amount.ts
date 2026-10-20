// How Ingredient amounts read on the Recipe page: scaled by servings, kitchen fractions,
// unit plurals and "to taste" notes.

/** A quantity for `from` servings, rescaled to `to` servings. "To taste" stays empty. */
export function scaleQuantity(quantity: number | null, from: number, to: number): number | null {
  return quantity === null ? null : (quantity * to) / from;
}

const fractions: [value: number, glyph: string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

/** Stored quantities have 3 decimals, so ⅓ arrives as 0.333. */
const tolerance = 0.01;

/** 2.5 → "2½", 0.333 → "⅓"; anything that isn't a kitchen fraction is a short decimal. */
export function formatQuantity(quantity: number): string {
  const whole = Math.floor(quantity + tolerance);
  const rest = quantity - whole;
  if (Math.abs(rest) < tolerance) return String(whole);
  const fraction = fractions.find(([value]) => Math.abs(rest - value) < tolerance);
  if (fraction) return `${whole === 0 ? "" : whole}${fraction[1]}`;
  return String(Number(quantity.toFixed(2)));
}

/** Units that read as words take a plural; metric and spoon units don't. */
const plurals: Record<string, string> = {
  cup: "cups",
  piece: "pieces",
  clove: "cloves",
  head: "heads",
  thumb: "thumbs",
  stalk: "stalks",
  bundle: "bundles",
  can: "cans",
  pack: "packs",
};

/** "½ cup", "4 cloves", "250 g". */
export function formatAmount(quantity: number, unit: string | null): string {
  const amount = formatQuantity(quantity);
  if (!unit) return amount;
  const plural = quantity > 1 + tolerance ? plurals[unit] : undefined;
  return `${amount} ${plural ?? unit}`;
}

/**
 * One Ingredient row at the chosen servings. A "to taste" Ingredient shows its note
 * (or "to taste") where the amount goes, so the note isn't repeated.
 */
export function ingredientLine(
  ingredient: { quantity: number | null; unit: string | null; prepNote: string | null },
  servings: { from: number; to: number },
): { amount: string; note: string | null } {
  const quantity = scaleQuantity(ingredient.quantity, servings.from, servings.to);
  if (quantity === null) return { amount: ingredient.prepNote ?? "to taste", note: null };
  return { amount: formatAmount(quantity, ingredient.unit), note: ingredient.prepNote };
}
