import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      if (e instanceof ApiError) {
        setFormError(e.message);
      } else if (e instanceof TypeError) {
        setFormError(
          "Unable to reach the server. Please check your connection and try again.",
        );
      } else {
        setFormError("Something went wrong. Please try again.");
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
        </div>

        {sent ? (
          <>
            <h1 className="auth-page-heading">Check your email</h1>
            <p className="auth-body">
              If an account exists for <strong>{email}</strong>, we've sent
              password reset instructions. The link expires in 1 hour.
            </p>
            <div className="auth-footer" style={{ marginTop: "1.75rem" }}>
              <Link to="/login" className="back-link">
                ← Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="auth-page-heading">Reset your password</h1>
            <p className="auth-body">
              Enter the email address associated with your account and we'll
              send you a link to reset your password.
            </p>

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

              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                className="btn-submit"
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send Reset Link"}
              </button>
            </form>

            <div className="auth-footer" style={{ marginTop: "1.75rem" }}>
              <Link to="/login" className="back-link">
                ← Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
