import { z } from "zod";

export const createOrganizationSchema = z
  .object({
    name: z.string().min(1).max(255),
    type: z.enum(["AGENCY", "CLIENT"]),
    /** Required when type is CLIENT — the agency org creating this client org. */
    agencyOrganizationId: z.string().trim().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "CLIENT" && !data.agencyOrganizationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "agencyOrganizationId is required when creating a client organization",
        path: ["agencyOrganizationId"],
      });
    }
    if (data.type === "AGENCY" && data.agencyOrganizationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "agencyOrganizationId must not be set for agency organizations",
        path: ["agencyOrganizationId"],
      });
    }
  });

export const orgParamsSchema = z.object({
  id: z.string().min(1),
});
