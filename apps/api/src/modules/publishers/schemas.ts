import { z } from "zod";

export const publisherIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const createPublisherSchema = z.object({
  name: z.string().min(1).max(255),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  websiteUrl: z.string().url().max(500).optional(),
  logoUrl: z.string().url().max(500).optional(),
  contactEmail: z.string().email().max(255).optional(),
  circulation: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
});

export const updatePublisherSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  websiteUrl: z.string().url().max(500).nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
  circulation: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

const mediaType = z.enum(["PRINT", "DIGITAL", "EMAIL", "OTHER"]);
const pricingModel = z.enum([
  "CPM",
  "VCPM",
  "CPC",
  "CPCV",
  "FLAT",
  "COLUMN_INCH",
  "PER_LINE",
  "OTHER",
]);

export const createInventorySchema = z.object({
  name: z.string().min(1).max(255),
  mediaType,
  pricingModel: pricingModel.default("FLAT"),
  rateCents: z.number().int().min(0).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().default(true),
});

export const updateInventorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  mediaType: mediaType.optional(),
  pricingModel: pricingModel.optional(),
  rateCents: z.number().int().min(0).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const inventoryIdParamsSchema = z.object({
  inventoryId: z.string().trim().min(1),
});
