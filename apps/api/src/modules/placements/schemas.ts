import { z } from "zod";

export const campaignIdParamsSchema = z.object({
  campaignId: z.string().trim().min(1),
});

export const placementIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const placementStatus = z.enum([
  "DRAFT",
  "BOOKED",
  "LIVE",
  "COMPLETED",
  "CANCELLED",
]);

export const createPlacementSchema = z.object({
  inventoryId: z.string().min(1),
  name: z.string().min(1).max(255),
  status: placementStatus.default("DRAFT"),
  grossCostCents: z.number().int().min(0),
  netCostCents: z.number().int().min(0).optional(),
  quantity: z.number().int().min(1).optional(),
  notes: z.string().max(2000).optional(),
});

export const updatePlacementSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: placementStatus.optional(),
  grossCostCents: z.number().int().min(0).optional(),
  netCostCents: z.number().int().min(0).nullable().optional(),
  quantity: z.number().int().min(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** Body for POST /placements/:id/client-response. `note` is an optional
 *  single-line client comment; whitespace-only notes collapse to null. */
export const clientResponseSchema = z.object({
  response: z.enum(["PENDING_CLIENT_REVIEW", "CLIENT_APPROVED"]),
  note: z
    .union([z.string().max(1000), z.null()])
    .optional()
    .transform((v) => {
      if (v == null) return v;
      const trimmed = v.trim();
      return trimmed.length === 0 ? null : trimmed;
    }),
});
