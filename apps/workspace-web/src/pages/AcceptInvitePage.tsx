import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ApiError, apiJson } from "../lib/api";
import {
  AdSellMark,
  BrandMark,
  VisionDataMark,
} from "../components/brand/BrandMark";

type InviteMetadata = {
  email: string;
  name: string | null;
  role: string;
  expiresAt: string;
  isExpired: boolean;
};

type InviteLookupResponse = { invite: InviteMetadata };

type LoadState =
  | { status: "loading" }
  | { status: "ok"; invite: InviteMetadata }
  | { status: "error"; message: string };

const MIN_PASSWORD_LENGTH = 12;

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const navigate = useNavigate();
  const { acceptInvite } = useAuth();

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [name, setName] = useState("");
  const [nameInitialized, setNameInitialized] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoad({ status: "error", message: "Missing invite token." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiJson<InviteLookupResponse>(
          `/api/workspace/auth/invite/${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        if (res.invite.isExpired) {
          setLoad({
            status: "error",
            message:
              "This invite has expired. Ask your administrator to resend it.",
          });
        } else {
          setLoad({ status: "ok", invite: res.invite });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setLoad({ status: "error", message: err.message });
        } else {
          setLoad({
            status: "error",
            message: "Unable to load invite. Please try again.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (load.status === "ok" && !nameInitialized) {
      setName(load.invite.name ?? "");
      setNameInitialized(true);
    }
  }, [load, nameInitialized]);

  const canSubmit = useMemo(() => {
    return (
      load.status === "ok" &&
      !submitting &&
      password.length >= MIN_PASSWORD_LENGTH &&
      password === confirm
    );
  }, [load, submitting, password, confirm]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (load.status !== "ok") return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvite(token, password, name.trim() || undefined);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message || "Could not accept invite. Please try again.");
      } else {
        setError("Could not accept invite. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <BrandMark variant="lockup" className="auth-lockup" alt="Dempsey" />
      </div>

      <main className="auth-main" role="main">
        <section className="auth-card" aria-labelledby="invite-heading">
          <header className="auth-card-header">
            <span className="page-header-eyebrow">Team workspace</span>
            <h1 id="invite-heading">Accept invite</h1>
            {load.status === "ok" ? (
              <p>Finish setting up your account to access the workspace.</p>
            ) : load.status === "loading" ? (
              <p>Checking your invite…</p>
            ) : (
              <p>We couldn't load this invite.</p>
            )}
          </header>

          {load.status === "loading" && (
            <div className="auth-form">
              <p className="muted small">Loading…</p>
            </div>
          )}

          {load.status === "error" && (
            <div className="auth-form">
              <p className="auth-error" role="alert">
                {load.message}
              </p>
              <a href="/login" className="btn btn-ghost btn-block">
                Go to sign in
              </a>
            </div>
          )}

          {load.status === "ok" && (
            <form className="auth-form" onSubmit={onSubmit} noValidate>
              <div className="field">
                <label htmlFor="invite-email">Email</label>
                <input
                  id="invite-email"
                  type="email"
                  value={load.invite.email}
                  readOnly
                  disabled
                  autoComplete="username"
                />
              </div>

              <div className="field">
                <label htmlFor="invite-name">Name (optional)</label>
                <input
                  id="invite-name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="field">
                <label htmlFor="invite-password">Password</label>
                <input
                  id="invite-password"
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
                <span className="auth-admin-note" style={{ textAlign: "left" }}>
                  Minimum {MIN_PASSWORD_LENGTH} characters.
                </span>
              </div>

              <div className="field">
                <label htmlFor="invite-confirm">Confirm password</label>
                <input
                  id="invite-confirm"
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={!canSubmit}
              >
                {submitting ? "Creating account…" : "Create account"}
              </button>

              <p className="auth-admin-note">
                You've been invited as <strong>{load.invite.role}</strong>.
              </p>
            </form>
          )}
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
