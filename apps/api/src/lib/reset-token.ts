import { randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export function generateResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function resetTokenExpiresAt(): Date {
  return new Date(Date.now() + EXPIRY_MS);
}
