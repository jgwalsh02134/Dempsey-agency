import { z } from "zod";

export const createAgencyClientSchema = z.object({
  agencyId: z.string().min(1),
  clientId: z.string().min(1),
});
