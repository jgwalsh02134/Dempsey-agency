# Dempsey Agency monorepo

Static marketing site at the repo root (index.html, contact.html, login.html, request-access.html, activate-account.html, assets/, favicons). Cloudflare Pages auto-deploys on push to main.

## Apps
- apps/api           → api.dempsey.agency       (Railway, platform)
- apps/portal        → portal.dempsey.agency    (Railway, platform)
- apps/admin         → admin.dempsey.agency     (Cloudflare Pages)
- apps/workspace-api → internal                 (Railway, workspace)
- apps/workspace-web → workspace.dempsey.agency (Railway, workspace)

## Two Railway projects, two Postgres databases
- dempsey-platform:  api + portal + Postgres
- dempsey-workspace: workspace-api + workspace-web + Postgres

NEVER write code that queries across the two databases.

## App-specific rules
See apps/<name>/CLAUDE.md where present.

## Global guardrails
- No new dependencies without asking
- No secrets in code; env vars live in Railway / Cloudflare
- DB changes via migration only
- Don't git push; I handle deploys
