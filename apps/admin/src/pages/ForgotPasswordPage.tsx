import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send a reset link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="card auth-card">
        {sent ? (
          <>
            <h1>Check your email</h1>
            <p className="muted">
              If an admin account exists for that address, a reset link is on its way.
            </p>
            <Link to="/login">Back to sign in</Link>
          </>
        ) : (
          <>
            <h1>Reset password</h1>
            <p className="muted">We’ll email a link to choose a new admin password.</p>
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
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p>
              <Link to="/login">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
