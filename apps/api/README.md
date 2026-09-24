# @dempsey-agency/api

Fastify + Prisma backend for the Dempsey Agency B2B advertising platform.

## Required environment variables

### Runtime (API process — set on Railway and local `.env`)

| Variable | Description | Default / notes | Example |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | required | `postgresql://user:pass@localhost:5432/dempsey` |
| `PORT` | Server port (Railway sets automatically) | `3000` | `3001` |
| `CORS_ORIGINS` | Preferred: comma-separated **browser** origins allowed to call the API | In dev, defaults to `*` if unset | `https://dempsey.agency,https://admin.dempsey.agency` |
| `CORS_ORIGIN` | Legacy: one origin, or a comma-separated list (same parsing as `CORS_ORIGINS`) | Used if `CORS_ORIGINS` is empty | `http://localhost:5173` |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `JWT_SECRET` | Secret for signing JWT tokens | `unsafe-dev-secret` (rejected when `NODE_ENV=production`) | `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` | `24h` |
| `RESEND_API_KEY` | Resend API key for outbound email | optional; unset means email is skipped | `re_…` |
| `EMAIL_FROM` | Verified From address | required together with the API key | `Dempsey Agency <notifications@example.com>` |
| `APP_PORTAL_URL` | Portal origin for reset and client links | optional | `https://portal.dempsey.agency` |
| `APP_ADMIN_URL` | Admin origin for agency notification links | optional | `https://admin.dempsey.agency` |
| `APP_SITE_URL` | Marketing origin for invite activation | optional | `https://dempsey.agency` |

**Production CORS**

- `NODE_ENV=production` requires an explicit allowlist: set `CORS_ORIGINS` (or `CORS_ORIGIN`) to every frontend origin that uses the API (e.g. marketing and admin).
- Wildcard `*` is **not** allowed in production.
- Non-browser clients (curl, health checks) send no `Origin` header and are still accepted.

**Production JWT**

- If `JWT_SECRET` is still the default `unsafe-dev-secret` while `NODE_ENV=production`, the process exits at startup.

```sh
cp .env.example .env
```

### Bootstrap only (seed script — do **not** set on production deploys)

These are read **only** when you run `npm run seed -w apps/api` (or `prisma db seed`). The running API never uses them; Railway and other hosts do not need them after initial database setup.

| Variable | Used by | Purpose |
|---|---|---|
| `SEED_EMAIL` | `prisma/seed.ts` | First admin email (default `admin@dempsey.agency`) |
| `SEED_PASSWORD` | `prisma/seed.ts` | Initial password (default `changeme123`) |
| `SEED_ORG_NAME` | `prisma/seed.ts` | Agency organization name |

**After setup:** log in, call `POST /api/v1/auth/change-password`, then remove `SEED_PASSWORD` (and any other seed overrides) from your local `.env` and from team secrets. Do not store long-lived bootstrap passwords in deployment environments.

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

## Audit log (database)

Security-relevant actions are appended to the `AuditLog` table: **user created**, **role changed**, **user deactivated**, **membership removed**. Login failures are not recorded. Agency owners and admins can read the log at `GET /api/v1/admin/audit-logs` (pagination plus `action`, `actorUserId`, `organizationId`, `from`, `to`). Responses omit password hashes and metadata keys that look like secrets.

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
4. **Change password**: `POST /api/v1/auth/change-password` with current + new password (returns **403** if the account is deactivated).
5. **Logout**: `POST /api/v1/auth/logout` (stateless JWT — discard token on the client).

## Email

Outbound mail uses Resend (`RESEND_API_KEY`, `EMAIL_FROM`). If either is unset, the API logs that once and skips delivery. `APP_PORTAL_URL` builds password-reset and client notification links. `APP_ADMIN_URL` builds agency notification links. `APP_SITE_URL` builds invite links (`/activate-account.html`).

