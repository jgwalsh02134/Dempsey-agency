import { z } from "zod";

export const createAgencyClientSchema = z.object({
  agencyId: z.string().trim().min(1),
  clientId: z.string().trim().min(1),
});
