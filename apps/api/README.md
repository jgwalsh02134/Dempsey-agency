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

### 7. Admin management (members, roles, deactivation)

**Who can list org members**

- Any user with **AGENCY_OWNER** anywhere can list members of **any** organization (platform-wide owner).
- **AGENCY_OWNER** / **AGENCY_ADMIN** on an **agency** can list that agency and **linked client** orgs (via agency–client relationship).
- **CLIENT_ADMIN** can list **only** their **client** organization.

**Deactivated users**

- `User.active` defaults to `true`. **`PATCH /api/v1/users/:id/deactivate`** sets `active` to `false`.
- **Login** is rejected for inactive users (same generic error as wrong password).
- **Existing JWTs** stop working for API calls: the auth hook does not attach `currentUser` for inactive users, so protected routes return **401**.

#### List users in one organization

```sh
ORG_ID="<organization id>"
curl -s "http://localhost:3001/api/v1/organizations/$ORG_ID/users" \
  -H "Authorization: Bearer $TOKEN"
```

Response shape: `{ "organizationId", "users": [ { "membershipId", "role", "joinedAt", "user": { "id", "email", "name", "active" } } ] }`.

#### Change a user’s role in an organization

Body: `{ "organizationId", "role" }`. Same RBAC rules as creating a membership (agency owner/admin vs client admin vs agency–client link). Cannot demote the **last** `AGENCY_OWNER` of an **agency** org.

```sh
TARGET_USER_ID="<user cuid>"
curl -s -X PATCH "http://localhost:3001/api/v1/users/$TARGET_USER_ID/role" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"organizationId\":\"$AGENCY_ID\",\"role\":\"STAFF\"}"
```

#### Remove a membership

```sh
MEMBERSHIP_ID="<organizationMembership id from list or /memberships>"
curl -s -w "\nHTTP %{http_code}" -X DELETE "http://localhost:3001/api/v1/memberships/$MEMBERSHIP_ID" \
  -H "Authorization: Bearer $TOKEN"
```

You cannot delete the **last** `AGENCY_OWNER` membership of an **agency** organization (`400` with a clear error).

#### Deactivate a user

Empty JSON body `{}`. You must be allowed to **manage** at least one organization the target user belongs to. Cannot deactivate yourself.

```sh
curl -s -X PATCH "http://localhost:3001/api/v1/users/$TARGET_USER_ID/deactivate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Auth flow (summary)

1. **Login**: `POST /api/v1/auth/login` → JWT (inactive accounts are rejected).
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
| `GET` | `/api/v1/users` | Scoped to orgs you can see; includes `active` |
| `GET` | `/api/v1/users/:id` | Self or users visible in your org scope |
| `POST` | `/api/v1/users` | Create user + membership; body includes `organizationId`, `role`, `password` |
| `PATCH` | `/api/v1/users/:id/role` | Body `{ organizationId, role }`; org-scoped RBAC; blocks last agency owner demotion |
| `PATCH` | `/api/v1/users/:id/deactivate` | Body `{}` only; soft-deactivate; blocks login + API session |

### Organizations

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/organizations` | Scoped (platform agency owners see all) |
| `GET` | `/api/v1/organizations/:id/users` | Members of org with roles; org-scoped list access |
| `GET` | `/api/v1/organizations/:id` | Same visibility rules |
| `POST` | `/api/v1/organizations` | `AGENCY`: agency owner only. `CLIENT`: requires `agencyOrganizationId` and agency admin/owner on that agency |

### Memberships

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/memberships` | Scoped to visible orgs |
| `POST` | `/api/v1/memberships` | Link existing user to org; org-aware + role rules |
| `DELETE` | `/api/v1/memberships/:id` | Remove membership; org-scoped; blocks removing last agency owner |

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
