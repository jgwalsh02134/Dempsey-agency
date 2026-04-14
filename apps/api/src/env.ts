import { z } from "zod";
import { resolveCorsConfig } from "./lib/cors.js";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().default(3000),
  /** Single origin or comma-separated list (legacy name). */
  CORS_ORIGIN: z.string().optional(),
  /** Preferred: comma-separated allowed origins (e.g. marketing + admin). */
  CORS_ORIGINS: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  JWT_SECRET: z.string().default("unsafe-dev-secret"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  /** S3-compatible object storage (Cloudflare R2, AWS S3, MinIO, etc.) */
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  /** OpenAI API key for AI-assisted features (creative review, etc.) */
  OPENAI_API_KEY: z.string().optional(),

  /** Transactional email (Resend). All optional — when `RESEND_API_KEY` is
   *  unset, sendEmail() is a logged no-op so dev/CI work without credentials.
   *  EMAIL_FROM should be a verified sender, e.g.
   *  "Dempsey Agency <notifications@example.com>". */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /** Public base URLs used to build CTA links in outgoing emails. */
  APP_PORTAL_URL: z.string().url().optional(),
  APP_ADMIN_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === "production") {
  if (env.JWT_SECRET === "unsafe-dev-secret") {
    throw new Error(
      "JWT_SECRET must be set to a strong random value in production (e.g. openssl rand -base64 48)",
    );
  }
}

export const corsConfig = resolveCorsConfig(env);
