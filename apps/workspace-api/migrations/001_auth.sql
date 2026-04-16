-- 001_auth.sql — initial auth schema (invite-only, no self-signup)
-- Postgres 13+ ships gen_random_uuid() in core; no extension required.

-- Users. Accounts are created by admins only (bootstrap script or invite flow).
CREATE TABLE IF NOT EXISTS workspace_user (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT          NOT NULL UNIQUE,
  password_hash        TEXT          NOT NULL,
  name                 TEXT,
  role                 TEXT          NOT NULL DEFAULT 'member',
  is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
  must_reset_password  BOOLEAN       NOT NULL DEFAULT FALSE,
  invited_at           TIMESTAMPTZ,
  invited_by           UUID          REFERENCES workspace_user(id) ON DELETE SET NULL,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Email is stored pre-normalized (lowercased, trimmed) by the application.
-- Unique constraint on the raw column is sufficient given that discipline.

-- Sessions. DB-backed so logout is server-side revocable without a denylist.
-- The id is a 256-bit random token (base64url) issued by the app and
-- carried in an httpOnly cookie.
CREATE TABLE IF NOT EXISTS workspace_session (
  id            TEXT          PRIMARY KEY,
  user_id       UUID          NOT NULL REFERENCES workspace_user(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ   NOT NULL,
  last_seen_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ip_address    INET,
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_workspace_session_user_id
  ON workspace_session(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_session_expires_at
  ON workspace_session(expires_at);
