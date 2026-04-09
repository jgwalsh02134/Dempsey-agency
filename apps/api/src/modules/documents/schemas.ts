import { z } from "zod";

export const orgIdParamsSchema = z.object({
  orgId: z.string().trim().min(1),
});

export const documentIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});
