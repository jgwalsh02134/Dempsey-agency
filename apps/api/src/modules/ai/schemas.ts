import { z } from "zod";

export const reviewCreativeSchema = z.object({
  submissionId: z.string().min(1),
});
