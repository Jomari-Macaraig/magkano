import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import { errorResponse } from "./errors.ts";

/** zod validation for any request part; a failure answers 400 `invalid_input`. */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues
        .map((issue) =>
          issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
        )
        .join("; ");
      return errorResponse(c, 400, "invalid_input", message);
    }
  });
}
