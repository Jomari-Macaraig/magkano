import type { TaggingAnswer, TaggingClient } from "./openai.ts";

/** One Ingredient or Commodity to tag, keyed as in `tag-assignments.json`. */
export type TaggingItem = { key: string; text: string; context: string };

export type TagAssignment = {
  tag: string | null;
  proposedNewTag: string | null;
  status: "proposed" | "reviewed";
};

/** Assignment key → Tag Assignment, as stored in `tag-assignments.json`. */
export type TagAssignments = Record<string, TagAssignment>;

export type TagRunResult = {
  assignments: TagAssignments;
  /** Items still without an entry after every attempt, with why. */
  unresolved: { key: string; reason: string }[];
  /** Keys of entries whose Ingredient or Commodity no longer exists; kept, not deleted. */
  stale: string[];
};

/** How many times one item is asked before it is reported unresolved. */
const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_SIZE = 40;

/**
 * Proposes a Tag for every item that has no entry yet, in batches. An answer with a slug
 * outside the vocabulary, no answer, or a failed request is asked again, up to 3 times in
 * all; what is still left is reported in `unresolved`, and everything answered is kept.
 */
export async function runTag(options: {
  items: TaggingItem[];
  tagSlugs: string[];
  assignments: TagAssignments;
  client: TaggingClient;
  batchSize?: number;
}): Promise<TagRunResult> {
  const { items, tagSlugs, client, batchSize = DEFAULT_BATCH_SIZE } = options;
  const vocabulary = new Set(tagSlugs);
  const assignments = { ...options.assignments };
  const failures = new Map<string, string>();

  let pending = items.filter((item) => !(item.key in assignments));
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length > 0; attempt++) {
    const retry: TaggingItem[] = [];
    for (let start = 0; start < pending.length; start += batchSize) {
      const batch = pending.slice(start, start + batchSize);
      let answers: TaggingAnswer[];
      try {
        answers = await client.tagItems({
          items: batch.map((item, i) => ({
            ref: String(i),
            text: item.text,
            context: item.context,
          })),
          tagSlugs,
        });
      } catch (error) {
        const reason = `request failed: ${error instanceof Error ? error.message : String(error)}`;
        for (const item of batch) failures.set(item.key, reason);
        retry.push(...batch);
        continue;
      }
      const byRef = new Map<string, TaggingAnswer>(answers.map((a) => [a.ref, a]));
      batch.forEach((item, i) => {
        const answer = byRef.get(String(i));
        if (!answer) {
          failures.set(item.key, "no answer");
          retry.push(item);
        } else if (answer.tag !== null && !vocabulary.has(answer.tag)) {
          failures.set(item.key, `unknown Tag "${answer.tag}"`);
          retry.push(item);
        } else {
          failures.delete(item.key);
          assignments[item.key] = {
            tag: answer.tag,
            proposedNewTag: answer.proposedNewTag,
            status: "proposed",
          };
        }
      });
    }
    pending = retry;
  }

  const current = new Set(items.map((item) => item.key));
  return {
    assignments,
    unresolved: [...failures].map(([key, reason]) => ({ key, reason })),
    stale: Object.keys(assignments)
      .filter((key) => !current.has(key))
      .sort(),
  };
}
