import { z } from "zod";

export const orgIdParamsSchema = z.object({
  orgId: z.string().trim().min(1),
});

export const campaignIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const campaignStatus = z.enum(["ACTIVE", "PAUSED", "COMPLETED"]);

export const createCampaignSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  status: campaignStatus.default("ACTIVE"),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});

export const updateCampaignSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: campaignStatus.optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
});
