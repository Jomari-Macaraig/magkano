import OpenAI from "openai";
import { EMBEDDING_DIMENSIONS, type Embedder } from "./embeddings.ts";

export const EMBEDDING_MODEL = "text-embedding-3-large";

/**
 * `text-embedding-3-large` at 1536 dimensions. The SDK is built on the first request, so a
 * seed with every chunk cached needs no key. `timeoutMs` and `maxRetries` suit the caller:
 * a query must answer fast, a seed can wait.
 */
export function createOpenAiEmbedder(
  apiKey: string | undefined,
  options: { timeoutMs: number; maxRetries: number },
): Embedder {
  let sdk: OpenAI | undefined;
  return async (texts) => {
    if (texts.length === 0) return [];
    sdk ??= new OpenAI({ apiKey, timeout: options.timeoutMs, maxRetries: options.maxRetries });
    const response = await sdk.embeddings.create({
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      input: texts,
    });
    return [...response.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  };
}
