import { z } from "zod";
import type { PriceRequest } from "./price.ts";

export const MAX_RECIPES = 20;
export const MAX_LINE_STATES = 200;
export const MAX_SERVINGS = 20;

const lineStateSchema = z.strictObject({
  haveIt: z.boolean().optional(),
  pickedCommodityKey: z.string().min(1).optional(),
  overrideCentavos: z.number().int().min(0).optional(),
  includeOptional: z.boolean().optional(),
});

/** The `POST /api/price` body: the Draft exactly as the device stores it. */
export const priceRequestSchema = z.strictObject({
  recipes: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        servings: z.number().int().min(1).max(MAX_SERVINGS),
      }),
    )
    .max(MAX_RECIPES)
    .refine((rs) => new Set(rs.map((r) => r.id)).size === rs.length, "Recipe ids must be unique"),
  lines: z
    .record(z.string().min(1), lineStateSchema)
    .refine((lines) => Object.keys(lines).length <= MAX_LINE_STATES, {
      message: `at most ${MAX_LINE_STATES} line states`,
    }),
}) satisfies z.ZodType<PriceRequest>;
