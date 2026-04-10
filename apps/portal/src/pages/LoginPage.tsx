import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { MARKETING_URL } from "../api/config";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { token, session, login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
    setFormError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError) {
        setFormError(e.message);
      } else if (e instanceof TypeError) {
        setFormError(
          "Unable to reach the server. Please check your connection and try again.",
        );
      } else {
        setFormError("Unable to sign in. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-header">
          <img
            src="/brand-stack.svg"
            alt="Dempsey Agency"
            className="auth-logo"
          />
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

          <div className="form-utilities">
            <Link to="/forgot-password" className="forgot-link">
              Forgot password?
            </Link>
          </div>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
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

        <div className="auth-access">
          <p>
            Need access?{" "}
            <a href={`${MARKETING_URL}/request-account.html`}>
              Request an account
            </a>
          </p>
        </div>

        <div className="auth-footer">
          <a href={`${MARKETING_URL}/contact`} className="help-link">
            Need help signing in?
          </a>
          <a href={MARKETING_URL} className="back-link">
            ← Return to dempsey.agency
          </a>
        </div>
      </div>
    </div>
  );
}
