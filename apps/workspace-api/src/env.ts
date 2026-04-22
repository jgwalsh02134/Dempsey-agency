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
  // If unset, defaults to "none" in production (required when the web app
  // and API are served from different eTLD+1s, e.g. workspace.dempsey.agency
  // ↔ *.up.railway.app) and "lax" in development.
  SESSION_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).optional(),
  // If unset, defaults to true in production and false in development.
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),

  // Invite lifetime in days.
  INVITE_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Public URL of workspace-web. Used to construct invite acceptance links
  // returned from POST /auth/invite. If unset, the URL is derived from the
  // request origin, which works in dev but should be set explicitly in prod.
  APP_WORKSPACE_URL: z.string().url().optional(),

  // OpenAI key for AI-generated publisher summaries.
  OPENAI_API_KEY: z.string().min(1).optional(),

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

const cookieSameSite: "lax" | "strict" | "none" =
  parsed.SESSION_COOKIE_SAMESITE ??
  (parsed.NODE_ENV === "production" ? "none" : "lax");

export const env = {
  ...parsed,
  SESSION_COOKIE_SECURE: cookieSecure,
  SESSION_COOKIE_SAMESITE: cookieSameSite,
};

export type Env = typeof env;

export const allowedOrigins = (env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
