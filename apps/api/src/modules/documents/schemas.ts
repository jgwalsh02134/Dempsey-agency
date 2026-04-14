import { z } from "zod";

export const orgIdParamsSchema = z.object({
  orgId: z.string().trim().min(1),
});

export const documentIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const documentCategory = z.enum([
  "PROOF",
  "INVOICE",
  "INSERTION_ORDER",
  "CONTRACT",
  "CREATIVE_ASSET",
  "OTHER",
]);

/** PATCH /documents/:id — update metadata without re-uploading.
 *  Only `category`/`title`/`description` are editable; everything else
 *  (storage key, filename, mime type) is tied to the original upload. */
export const updateDocumentSchema = z.object({
  category: documentCategory.optional(),
  title: z.string().trim().min(1).max(255).optional(),
  description: z
    .union([z.string().max(2000), z.null()])
    .optional()
    .transform((v) => {
      if (v == null) return v;
      const trimmed = v.trim();
      return trimmed.length === 0 ? null : trimmed;
    }),
});
