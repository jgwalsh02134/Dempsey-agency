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

  // Session / cookie
  SESSION_COOKIE_NAME: z.string().default("workspace_session"),
  SESSION_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  // If unset, defaults to true in production and false in development.
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),

  // Invite lifetime in days.
  INVITE_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Public URL of workspace-web. Used to construct invite acceptance links
  // returned from POST /auth/invite. If unset, the URL is derived from the
  // request origin, which works in dev but should be set explicitly in prod.
  APP_WORKSPACE_URL: z.string().url().optional(),

  // Admin bootstrap inputs (only read by scripts/bootstrap.ts)
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_NAME: z.string().optional(),
});

type RawEnv = z.infer<typeof envSchema>;

const parsed: RawEnv = envSchema.parse(process.env);

const cookieSecure =
  parsed.SESSION_COOKIE_SECURE === undefined
    ? parsed.NODE_ENV !== "development"
    : parsed.SESSION_COOKIE_SECURE === "true";

export const env = {
  ...parsed,
  SESSION_COOKIE_SECURE: cookieSecure,
};

export type Env = typeof env;

export const allowedOrigins = (env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
