import { describe, expect, it, vi } from "vitest";
import { realSeedPlan } from "../../test/seed-plan";
import {
  chunkHash,
  type EmbeddingCache,
  embedRecipeChunks,
  formatEmbeddingCache,
  parseEmbeddingCache,
} from "./embeddings";

const plan = await realSeedPlan();

/** A stub embedder: each text's vector is [its length, 1]. */
const stubEmbedder = () => vi.fn(async (texts: string[]) => texts.map((text) => [text.length, 1]));

describe("embedRecipeChunks", () => {
  it("builds two chunks per Recipe and embeds them all when nothing is cached", async () => {
    const embed = stubEmbedder();

    const { chunks, cache, embedded } = await embedRecipeChunks(plan, {}, embed);

    expect(chunks).toHaveLength(40);
    expect(embedded).toBe(40);
    const adoboTitle = chunks.find((c) => c.recipeId === "chicken-adobo" && c.kind === "title");
    const text = "Chicken Adobo. Chicken braised in soy sauce, vinegar and garlic.";
    expect(adoboTitle).toEqual({
      recipeId: "chicken-adobo",
      kind: "title",
      content: text,
      embedding: [text.length, 1],
    });
    expect(cache[chunkHash(text)]).toEqual([text.length, 1]);
    expect(Object.keys(cache)).toHaveLength(40);
  });

  it("makes no call when every chunk is cached", async () => {
    const first = await embedRecipeChunks(plan, {}, stubEmbedder());
    const embed = stubEmbedder();

    const second = await embedRecipeChunks(plan, first.cache, embed);

    expect(embed).not.toHaveBeenCalled();
    expect(second.embedded).toBe(0);
    expect(second.chunks).toEqual(first.chunks);
    expect(second.cache).toEqual(first.cache);
  });

  it("embeds only new text and writes its vector back", async () => {
    const { cache } = await embedRecipeChunks(plan, {}, stubEmbedder());
    const changed = structuredClone(plan);
    const adobo = changed.recipes.find((r) => r.id === "chicken-adobo");
    if (!adobo) throw new Error("no adobo");
    adobo.description = "Chicken stewed in vinegar and soy sauce.";
    const embed = stubEmbedder();

    const result = await embedRecipeChunks(changed, cache, embed);

    const newTitle = "Chicken Adobo. Chicken stewed in vinegar and soy sauce.";
    expect(embed).toHaveBeenCalledExactlyOnceWith([newTitle]);
    expect(result.embedded).toBe(1);
    expect(result.cache[chunkHash(newTitle)]).toEqual([newTitle.length, 1]);
  });

  it("drops cached vectors no chunk uses any more", async () => {
    const stale: EmbeddingCache = { [chunkHash("an old title")]: [1, 2] };

    const { cache } = await embedRecipeChunks(plan, stale, stubEmbedder());

    expect(cache).not.toHaveProperty(chunkHash("an old title"));
  });

  it("fails when the embedder returns the wrong number of vectors", async () => {
    await expect(embedRecipeChunks(plan, {}, async () => [[1]])).rejects.toThrow(/vectors/);
  });
});

describe("the embeddings.json file", () => {
  it("round-trips through its stable format, one entry per line, sorted by hash", () => {
    const cache: EmbeddingCache = { b: [0.5, -0.25], a: [1, 2] };

    const text = formatEmbeddingCache(cache);

    expect(text).toBe('{\n  "a": [1,2],\n  "b": [0.5,-0.25]\n}\n');
    expect(parseEmbeddingCache(JSON.parse(text), 2)).toEqual(cache);
  });

  it("rejects a vector of the wrong size", () => {
    expect(() => parseEmbeddingCache({ a: [1, 2, 3] }, 2)).toThrow();
  });
});
