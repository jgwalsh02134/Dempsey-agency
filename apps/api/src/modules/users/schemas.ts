import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const userParamsSchema = z.object({
  id: z.string().min(1),
});
