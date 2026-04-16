import { z } from "zod";

const envSchema = z.object({
  WORKSPACE_DATABASE_URL: z
    .string()
    .min(1, "WORKSPACE_DATABASE_URL is required"),
  PORT: z.coerce.number().default(3100),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  CORS_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

export const allowedOrigins = (env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
