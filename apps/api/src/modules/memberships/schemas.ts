import { z } from "zod";

export const createMembershipSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  role: z.enum([
    "AGENCY_OWNER",
    "AGENCY_ADMIN",
    "STAFF",
    "CLIENT_ADMIN",
    "CLIENT_USER",
  ]),
});
