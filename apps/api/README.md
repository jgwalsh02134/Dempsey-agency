# @dempsey-agency/api

Fastify + Prisma backend for the Dempsey Agency B2B advertising platform.

## Required environment variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/dempsey` |
| `PORT` | Server port (Railway sets this automatically) | `3001` |
| `CORS_ORIGIN` | Allowed origin for CORS | `https://dempsey.agency` |

Copy the example file to get started:

```sh
cp .env.example .env
```

## Local development

```sh
# from the repo root
npm install

# generate the Prisma client
npm run prisma:generate -w apps/api

# run the first migration (requires a running PostgreSQL)
npm run prisma:migrate -w apps/api

# start the dev server with hot-reload
npm run dev -w apps/api
```

The server starts at `http://localhost:3001` (or whatever `PORT` you set).

## Production build

```sh
npm run build -w apps/api
npm run start -w apps/api
```

## Prisma commands

```sh
# generate client after schema changes
npm run prisma:generate -w apps/api

# create a new dev migration
npm run prisma:migrate -w apps/api

# apply pending migrations in production
npm run prisma:migrate:deploy -w apps/api
```

## Health check

```
GET /healthz  →  { "status": "ok" }
```

Unauthenticated, returns HTTP 200. Use this as the Railway health-check path.

## Railway deployment

1. Set **Root Directory** to `apps/api` in the Railway service settings.
2. Add a PostgreSQL plugin and Railway will inject `DATABASE_URL` automatically.
3. Set `CORS_ORIGIN` to your frontend domain.
4. Railway detects Node.js, runs `npm install` → `npm run build` → `npm run start`.
5. Set the health-check path to `/healthz`.
