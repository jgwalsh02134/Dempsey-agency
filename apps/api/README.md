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

## Seeded admin workflow

After `npm run seed -w apps/api` you get:

- **Email**: `admin@dempsey.agency` (override with `SEED_EMAIL`)
- **Password**: `changeme123` (override with `SEED_PASSWORD`)
- **Organization**: `Dempsey Agency` as `AGENCY`, role `AGENCY_OWNER`

### 1. Log in

```sh
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dempsey.agency","password":"changeme123"}'
```

Save the `token` from the JSON response.

### 2. Inspect session (canonical: `/auth/me`, alias: `/auth/session`)

`GET /api/v1/auth/me` and `GET /api/v1/auth/session` return the same payload: current user plus organization memberships (no password fields).

```sh
TOKEN="<paste token>"
curl -s http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

Copy your **agency** `organizationId` from `memberships[].organizationId`.

### 3. Change password (optional)

```sh
curl -s -X POST http://localhost:3001/api/v1/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"changeme123","newPassword":"a-secure-new-password"}'
```

Log in again to get a new JWT after changing password.

### 4. Create the first staff user (agency org)

`POST /api/v1/users` requires `email`, `password` (min 8 chars), `organizationId`, and `role`. You must be allowed to manage that organization (agency owner/admin on the agency, or agency link / client rules for client orgs).

```sh
AGENCY_ID="<your agency organization id>"

curl -s -X POST http://localhost:3001/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"staff@dempsey.agency\",\"password\":\"staff-password-here\",\"name\":\"Staff Member\",\"organizationId\":\"$AGENCY_ID\",\"role\":\"STAFF\"}"
```

Only an **agency owner** can assign `AGENCY_OWNER` or `AGENCY_ADMIN` in the agency org. An **agency admin** can assign `STAFF` (and client roles on linked client orgs per rules below).

### 5. Create a client organization

Client orgs are created under a parent agency you admin:

```sh
curl -s -X POST http://localhost:3001/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Acme Client\",\"type\":\"CLIENT\",\"agencyOrganizationId\":\"$AGENCY_ID\"}"
```

This also creates the `AgencyClientRelationship` row. Only **agency owners** may create a new top-level **agency** org (`type: AGENCY`).

### 6. Create client users

Use the **client** organization id from step 5:

```sh
CLIENT_ID="<client organization id>"

curl -s -X POST http://localhost:3001/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@acme.com\",\"password\":\"client-password-here\",\"organizationId\":\"$CLIENT_ID\",\"role\":\"CLIENT_USER\"}"
```

Agency admins acting over the agency–client link may assign `CLIENT_ADMIN` or `CLIENT_USER`. A **client admin** in the client org may only assign `CLIENT_USER` (e.g. via `POST /api/v1/users` or `POST /api/v1/memberships` for an existing user).

## Auth flow (summary)

1. **Login**: `POST /api/v1/auth/login` → JWT.
2. **Requests**: `Authorization: Bearer <token>`.
3. **Session**: `GET /api/v1/auth/me` or `GET /api/v1/auth/session` (same data).
4. **Change password**: `POST /api/v1/auth/change-password` with current + new password.
5. **Logout**: `POST /api/v1/auth/logout` (stateless JWT — discard token on the client).

## Routes

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check — `{ "status": "ok" }` |
| `GET` | `/api/v1` | API version info |

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Login `{ email, password }` → `{ token, user }` |
| `POST` | `/api/v1/auth/logout` | Logout (requires token) |
| `GET` | `/api/v1/auth/me` | Session: user + memberships |
| `GET` | `/api/v1/auth/session` | Same as `/auth/me` |
| `POST` | `/api/v1/auth/change-password` | `{ currentPassword, newPassword }` (requires token) |

### Users

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/users` | Scoped to orgs you can see |
| `GET` | `/api/v1/users/:id` | Self or users visible in your org scope |
| `POST` | `/api/v1/users` | Create user + membership; body includes `organizationId`, `role`, `password` |

### Organizations

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/organizations` | Scoped (platform agency owners see all) |
| `GET` | `/api/v1/organizations/:id` | Same visibility rules |
| `POST` | `/api/v1/organizations` | `AGENCY`: agency owner only. `CLIENT`: requires `agencyOrganizationId` and agency admin/owner on that agency |

### Memberships

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/memberships` | Scoped to visible orgs |
| `POST` | `/api/v1/memberships` | Link existing user to org; org-aware + role rules |

### Agency–client relationships

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/agency-clients` | Scoped to agencies you belong to (owners see all) |
| `POST` | `/api/v1/agency-clients` | Agency admin/owner on `agencyId`; validates agency/client types |

## RBAC (short)

- **List scope**: Users with any `AGENCY_OWNER` membership see all organizations/users/memberships; others see orgs they belong to plus client orgs linked to agencies where they are owner/admin.
- **Writes**: Creating users or memberships checks organization management (direct admin, client admin in client org, or agency admin via agency–client link).
- **Agency roles**: Only **agency owner** can assign `AGENCY_OWNER` / `AGENCY_ADMIN` in an agency org.
- **Client roles**: Agency-side admins (via link) may assign `CLIENT_ADMIN` / `CLIENT_USER`; **client admin** may assign only `CLIENT_USER`.

Password hashes are never returned from the API (`omit` on Prisma queries).

## Prisma

```sh
npm run prisma:generate -w apps/api
npm run prisma:migrate -w apps/api
npm run prisma:migrate:deploy -w apps/api
npm run seed -w apps/api
```

## Production build

```sh
npm run build -w apps/api
npm run start -w apps/api
```

## Railway deployment

1. Set **Root Directory** to `apps/api`.
2. Add PostgreSQL — `DATABASE_URL` is injected.
3. Set `CORS_ORIGIN` and a strong `JWT_SECRET`.
4. Build: `npm run build`; start: `npm run start`.
5. Health check path: `/healthz`.
