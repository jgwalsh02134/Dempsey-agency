import { z } from "zod";

export const campaignIdParamsSchema = z.object({
  campaignId: z.string().trim().min(1),
});

export const submissionIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const submissionStatus = z.enum([
  "UPLOADED",
  "VALIDATION_FAILED",
  "UNDER_REVIEW",
  "NEEDS_RESIZING",
  "READY_FOR_PUBLISHER",
  "PUSHED",
]);

export const updateSubmissionSchema = z.object({
  status: submissionStatus.optional(),
  reviewNote: z.string().max(2000).nullable().optional(),
});
