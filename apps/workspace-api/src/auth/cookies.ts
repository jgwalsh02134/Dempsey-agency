import type { CookieSerializeOptions } from "@fastify/cookie";
import { env } from "../env.js";

export function sessionCookieOptions(expiresAt?: Date): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: env.SESSION_COOKIE_SECURE,
    sameSite: env.SESSION_COOKIE_SAMESITE,
    path: "/",
    expires: expiresAt,
  };
}

export function sessionClearCookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: env.SESSION_COOKIE_SECURE,
    sameSite: env.SESSION_COOKIE_SAMESITE,
    path: "/",
  };
}
