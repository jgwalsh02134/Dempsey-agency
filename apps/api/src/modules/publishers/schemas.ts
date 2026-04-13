import { z } from "zod";

export const publisherIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

/** Accept empty strings for optional string fields by coercing "" → undefined. */
const optStr = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim())
    .transform((s) => (s.length === 0 ? undefined : s))
    .optional();

const optEmail = (max = 255) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim())
    .refine((s) => s.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), {
      message: "Invalid email",
    })
    .transform((s) => (s.length === 0 ? undefined : s))
    .optional();

const optUrl = (max = 500) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim())
    .refine(
      (s) => {
        if (s.length === 0) return true;
        try {
          new URL(s);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid URL" },
    )
    .transform((s) => (s.length === 0 ? undefined : s))
    .optional();

const optInt = (min = 0, max = 2_147_483_647) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? v.trim() : v))
    .transform((v) => {
      if (v === "" || v == null) return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : NaN;
    })
    .refine(
      (n) => n === undefined || (Number.isFinite(n) && n >= min && n <= max),
      { message: "Invalid number" },
    )
    .optional() as z.ZodType<number | undefined>;

export const publisherFields = {
  name: z.string().min(1).max(255),
  streetAddress: optStr(255),
  city: optStr(100),
  state: optStr(100),
  zipCode: optStr(20),
  county: optStr(100),
  country: optStr(100),
  phone: optStr(50),
  frequency: optStr(100),
  circulation: optInt(0),
  yearEstablished: optInt(1500, 2100),
  officeHours: optStr(255),
  websiteUrl: optUrl(500),
  logoUrl: optUrl(500),
  generalEmail: optEmail(255),
  transactionEmail: optEmail(255),
  corporateEmail: optEmail(255),
  contactName: optStr(255),
  parentCompany: optStr(255),
  notes: optStr(2000),
  isActive: z.boolean().default(true),
};

export const createPublisherSchema = z.object(publisherFields);

/** Update schema: all fields optional, strings/numerics nullable to allow clearing. */
const nullableOptStr = (max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((v) => (typeof v === "string" ? v.trim() : v))
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (typeof v === "string" && v.length <= max), {
      message: `Max length ${max}`,
    })
    .optional();

export const updatePublisherSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  streetAddress: nullableOptStr(255),
  city: nullableOptStr(100),
  state: nullableOptStr(100),
  zipCode: nullableOptStr(20),
  county: nullableOptStr(100),
  country: nullableOptStr(100),
  phone: nullableOptStr(50),
  frequency: nullableOptStr(100),
  circulation: z.number().int().min(0).nullable().optional(),
  yearEstablished: z.number().int().min(1500).max(2100).nullable().optional(),
  officeHours: nullableOptStr(255),
  websiteUrl: z
    .union([z.string().url().max(500), z.literal(""), z.null()])
    .transform((v) => (v === "" ? null : v))
    .optional(),
  logoUrl: z
    .union([z.string().url().max(500), z.literal(""), z.null()])
    .transform((v) => (v === "" ? null : v))
    .optional(),
  generalEmail: z
    .union([z.string().email().max(255), z.literal(""), z.null()])
    .transform((v) => (v === "" ? null : v))
    .optional(),
  transactionEmail: z
    .union([z.string().email().max(255), z.literal(""), z.null()])
    .transform((v) => (v === "" ? null : v))
    .optional(),
  corporateEmail: z
    .union([z.string().email().max(255), z.literal(""), z.null()])
    .transform((v) => (v === "" ? null : v))
    .optional(),
  contactName: nullableOptStr(255),
  parentCompany: nullableOptStr(255),
  notes: nullableOptStr(2000),
  isActive: z.boolean().optional(),
});

/** Bulk import: array of row objects, same shape as create, all validated per-row by the route. */
export const importPublishersSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
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
