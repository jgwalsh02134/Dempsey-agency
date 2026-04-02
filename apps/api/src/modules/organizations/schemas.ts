import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["AGENCY", "CLIENT"]),
});

export const orgParamsSchema = z.object({
  id: z.string().min(1),
});
