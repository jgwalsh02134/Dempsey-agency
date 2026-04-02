# @dempsey-agency/api

Fastify + Prisma backend for the Dempsey Agency B2B advertising platform.

## Required environment variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/dempsey` |
| `PORT` | Server port (Railway sets this automatically) | `3001` |
| `CORS_ORIGIN` | Allowed origin for CORS | `https://dempsey.agency` |
| `NODE_ENV` | Environment mode | `development` / `production` |

```sh
cp .env.example .env
```

## Local development

```sh
# from the repo root
npm install

# generate Prisma client
npm run prisma:generate -w apps/api

# run the first migration (requires running PostgreSQL)
npm run prisma:migrate -w apps/api

# start dev server with hot-reload
npm run dev -w apps/api
```

## Routes

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check — returns `{ "status": "ok" }` |
| `GET` | `/api/v1` | API version info |

### Authenticated (require `x-user-id` + `x-user-email` headers)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/me` | Current user with memberships |
| `GET` | `/api/v1/users` | List all users |
| `GET` | `/api/v1/users/:id` | Get user by ID |
| `POST` | `/api/v1/users` | Create a user |
| `GET` | `/api/v1/organizations` | List all organizations |
| `GET` | `/api/v1/organizations/:id` | Get organization by ID |
| `POST` | `/api/v1/organizations` | Create an organization |
| `GET` | `/api/v1/memberships` | List all memberships |
| `POST` | `/api/v1/memberships` | Create a membership |
| `GET` | `/api/v1/agency-clients` | List agency-client relationships |
| `POST` | `/api/v1/agency-clients` | Create agency-client relationship |

### Dev auth headers

Until a real auth provider (Clerk) is added, pass these headers:

```
x-user-id: <user cuid>
x-user-email: <user email>
```

Example:

```sh
curl http://localhost:3001/api/v1/me \
  -H "x-user-id: abc123" \
  -H "x-user-email: dev@dempsey.agency"
```

## Prisma

```sh
# generate client after schema changes
npm run prisma:generate -w apps/api

# create a new dev migration
npm run prisma:migrate -w apps/api

# apply pending migrations in production
npm run prisma:migrate:deploy -w apps/api
```

## Production build

```sh
npm run build -w apps/api
npm run start -w apps/api
```

## Railway deployment

1. Set **Root Directory** to `apps/api` in the Railway service settings.
2. Add a PostgreSQL plugin — Railway injects `DATABASE_URL` automatically.
3. Set `CORS_ORIGIN` to your frontend domain.
4. Railway detects Node.js, runs `npm install` → `npm run build` → `npm run start`.
5. Set the health-check path to `/healthz`.
