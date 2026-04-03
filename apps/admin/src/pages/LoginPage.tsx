import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { token, session, login, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  if (token && session) {
    return <Navigate to={from} replace />;
  }
  if (token && !session && loading) {
    return (
      <div className="auth-layout muted" aria-busy="true">
        Restoring session…
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch {
      setLocalError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="card auth-card">
        <h1>Internal admin</h1>
        <p className="muted">Sign in with your Dempsey Agency account.</p>
        <form onSubmit={onSubmit} className="stack">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {(localError || error) && (
            <p className="error" role="alert">
              {localError || error}
            </p>
          )}
          <button type="submit" className="btn primary" disabled={submitting || loading}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
