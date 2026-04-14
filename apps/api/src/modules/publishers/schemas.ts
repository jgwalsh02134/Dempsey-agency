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

/** Like optInt but preserves decimal precision — used for lat/long. */
const optFloat = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? v.trim() : v))
    .transform((v) => {
      if (v === "" || v == null) return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : NaN;
    })
    .refine(
      (n) => n === undefined || (Number.isFinite(n) && n >= min && n <= max),
      { message: "Invalid number" },
    )
    .optional() as z.ZodType<number | undefined>;

export const publisherFields = {
  // Identity
  name: z.string().min(1).max(255),
  parentCompany: optStr(255),
  publicationType: optStr(100),
  frequency: optStr(100),
  circulation: optInt(0),
  yearEstablished: optInt(1500, 2100),
  isActive: z.boolean().default(true),
  // Location
  streetAddress: optStr(255),
  streetAddress2: optStr(255),
  city: optStr(100),
  state: optStr(100),
  zipCode: optStr(20),
  county: optStr(100),
  country: optStr(100),
  latitude: optFloat(-90, 90),
  longitude: optFloat(-180, 180),
  // DMA (Designated Market Area) — accepted as free text; no format enforced yet.
  dmaName: optStr(255),
  dmaCode: optStr(20),
  // Contacts
  phone: optStr(50),
  officeHours: optStr(255),
  contactName: optStr(255),
  contactTitle: optStr(255),
  // Website / reference links
  websiteUrl: optUrl(500),
  logoUrl: optUrl(500),
  rateCardUrl: optUrl(500),
  mediaKitUrl: optUrl(500),
  adSpecsUrl: optUrl(500),
  // Emails
  generalEmail: optEmail(255),
  transactionEmail: optEmail(255),
  corporateEmail: optEmail(255),
  editorialEmail: optEmail(255),
  advertisingEmail: optEmail(255),
  billingEmail: optEmail(255),
  // Other
  notes: optStr(2000),
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

const nullableOptUrl = (max: number) =>
  z
    .union([z.string().url().max(max), z.literal(""), z.null()])
    .transform((v) => (v === "" ? null : v))
    .optional();

const nullableOptEmail = (max: number) =>
  z
    .union([z.string().email().max(max), z.literal(""), z.null()])
    .transform((v) => (v === "" ? null : v))
    .optional();

export const updatePublisherSchema = z.object({
  // Identity
  name: z.string().min(1).max(255).optional(),
  parentCompany: nullableOptStr(255),
  publicationType: nullableOptStr(100),
  frequency: nullableOptStr(100),
  circulation: z.number().int().min(0).nullable().optional(),
  yearEstablished: z.number().int().min(1500).max(2100).nullable().optional(),
  isActive: z.boolean().optional(),
  // Location
  streetAddress: nullableOptStr(255),
  streetAddress2: nullableOptStr(255),
  city: nullableOptStr(100),
  state: nullableOptStr(100),
  zipCode: nullableOptStr(20),
  county: nullableOptStr(100),
  country: nullableOptStr(100),
  dmaName: nullableOptStr(255),
  dmaCode: nullableOptStr(20),
  // Contacts
  phone: nullableOptStr(50),
  officeHours: nullableOptStr(255),
  contactName: nullableOptStr(255),
  contactTitle: nullableOptStr(255),
  // Website / reference links
  websiteUrl: nullableOptUrl(500),
  logoUrl: nullableOptUrl(500),
  rateCardUrl: nullableOptUrl(500),
  mediaKitUrl: nullableOptUrl(500),
  adSpecsUrl: nullableOptUrl(500),
  // Emails
  generalEmail: nullableOptEmail(255),
  transactionEmail: nullableOptEmail(255),
  corporateEmail: nullableOptEmail(255),
  editorialEmail: nullableOptEmail(255),
  advertisingEmail: nullableOptEmail(255),
  billingEmail: nullableOptEmail(255),
  // Other
  notes: nullableOptStr(2000),
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
