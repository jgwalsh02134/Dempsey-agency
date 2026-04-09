import { z } from "zod";

export const inviteTokenParamsSchema = z.object({
  token: z.string().trim().min(1),
});

export const activateInviteSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  name: z.string().min(1).max(255).optional(),
});