Email is sent for: password reset, approved account-request invites (when `APP_SITE_URL` is set), and notifications of type `CREATIVE_REVISION_REQUESTED`, `CREATIVE_REVISION_UPLOADED`, `PLACEMENT_AWAITING_APPROVAL`, `PLACEMENT_APPROVED_BY_CLIENT`, `NEW_INVOICE_UPLOADED`, and `NEW_PROOF_UPLOADED`.

## DMA

Publisher rows have optional `dmaName` and `dmaCode`. There is no DMA dataset in this repo, so those fields stay empty until an admin sets them. Do not invent market codes.

## Routes

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check — `{ "status": "ok" }` |
| `GET` | `/api/v1` | API version info |
| `POST` | `/api/v1/account-requests` | Public access request |
| `GET` | `/api/v1/invites/:token/validate` | Check an invite before activation |
| `POST` | `/api/v1/invites/:token/activate` | Create the user from an unused, unexpired invite |

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Login `{ email, password }` → `{ token, user }`. Inactive users and wrong passwords share one error. |
| `POST` | `/api/v1/auth/logout` | Logout (requires token) |
| `GET` | `/api/v1/auth/me` | Session: user + memberships |
| `GET` | `/api/v1/auth/session` | Same as `/auth/me` |
| `POST` | `/api/v1/auth/change-password` | `{ currentPassword, newPassword }` |
| `POST` | `/api/v1/auth/forgot-password` | Always `{ success: true }`. Emails a reset link when mail is configured and the account is active. |
| `POST` | `/api/v1/auth/reset-password` | `{ token, password }`. Rejects expired, reused, and inactive-user tokens. |

### Users

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/users` | Scoped to orgs you can see; includes `active` |
| `GET` | `/api/v1/users/:id` | Self or users visible in your org scope |
| `POST` | `/api/v1/users` | Create user + membership |
| `PATCH` | `/api/v1/users/:id/role` | Blocks demoting the last agency owner |
| `PATCH` | `/api/v1/users/:id/deactivate` | Blocks deactivating yourself or the last agency owner |
| `PATCH` | `/api/v1/users/:id/reactivate` | Restores `active` |

### Organizations

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/organizations` | Scoped (platform agency owners see all) |
| `GET` | `/api/v1/organizations/:id` | Same visibility rules |
| `GET` | `/api/v1/organizations/:id/users` | Members of the org |
| `POST` | `/api/v1/organizations` | `AGENCY`: agency owner only. `CLIENT`: requires `agencyOrganizationId` |

### Memberships

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/memberships` | Scoped to visible orgs |
| `POST` | `/api/v1/memberships` | Link an existing user |
| `DELETE` | `/api/v1/memberships/:id` | Blocks removing the last agency owner |

### Agency–client relationships

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/agency-clients` | Scoped to agencies you belong to |
| `POST` | `/api/v1/agency-clients` | Agency admin/owner on `agencyId` |

### Documents

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/organizations/:orgId/documents` | List |
| `POST` | `/api/v1/organizations/:orgId/documents` | Upload. `INVOICE` and `PROOF` notify clients and email when mail is configured |
| `PATCH` | `/api/v1/documents/:id` | Metadata only |
| `DELETE` | `/api/v1/documents/:id` | Delete record and object |
| `GET` | `/api/v1/documents/:id/download` | Signed download URL (`503` if storage is unset) |

### Campaigns

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/organizations/:orgId/campaigns` | List |
| `POST` | `/api/v1/organizations/:orgId/campaigns` | Create |
| `GET` | `/api/v1/campaigns/:id` | One campaign |
| `PATCH` | `/api/v1/campaigns/:id` | Update, including status |
| `DELETE` | `/api/v1/campaigns/:id` | Delete |

