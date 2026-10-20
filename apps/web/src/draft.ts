// The Draft: the shopper's Recipes and line choices, kept on the device in the same shape as
// the `POST /api/price` request. Storage can be missing, throw or hold anything, so every read
// is checked and anything unexpected starts an empty Draft.
import type { LineState, PriceRequest } from "@magkano/api";

export type Draft = PriceRequest;
export type { LineState };

export const DRAFT_KEY = "magkano.draft.v1";
const VERSION = 1;
export const MAX_RECIPES = 20;
export const MAX_LINE_STATES = 200;
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 20;

export const emptyDraft: Draft = Object.freeze({ recipes: [], lines: {} }) as Draft;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** The browser's localStorage, or undefined where touching it throws. */
export function browserStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadDraft(storage: StorageLike | undefined): Draft {
  try {
    const text = storage?.getItem(DRAFT_KEY);
    return (text && parseDraft(JSON.parse(text))) || emptyDraft;
  } catch {
    return emptyDraft;
  }
}

export function saveDraft(storage: StorageLike | undefined, draft: Draft): void {
  try {
    storage?.setItem(DRAFT_KEY, JSON.stringify({ version: VERSION, ...draft }));
  } catch {
    // Not saved on this device; the Draft still works for this visit.
  }
}

/** A stored Draft the API would accept, or null. */
function parseDraft(value: unknown): Draft | null {
  if (!isRecord(value) || value.version !== VERSION) return null;
  const { recipes, lines } = value;
  if (!Array.isArray(recipes) || recipes.length > MAX_RECIPES || !isRecord(lines)) return null;
  const ids = new Set<string>();
  for (const r of recipes) {
    if (!isRecord(r) || typeof r.id !== "string" || !r.id || ids.has(r.id)) return null;
    if (!isServings(r.servings)) return null;
    ids.add(r.id);
  }
  const entries = Object.entries(lines);
  if (entries.length > MAX_LINE_STATES || !entries.every(([, s]) => isLineState(s))) return null;
  return {
    recipes: recipes.map((r) => ({ id: r.id, servings: r.servings })),
    lines: lines as Draft["lines"],
  };
}

function isLineState(s: unknown): s is LineState {
  if (!isRecord(s)) return false;
  const known = ["haveIt", "pickedCommodityKey", "overrideCentavos", "includeOptional"];
  if (Object.keys(s).some((k) => !known.includes(k))) return false;
  const { haveIt, pickedCommodityKey, overrideCentavos, includeOptional } = s;
  return (
    (haveIt === undefined || typeof haveIt === "boolean") &&
    (includeOptional === undefined || typeof includeOptional === "boolean") &&
    (pickedCommodityKey === undefined ||
      (typeof pickedCommodityKey === "string" && pickedCommodityKey.length > 0)) &&
    (overrideCentavos === undefined ||
      (Number.isInteger(overrideCentavos) && (overrideCentavos as number) >= 0))
  );
}

const isServings = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= MIN_SERVINGS && (n as number) <= MAX_SERVINGS;

const clampServings = (n: number) => Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(n)));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Adds a Recipe at `servings`, or sets its servings when it is already on the list. */
export function addRecipe(draft: Draft, id: string, servings: number): Draft {
  if (draft.recipes.some((r) => r.id === id)) return setServings(draft, id, servings);
  if (draft.recipes.length >= MAX_RECIPES) return draft;
  return { ...draft, recipes: [...draft.recipes, { id, servings: clampServings(servings) }] };
}

export function setServings(draft: Draft, id: string, servings: number): Draft {
  return {
    ...draft,
    recipes: draft.recipes.map((r) =>
      r.id === id ? { id, servings: clampServings(servings) } : r,
    ),
  };
}

export function removeRecipe(draft: Draft, id: string): Draft {
  return { ...draft, recipes: draft.recipes.filter((r) => r.id !== id) };
}

/**
 * Merges `patch` into a line's state. A field set to undefined or false is removed, and a
 * state left empty is dropped, so the stored Draft only holds real choices.
 */
export function setLineState(draft: Draft, key: string, patch: Partial<LineState>): Draft {
  const next: Record<string, unknown> = { ...draft.lines[key], ...patch };
  for (const [field, value] of Object.entries(next)) {
    if (value === undefined || value === false) delete next[field];
  }
  const lines = { ...draft.lines };
  if (Object.keys(next).length === 0) delete lines[key];
  else {
    if (!(key in lines) && Object.keys(lines).length >= MAX_LINE_STATES) return draft;
    lines[key] = next as LineState;
  }
  return { ...draft, lines };
}

/** Picks a match for a line; a line has one clear price, so any Price Override goes. */
export function pickMatch(draft: Draft, key: string, commodityKey: string): Draft {
  return setLineState(draft, key, {
    pickedCommodityKey: commodityKey,
    overrideCentavos: undefined,
  });
}

/**
 * After a price response: removes line state for lines no longer on the list and Recipes the
 * server doesn't know. Returns the same Draft object when nothing changed.
 */
export function pruneDraft(
  draft: Draft,
  response: { lines: { key: string }[]; droppedRecipeIds: string[] },
): { draft: Draft; dropped: string[] } {
  const live = new Set(response.lines.map((l) => l.key));
  const dropped = new Set(response.droppedRecipeIds);
  const staleKeys = Object.keys(draft.lines).filter((k) => !live.has(k));
  const droppedHere = draft.recipes.filter((r) => dropped.has(r.id)).map((r) => r.id);
  if (staleKeys.length === 0 && droppedHere.length === 0) return { draft, dropped: [] };
  const lines = { ...draft.lines };
  for (const key of staleKeys) delete lines[key];
  return {
    draft: { recipes: draft.recipes.filter((r) => !dropped.has(r.id)), lines },
    dropped: droppedHere,
  };
}
