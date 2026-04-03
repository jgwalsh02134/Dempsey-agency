import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("*"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  JWT_SECRET: z.string().default("unsafe-dev-secret"),
  JWT_EXPIRES_IN: z.string().default("7d"),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
