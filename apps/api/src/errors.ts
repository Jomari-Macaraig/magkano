import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** The error codes the API answers with. */
export type ErrorCode = "invalid_input" | "not_found" | "internal";

/** Every error the API returns has this shape. */
export interface ErrorBody {
  error: ErrorCode;
  message: string;
}

export function errorResponse<S extends ContentfulStatusCode>(
  c: Context,
  status: S,
  code: ErrorCode,
  message: string,
) {
  return c.json({ error: code, message } satisfies ErrorBody, status);
}
