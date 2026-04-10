import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!token) {
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
          <h1 className="auth-page-heading">Invalid reset link</h1>
          <p className="auth-body">
            This password reset link is missing a token. Please request a new
            one.
          </p>
          <div className="auth-footer" style={{ marginTop: "1.75rem" }}>
            <Link to="/forgot-password" className="back-link">
              ← Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
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

  if (done) {
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
          <h1 className="auth-page-heading">Password updated</h1>
          <p className="auth-body">
            Your password has been reset. You can now sign in with your new
            password.
          </p>
          <div style={{ marginTop: "1.75rem" }}>
            <Link to="/login" className="btn-submit" style={{ textDecoration: "none" }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
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
        <h1 className="auth-page-heading">Choose a new password</h1>

        <form onSubmit={onSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="password">New password</label>
            <input
              type="password"
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              type="password"
              id="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? "Resetting…" : "Reset Password"}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: "1.75rem" }}>
          <Link to="/login" className="back-link">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
