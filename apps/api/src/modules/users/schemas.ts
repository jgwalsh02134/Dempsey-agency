import { z } from "zod";

const roleEnum = z.enum([
  "AGENCY_OWNER",
  "AGENCY_ADMIN",
  "STAFF",
  "CLIENT_ADMIN",
  "CLIENT_USER",
]);

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  organizationId: z.string().min(1, "organizationId is required"),
  role: roleEnum,
});

export const userParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const patchUserRoleBodySchema = z.object({
  organizationId: z.string().trim().min(1),
  role: roleEnum,
});

/** Optional body; extra keys rejected for clarity. */
export const deactivateUserBodySchema = z.object({}).strict();
