import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BrandMark, VisionDataMark } from "../components/brand/BrandMark";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }

    setSubmitting(true);
    // Placeholder — real auth will wire through workspace-api.
    window.setTimeout(() => {
      setSubmitting(false);
      navigate("/", { replace: true });
    }, 250);
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <BrandMark variant="lockup" className="auth-lockup" alt="Dempsey" />
      </div>

      <main className="auth-main" role="main">
        <section className="auth-card" aria-labelledby="auth-heading">
          <header className="auth-card-header">
            <span className="page-header-eyebrow">Internal workspace</span>
            <h1 id="auth-heading">Sign in</h1>
            <p>Access the Dempsey planning and research workspace.</p>
          </header>

          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@dempsey.agency"
                disabled={submitting}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="auth-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={submitting}
                />
                <span>Remember me</span>
              </label>
              <a href="#forgot" className="link">
                Forgot password?
              </a>
            </div>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </section>
      </main>

      <footer className="auth-footer">
        <span className="auth-powered-by">
          Powered by
          <VisionDataMark className="auth-powered-mark" />
          <span className="auth-powered-label">Vision Data</span>
        </span>
      </footer>
    </div>
  );
}
