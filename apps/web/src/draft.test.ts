import { describe, expect, it } from "vitest";
import {
  addRecipe,
  DRAFT_KEY,
  type Draft,
  emptyDraft,
  loadDraft,
  pruneDraft,
  removeRecipe,
  saveDraft,
  setLineState,
  setServings,
} from "./draft";

/** A minimal in-memory Storage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

const stored = (value: unknown) => memoryStorage({ [DRAFT_KEY]: JSON.stringify(value) });

const draft: Draft = {
  recipes: [
    { id: "chicken-adobo", servings: 4 },
    { id: "sinigang-na-baboy", servings: 6 },
  ],
  lines: {
    chicken: { haveIt: true },
    "untagged:patis": { overrideCentavos: 2500 },
  },
};

describe("Draft storage", () => {
  it("round-trips a Draft under magkano.draft.v1, in the request shape", () => {
    const storage = memoryStorage();
    saveDraft(storage, draft);

    expect(JSON.parse(storage.items.get("magkano.draft.v1") ?? "")).toMatchObject(draft);
    expect(loadDraft(storage)).toEqual(draft);
  });

  it("starts empty with nothing stored, no storage, or storage that throws", () => {
    expect(loadDraft(memoryStorage())).toEqual(emptyDraft);
    expect(loadDraft(undefined)).toEqual(emptyDraft);
    expect(loadDraft(throwing)).toEqual(emptyDraft);
    expect(() => saveDraft(throwing, draft)).not.toThrow();
  });

  it("starts empty on corrupt or wrong-version data", () => {
    expect(loadDraft(memoryStorage({ [DRAFT_KEY]: "{not json" }))).toEqual(emptyDraft);
    expect(loadDraft(stored(null))).toEqual(emptyDraft);
    expect(loadDraft(stored({ ...draft, version: 2 }))).toEqual(emptyDraft);
    expect(loadDraft(stored({ version: 1, recipes: "nope", lines: {} }))).toEqual(emptyDraft);
    expect(
      loadDraft(stored({ version: 1, recipes: [{ id: "a", servings: 99 }], lines: {} })),
    ).toEqual(emptyDraft);
    expect(
      loadDraft(stored({ version: 1, recipes: [], lines: { x: { overrideCentavos: -5 } } })),
    ).toEqual(emptyDraft);
  });
});

describe("Draft edits", () => {
  it("adds a Recipe once, at the given servings, and updates servings when re-added", () => {
    const one = addRecipe(emptyDraft, "chicken-adobo", 4);
    expect(one.recipes).toEqual([{ id: "chicken-adobo", servings: 4 }]);
    expect(addRecipe(one, "chicken-adobo", 6).recipes).toEqual([
      { id: "chicken-adobo", servings: 6 },
    ]);
  });

  it("clamps servings to 1–20 and removes Recipes", () => {
    expect(setServings(draft, "chicken-adobo", 25).recipes[0]?.servings).toBe(20);
    expect(setServings(draft, "chicken-adobo", 0).recipes[0]?.servings).toBe(1);
    expect(removeRecipe(draft, "chicken-adobo").recipes.map((r) => r.id)).toEqual([
      "sinigang-na-baboy",
    ]);
  });

  it("stops adding at 20 Recipes", () => {
    let full = emptyDraft;
    for (let i = 0; i < 21; i++) full = addRecipe(full, `r${i}`, 4);
    expect(full.recipes).toHaveLength(20);
  });

  it("patches a line's state, dropping cleared fields and empty states", () => {
    const picked = setLineState(draft, "untagged:patis", {
      pickedCommodityKey: "DTI:PATIS:Rufina:350ml",
      overrideCentavos: undefined,
    });
    expect(picked.lines["untagged:patis"]).toEqual({
      pickedCommodityKey: "DTI:PATIS:Rufina:350ml",
    });

    const cleared = setLineState(draft, "chicken", { haveIt: false });
    expect(cleared.lines).not.toHaveProperty("chicken");
  });
});

describe("pruneDraft", () => {
  it("removes state for lines no longer on the list and drops unknown Recipes", () => {
    const { draft: pruned, dropped } = pruneDraft(draft, {
      lines: [{ key: "untagged:patis" }],
      droppedRecipeIds: ["sinigang-na-baboy"],
    });

    expect(pruned).toEqual({
      recipes: [{ id: "chicken-adobo", servings: 4 }],
      lines: { "untagged:patis": { overrideCentavos: 2500 } },
    });
    expect(dropped).toEqual(["sinigang-na-baboy"]);
  });

  it("returns the same Draft when nothing changes", () => {
    const { draft: same } = pruneDraft(draft, {
      lines: [{ key: "chicken" }, { key: "untagged:patis" }],
      droppedRecipeIds: [],
    });
    expect(same).toBe(draft);
  });
});
