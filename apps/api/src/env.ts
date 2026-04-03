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
