import { z } from "zod";

export const createAccountRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  company: z.string().min(1).max(255),
  message: z.string().max(2000).optional(),
});

export const requestIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const updateAccountRequestSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});
