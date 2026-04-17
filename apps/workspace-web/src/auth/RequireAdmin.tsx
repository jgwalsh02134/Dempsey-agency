import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/**
 * Frontend guard for admin-only routes. The backend enforces admin access
 * authoritatively via requireAdmin on every protected endpoint; this guard
 * is UX polish that prevents non-admins from even seeing the page shell.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="auth-loader" role="status" aria-label="Loading" />;
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
