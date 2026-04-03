# @dempsey-agency/api

Fastify + Prisma backend for the Dempsey Agency B2B advertising platform.

## Required environment variables

| Variable | Description | Default | Example |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — | `postgresql://user:pass@localhost:5432/dempsey` |
| `PORT` | Server port (Railway sets automatically) | `3000` | `3001` |
| `CORS_ORIGIN` | Allowed origin for CORS | `*` | `https://dempsey.agency` |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `JWT_SECRET` | Secret for signing JWT tokens | `unsafe-dev-secret` | `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` | `24h` |

```sh
cp .env.example .env
```

> **Important**: set a real `JWT_SECRET` before deploying to production.
> Generate one with: `openssl rand -base64 48`

## Local development

```sh
# from the repo root
npm install

# generate Prisma client
npm run prisma:generate -w apps/api

# run migrations (requires running PostgreSQL)
npm run prisma:migrate -w apps/api

# seed the first agency owner account
npm run seed -w apps/api

# start dev server with hot-reload
npm run dev -w apps/api
```

## Auth flow

1. **Seed** the first agency owner (or create one via the database).
2. **Login**: `POST /api/v1/auth/login` with `{ email, password }` → returns a JWT token.
3. **Use the token**: pass `Authorization: Bearer <token>` on subsequent requests.
4. **Check identity**: `GET /api/v1/auth/me` returns the current user + org memberships.
5. **Logout**: `POST /api/v1/auth/logout` (client-side: discard the token).

### Testing auth locally

```sh
# seed the default admin account
npm run seed -w apps/api

# login
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dempsey.agency","password":"changeme123"}' \
  | jq .

# use the returned token
TOKEN="<paste token here>"
curl -s http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## Routes

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check — `{ "status": "ok" }` |
| `GET` | `/api/v1` | API version info |

### Auth (no token required for login)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Login with `{ email, password }` → JWT |
| `POST` | `/api/v1/auth/logout` | Logout (requires token) |
| `GET` | `/api/v1/auth/me` | Current user + memberships (requires token) |

### Users (authenticated)

| Method | Path | RBAC |
|---|---|---|
| `GET` | `/api/v1/users` | any authenticated user |
| `GET` | `/api/v1/users/:id` | any authenticated user |
| `POST` | `/api/v1/users` | `AGENCY_OWNER` or `AGENCY_ADMIN` |

### Organizations (authenticated)

| Method | Path | RBAC |
|---|---|---|
| `GET` | `/api/v1/organizations` | any authenticated user |
| `GET` | `/api/v1/organizations/:id` | any authenticated user |
| `POST` | `/api/v1/organizations` | `AGENCY_OWNER` or `AGENCY_ADMIN` |

### Memberships (authenticated)

| Method | Path | RBAC |
|---|---|---|
| `GET` | `/api/v1/memberships` | any authenticated user |
| `POST` | `/api/v1/memberships` | `AGENCY_OWNER` or `AGENCY_ADMIN` |

### Agency-Client Relationships (authenticated)

| Method | Path | RBAC |
|---|---|---|
| `GET` | `/api/v1/agency-clients` | any authenticated user |
| `POST` | `/api/v1/agency-clients` | `AGENCY_OWNER` or `AGENCY_ADMIN` |

## RBAC roles

| Role | Scope | Can create resources |
|---|---|---|
| `AGENCY_OWNER` | Full platform access | Yes |
| `AGENCY_ADMIN` | Agency management | Yes |
| `STAFF` | Agency read access | No (read-only for now) |
| `CLIENT_ADMIN` | Client org management | No |
| `CLIENT_USER` | Client read access | No |

## Prisma

```sh
npm run prisma:generate -w apps/api     # generate client
npm run prisma:migrate -w apps/api      # new dev migration
npm run prisma:migrate:deploy -w apps/api  # apply in production
npm run seed -w apps/api                # seed first agency owner
```

## Production build

```sh
npm run build -w apps/api
npm run start -w apps/api
```

## Railway deployment

1. Set **Root Directory** to `apps/api` in Railway service settings.
2. Add a PostgreSQL plugin — Railway injects `DATABASE_URL` automatically.
3. Set `CORS_ORIGIN` to your frontend domain.
4. Set `JWT_SECRET` to a strong random value (`openssl rand -base64 48`).
5. Railway detects Node.js, runs `npm install` → `npm run build` → `npm run start`.
6. Set the health-check path to `/healthz`.
