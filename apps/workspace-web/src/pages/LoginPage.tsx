import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AdSellMark, BrandMark, VisionDataMark } from "../components/brand/BrandMark";

type LocationState = { from?: string } | null;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, signIn } = useAuth();
  const redirectTo = (location.state as LocationState)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }

    setSubmitting(true);
    // Temporary client-only session flag — replace with a real call to
    // workspace-api when backend auth is wired up. See AuthProvider.tsx.
    window.setTimeout(() => {
      signIn(email);
      setSubmitting(false);
      navigate(redirectTo, { replace: true });
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
            <span className="page-header-eyebrow">Team workspace</span>
            <h1 id="auth-heading">Sign in</h1>
            <p>Access the agency planning and research workspace.</p>
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
        <div className="auth-platforms" aria-label="Platform">
          <AdSellMark className="auth-platform-mark" />
          <span className="auth-platform-sep" aria-hidden="true">·</span>
          <VisionDataMark className="auth-platform-mark" />
        </div>
      </footer>
    </div>
  );
}
