import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255).optional(),
});

export const userParamsSchema = z.object({
  id: z.string().min(1),
});
