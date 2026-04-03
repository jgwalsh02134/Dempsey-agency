# Internal admin UI

Vite + React + TypeScript SPA for managing organizations and users against the Dempsey Agency API.

## Environment

| Variable | When | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Production build & optional dev | API origin without trailing slash (e.g. `https://api.dempsey.agency`). **Set in Cloudflare Pages** for production. |
| `VITE_API_PROXY_TARGET` | Dev only | Where Vite proxies `/api` when `VITE_API_BASE_URL` is unset (default `https://api.dempsey.agency`). |

### Local development

If `VITE_API_BASE_URL` is **unset**, requests use `/api/...` on the dev server and Vite proxies to the API (no CORS setup needed).

### Production build

`vite build` inlines `import.meta.env.VITE_API_BASE_URL`. Set it in the build environment (Cloudflare Pages → **Settings** → **Environment variables** → **Production**).

See `.env.production.example` for the expected value.

## Cloudflare Pages

Deploy as a **static site** (no server-side code).

### Monorepo root as Pages root

| Setting | Value |
|---|---|
| **Build command** | `npm ci && npm run build -w @dempsey-agency/admin` |
| **Build output directory** | `apps/admin/dist` |
| **Root directory** | `/` (repository root) |

**Environment variables (Production):**

| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://api.dempsey.agency` |

(Optional: set the same for **Preview** if previews should hit the real API.)

Ensure API **`CORS_ORIGIN`** includes your Pages URL (e.g. `https://admin.dempsey.agency` or `https://<project>.pages.dev`).

`public/_redirects` provides SPA fallback so React Router paths load `index.html`.

### `apps/admin` as Pages root

If the project root is `apps/admin`, use **Build command** `npm ci && npm run build` and **output** `dist` (install must still resolve dependencies; for a hoisted monorepo, prefer building from the repo root as above).

## Commands

```sh
# from repo root
npm install
npm run dev -w @dempsey-agency/admin
npm run build -w @dempsey-agency/admin
npm run preview -w @dempsey-agency/admin
```

JWT is stored in `localStorage` under `dempsey_admin_jwt`.
