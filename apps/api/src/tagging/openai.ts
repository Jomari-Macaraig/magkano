import OpenAI from "openai";
import { z } from "zod";

export const TAGGING_MODEL = "gpt-6-luna";

/** One thing to tag. `ref` is a short id local to the request; `context` is the Recipe name or category. */
export type TaggingRequestItem = { ref: string; text: string; context: string };

export type TaggingRequest = { items: TaggingRequestItem[]; tagSlugs: string[] };

/** `tag` null with a proposal: no Tag fits. `tag` null and no proposal: not food for people. */
export type TaggingAnswer = { ref: string; tag: string | null; proposedNewTag: string | null };

/**
 * The only way `tag` reaches the LLM, so tests swap in a stub. Answers are returned as the
 * model gave them: checking slugs and refs is the caller's job.
 */
export interface TaggingClient {
  tagItems(request: TaggingRequest): Promise<TaggingAnswer[]>;
}

const INSTRUCTIONS = `You tag Philippine foods with one Tag from a fixed vocabulary.
Each item is either a recipe ingredient (context: the recipe name) or a price-list row (context: its DA/DTI category).
For each item, pick the single most specific Tag slug that the item is (a child Tag is a more specific form of its parent).
Origin, brand, grade, size and price-list category are never Tags: ignore them when choosing.
If no Tag fits a food for people, set tag to null and propose a new English kebab-case singular slug in proposedNewTag.
If the item is not food for people (e.g. animal feed), set both to null.
Answer with one entry per item, echoing its ref.`;

function taggingSchema(tagSlugs: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ref", "tag", "proposedNewTag"],
          properties: {
            ref: { type: "string" },
            tag: { anyOf: [{ type: "string", enum: tagSlugs }, { type: "null" }] },
            proposedNewTag: { type: ["string", "null"] },
          },
        },
      },
    },
  };
}

/** The response shape; slugs and refs are checked by the caller, not here. */
const responseSchema = z.object({
  items: z.array(
    z.object({
      ref: z.string(),
      tag: z.string().nullable(),
      proposedNewTag: z.string().nullable(),
    }),
  ),
});

/**
 * Structured Outputs with the whole vocabulary as a strict enum, low reasoning effort. The
 * SDK is built on the first request, so a run with nothing to tag needs no key.
 */
export function createOpenAiTaggingClient(apiKey: string | undefined): TaggingClient {
  let sdk: OpenAI | undefined;
  return {
    async tagItems(request) {
      if (request.items.length === 0) return [];
      sdk ??= new OpenAI({ apiKey, timeout: 120_000, maxRetries: 2 });
      const response = await sdk.chat.completions.create({
        model: TAGGING_MODEL,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: INSTRUCTIONS },
          {
            role: "user",
            content: JSON.stringify(
              request.items.map((i) => ({ ref: i.ref, item: i.text, context: i.context })),
            ),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "tagging", strict: true, schema: taggingSchema(request.tagSlugs) },
        },
      });
      const content = response.choices[0]?.message.content;
      if (!content) throw new Error("Tagging returned no content");
      return responseSchema.parse(JSON.parse(content)).items;
    },
  };
}
