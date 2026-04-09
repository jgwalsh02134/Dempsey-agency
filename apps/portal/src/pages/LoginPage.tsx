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
      <div className="page-center" aria-busy="true">
        <p className="text-muted">Restoring session…</p>
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
      <div className="auth-card">
        <div className="auth-header">
          <img
            src="/favicon.svg"
            alt=""
            className="auth-mark"
            width="32"
            height="32"
          />
          <h1 className="auth-heading">Client Portal</h1>
          <p className="auth-subheading">
            Secure access for Dempsey Agency clients.
          </p>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {(localError || error) && (
            <p className="form-error" role="alert">
              {localError || error}
            </p>
          )}

          <button
            type="submit"
            className="btn-submit"
            disabled={submitting || loading}
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          <a href="/contact" className="help-link">
            Need help signing in?
          </a>
          <a href="/" className="back-link">
            ← Return to dempsey.agency
          </a>
        </div>
      </div>
    </div>
  );
}