### Invoices

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/organizations/:orgId/invoices` | List |
| `POST` | `/api/v1/organizations/:orgId/invoices` | Create |
| `PATCH` | `/api/v1/invoices/:id` | Update status |
| `DELETE` | `/api/v1/invoices/:id` | Delete |

### Submissions

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/campaigns/:campaignId/submissions` | List, including revision chain fields |
| `POST` | `/api/v1/campaigns/:campaignId/submissions` | Upload. `parentSubmissionId` starts or continues a revision chain |
| `PATCH` | `/api/v1/submissions/:id` | Agency status / review note. `NEEDS_RESIZING` and `VALIDATION_FAILED` email the client |
| `DELETE` | `/api/v1/submissions/:id` | Delete |
| `GET` | `/api/v1/submissions/:id/download` | Signed attachment URL |
| `GET` | `/api/v1/submissions/:id/preview` | Signed inline URL for PDF and images |

### Publishers and inventory

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/publishers` | Agency staff+. Optional `q`, `isActive`. Includes `dmaName` / `dmaCode` when set |
| `POST` | `/api/v1/publishers` | Agency admin+ |
| `PATCH` | `/api/v1/publishers/:id` | Agency admin+. Optional DMA fields |
| `DELETE` | `/api/v1/publishers/:id` | Refuses while inventory or campaign links exist |
| `POST` | `/api/v1/publishers/import` | CSV rows already parsed by the client |
| `POST` | `/api/v1/publishers/:id/geocode` | Refresh coordinates |
| `GET` | `/api/v1/publishers/:id/inventory` | List inventory |
| `POST` | `/api/v1/publishers/:id/inventory` | Create inventory |
| `PATCH` | `/api/v1/inventory/:inventoryId` | Update inventory |
| `DELETE` | `/api/v1/inventory/:inventoryId` | Refuses while placements reference it |
| `GET` | `/api/v1/campaigns/:campaignId/publishers` | Publishers attached to a visible campaign |
| `POST` | `/api/v1/campaigns/:campaignId/publishers` | Attach. Caller must manage the campaign org |
| `DELETE` | `/api/v1/campaigns/:campaignId/publishers/:publisherId` | Detach. `404` if the link is missing |

### Placements

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/campaigns/:campaignId/placements` | List. Net cost is omitted for non-agency callers |
| `POST` | `/api/v1/campaigns/:campaignId/placements` | Create. Notifies the client |
| `PATCH` | `/api/v1/placements/:id` | Agency update |
| `POST` | `/api/v1/placements/:id/client-response` | Client members only. Body `{ response, note }` |
| `DELETE` | `/api/v1/placements/:id` | Delete |

### Account requests and invites

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/account-requests` | Agency owner/admin |
| `PATCH` | `/api/v1/account-requests/:id` | Approve requires `organizationId` and creates an invite. A second approve returns 400 |

### AI

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/ai/review-creative` | `{ submissionId }` |

### Notifications

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/notifications` | Current user. `unread`, `limit` |
| `GET` | `/api/v1/notifications/unread-count` | Count |
| `POST` | `/api/v1/notifications/:id/read` | Mark one |
| `POST` | `/api/v1/notifications/read-all` | Mark all |

### Admin

Agency owner and agency admin only.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/admin/overview` | Counts plus the latest audit rows |
| `GET` | `/api/v1/admin/audit-logs` | `page`, `limit`, `action`, `actorUserId`, `organizationId`, `from`, `to` |
| `GET` | `/api/v1/admin/submissions` | Queue. Filters: `status`, `organizationId`, `creativeType` |

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
3. Set **`CORS_ORIGINS`** to every production frontend origin, including `https://portal.dempsey.agency` and `https://admin.dempsey.agency`, and a strong **`JWT_SECRET`** (`JWT_SECRET` is required in production). Do **not** set `SEED_*` on the service.
4. Run `npm run prisma:migrate:deploy` on deploy before the process serves traffic.
5. Build: `npm run build`; start: `npm run start`.
6. Health check path: `/healthz`.
