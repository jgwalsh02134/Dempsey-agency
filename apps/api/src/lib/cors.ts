export type CorsResolution = { mode: "wildcard" } | { mode: "list"; origins: string[] };

type CorsEnvInput = {
  NODE_ENV: string;
  CORS_ORIGIN?: string | undefined;
  CORS_ORIGINS?: string | undefined;
};

/**
 * Resolves allowed browser origins from CORS_ORIGINS (preferred) or CORS_ORIGIN.
 * Comma-separated lists are supported in either variable.
 * Use `*` only in non-production for an open policy.
 */
export function resolveCorsConfig(env: CorsEnvInput): CorsResolution {
  const raw =
    env.CORS_ORIGINS?.trim() ||
    env.CORS_ORIGIN?.trim() ||
    (env.NODE_ENV === "production" ? "" : "*");

  if (!raw) {
    throw new Error(
      "Set CORS_ORIGINS (comma-separated) or CORS_ORIGIN in production — e.g. https://dempsey.agency,https://admin.dempsey.agency",
    );
  }

  if (raw === "*") {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "CORS wildcard (*) is not allowed when NODE_ENV=production; set explicit origins",
      );
    }
    return { mode: "wildcard" };
  }

  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("CORS_ORIGINS / CORS_ORIGIN parsed to an empty origin list");
  }

  return { mode: "list", origins };
}
