import { z } from "zod";

export const orgIdParamsSchema = z.object({
  orgId: z.string().trim().min(1),
});

export const invoiceIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const invoiceStatus = z.enum(["PENDING", "PAID", "OVERDUE"]);

export const createInvoiceSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  amountCents: z.number().int().min(0),
  currency: z.string().min(1).max(3).default("USD"),
  status: invoiceStatus.default("PENDING"),
  invoiceDate: isoDate,
  dueDate: isoDate.optional(),
});

export const updateInvoiceSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  amountCents: z.number().int().min(0).optional(),
  currency: z.string().min(1).max(3).optional(),
  status: invoiceStatus.optional(),
  invoiceDate: isoDate.optional(),
  dueDate: isoDate.nullable().optional(),
});
