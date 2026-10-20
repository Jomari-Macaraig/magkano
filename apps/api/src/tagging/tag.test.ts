import { describe, expect, it } from "vitest";
import { tags } from "../../data/tags";
import type { TaggingClient, TaggingRequest } from "./openai";
import { runTag, type TaggingItem } from "./tag";

const tagSlugs = tags.map((t) => t.slug);

const items: TaggingItem[] = [
  { key: "ingredient:chicken-adobo:bawang", text: "bawang", context: "Chicken Adobo" },
  { key: "ingredient:chicken-adobo:toyo", text: "toyo", context: "Chicken Adobo" },
  {
    key: "commodity:DA:SPICES:Garlic, Native/Local:",
    text: "Garlic, Native/Local",
    context: "SPICES",
  },
];

type Answer = { tag: string | null; proposedNewTag: string | null };

/**
 * A stand-in for the LLM: answers by item text from `answers` (a list answers successive
 * asks in turn), and records every request.
 */
function stubClient(answers: Record<string, Answer | Answer[]>) {
  const requests: TaggingRequest[] = [];
  const asked = new Map<string, number>();
  const client: TaggingClient = {
    async tagItems(request) {
      requests.push(request);
      return request.items.map((item) => {
        const n = asked.get(item.text) ?? 0;
        asked.set(item.text, n + 1);
        const entry = answers[item.text];
        const answer = Array.isArray(entry) ? entry[n] : entry;
        if (!answer) throw new Error(`no stub answer for ${item.text}`);
        return { ref: item.ref, ...answer };
      });
    },
  };
  return { client, requests, askedFor: (text: string) => asked.get(text) ?? 0 };
}

const garlic = { tag: "garlic", proposedNewTag: null };
const soy = { tag: "soy-sauce", proposedNewTag: null };

describe("runTag", () => {
  it("proposes a Tag for every item with no entry, sending the Recipe name or category along", async () => {
    const { client, requests } = stubClient({
      bawang: garlic,
      toyo: soy,
      "Garlic, Native/Local": garlic,
    });

    const result = await runTag({ items, tagSlugs, assignments: {}, client });

    expect(result.assignments).toEqual({
      "ingredient:chicken-adobo:bawang": {
        tag: "garlic",
        proposedNewTag: null,
        status: "proposed",
      },
      "ingredient:chicken-adobo:toyo": {
        tag: "soy-sauce",
        proposedNewTag: null,
        status: "proposed",
      },
      "commodity:DA:SPICES:Garlic, Native/Local:": {
        tag: "garlic",
        proposedNewTag: null,
        status: "proposed",
      },
    });
    const sent = requests.flatMap((r) => r.items);
    expect(sent.map((i) => [i.text, i.context])).toEqual([
      ["bawang", "Chicken Adobo"],
      ["toyo", "Chicken Adobo"],
      ["Garlic, Native/Local", "SPICES"],
    ]);
    expect(requests[0]?.tagSlugs).toEqual(tagSlugs);
  });

  it("re-asks for an item whose slug is not in the vocabulary", async () => {
    const { client, askedFor } = stubClient({
      bawang: garlic,
      toyo: [{ tag: "soya", proposedNewTag: null }, soy],
      "Garlic, Native/Local": garlic,
    });

    const result = await runTag({ items, tagSlugs, assignments: {}, client });

    expect(result.assignments["ingredient:chicken-adobo:toyo"]).toEqual({
      tag: "soy-sauce",
      proposedNewTag: null,
      status: "proposed",
    });
    expect(askedFor("toyo")).toBe(2);
    expect(askedFor("bawang")).toBe(1);
    expect(result.unresolved).toEqual([]);
  });

  it("writes no entry and reports the item when the slug stays unknown", async () => {
    const soya = { tag: "soya", proposedNewTag: null };
    const { client, askedFor } = stubClient({
      bawang: garlic,
      toyo: soya,
      "Garlic, Native/Local": garlic,
    });

    const result = await runTag({ items, tagSlugs, assignments: {}, client });

    expect(result.assignments).not.toHaveProperty("ingredient:chicken-adobo:toyo");
    expect(result.assignments).toHaveProperty("ingredient:chicken-adobo:bawang");
    expect(result.unresolved).toEqual([
      { key: "ingredient:chicken-adobo:toyo", reason: 'unknown Tag "soya"' },
    ]);
    expect(askedFor("toyo")).toBe(3);
  });

  it("keeps the answers it got when a request keeps failing, and reports the rest", async () => {
    const { client: answering } = stubClient({
      bawang: garlic,
      toyo: soy,
      "Garlic, Native/Local": garlic,
    });
    const client: TaggingClient = {
      async tagItems(request) {
        if (request.items.some((i) => i.text === "toyo")) throw new Error("timeout");
        return answering.tagItems(request);
      },
    };

    const result = await runTag({ items, tagSlugs, assignments: {}, client, batchSize: 1 });

    expect(Object.keys(result.assignments).sort()).toEqual([
      "commodity:DA:SPICES:Garlic, Native/Local:",
      "ingredient:chicken-adobo:bawang",
    ]);
    expect(result.unresolved).toEqual([
      { key: "ingredient:chicken-adobo:toyo", reason: "request failed: timeout" },
    ]);
  });

  it("never sends or changes an item that already has an entry", async () => {
    const reviewed = { tag: "onion", proposedNewTag: null, status: "reviewed" as const };
    const proposed = { tag: null, proposedNewTag: "soy", status: "proposed" as const };
    const { client, askedFor } = stubClient({ "Garlic, Native/Local": garlic });

    const result = await runTag({
      items,
      tagSlugs,
      assignments: {
        "ingredient:chicken-adobo:bawang": reviewed,
        "ingredient:chicken-adobo:toyo": proposed,
      },
      client,
    });

    expect(result.assignments["ingredient:chicken-adobo:bawang"]).toEqual(reviewed);
    expect(result.assignments["ingredient:chicken-adobo:toyo"]).toEqual(proposed);
    expect(askedFor("bawang")).toBe(0);
    expect(askedFor("toyo")).toBe(0);
  });

  it("reports entries whose item no longer exists, and keeps them", async () => {
    const gone = { tag: "pork", proposedNewTag: null, status: "reviewed" as const };
    const { client } = stubClient({ bawang: garlic, toyo: soy, "Garlic, Native/Local": garlic });

    const result = await runTag({
      items,
      tagSlugs,
      assignments: { "ingredient:chicken-adobo:baboy": gone },
      client,
    });

    expect(result.stale).toEqual(["ingredient:chicken-adobo:baboy"]);
    expect(result.assignments["ingredient:chicken-adobo:baboy"]).toEqual(gone);
  });

  it("makes no call when every item has an entry", async () => {
    const { client, requests } = stubClient({});
    const entry = { tag: "garlic", proposedNewTag: null, status: "reviewed" as const };

    const result = await runTag({
      items,
      tagSlugs,
      assignments: Object.fromEntries(items.map((i) => [i.key, entry])),
      client,
    });

    expect(requests).toEqual([]);
    expect(result.stale).toEqual([]);
  });
});
