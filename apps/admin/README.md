# Internal admin UI

Vite + React + TypeScript SPA for managing organizations and users against the Dempsey Agency API.

## Environment

| Variable | When | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Optional | Full API origin (e.g. `https://api.dempsey.agency`). Browser must be allowed by API `CORS_ORIGIN`. |
| `VITE_API_PROXY_TARGET` | Dev only | Where Vite proxies `/api` (default `https://api.dempsey.agency`). |

If `VITE_API_BASE_URL` is **unset** in development, requests use relative `/api/...` and Vite proxies to the target (avoids CORS during local dev).

Production static build: set `VITE_API_BASE_URL=https://api.dempsey.agency` (or your API URL) and ensure the API allows your admin site origin in `CORS_ORIGIN`.

## Commands

```sh
# from repo root
npm install
npm run dev -w @dempsey-agency/admin
npm run build -w @dempsey-agency/admin
npm run preview -w @dempsey-agency/admin
```

JWT is stored in `localStorage` under `dempsey_admin_jwt`.
