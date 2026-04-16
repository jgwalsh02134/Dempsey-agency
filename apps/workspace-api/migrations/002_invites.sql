-- 002_invites.sql — invite tokens for admin-provisioned accounts.
-- Single-use, expiring, revocable. The user row is NOT created until acceptance.

CREATE TABLE IF NOT EXISTS workspace_invite (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  token                TEXT          NOT NULL UNIQUE,
  email                TEXT          NOT NULL,
  name                 TEXT,
  role                 TEXT          NOT NULL,
  invited_by           UUID          NOT NULL REFERENCES workspace_user(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at           TIMESTAMPTZ   NOT NULL,
  accepted_at          TIMESTAMPTZ,
  revoked_at           TIMESTAMPTZ,
  accepted_by_user_id  UUID          REFERENCES workspace_user(id) ON DELETE SET NULL
);

-- Lookup by email for "revoke outstanding invites" sweeps on re-invite.
CREATE INDEX IF NOT EXISTS idx_workspace_invite_email
  ON workspace_invite(email);

-- Lookup for expiry sweeps / housekeeping.
CREATE INDEX IF NOT EXISTS idx_workspace_invite_expires_at
  ON workspace_invite(expires_at);
