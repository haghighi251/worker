# worker — Kafka Consumer Service

Dedicated worker processes that consume Kafka topics and perform async tasks.
Runs on Express (no NestJS) for a lightweight footprint.

## Workers

| Worker | Kafka topic consumed | Kafka topic produced | What it does |
|---|---|---|---|
| Test Executor | `test.scheduled` | `test.result` | Runs Playwright tests against customer endpoints |
| Vulnerability Fetcher | `package.scan` | `vulnerability.fetched` | Queries OSV.dev for known vulnerabilities |
| Notifier | `notification.req` | — | Sends emails (SendGrid) and Slack webhooks |

## Stack

- **Express** with TypeScript
- **PostgreSQL** via Prisma (schema owned by `packages/database`)
- **KafkaJS** — consumes events, produces results
- **Redis** — token bucket rate limiting before each test request
- **Playwright** — browser + HTTP test execution

## Running locally

```bash
# From monorepo root — start infrastructure (Postgres, Redis, Kafka)
.\start-infra.ps1

# Then start the worker
cd worker
pnpm dev              # hot-reload on :8001
```

## Commands

```bash
pnpm dev              # ts-node-dev hot-reload on :8001
pnpm build            # tsc compile to dist/
pnpm test             # jest unit tests
pnpm db:generate      # regenerate Prisma client from shared schema
```

## Database

This service uses the shared schema from `packages/database`.

### Regenerating the Prisma client

Run this after any schema change in `packages/database`:

```bash
pnpm db:generate
```

### Making schema changes

**Never run `db:push` or `db:migrate` from this service.**
All schema changes must go through `packages/database`:

```bash
cd ../packages/database
pnpm db:migrate       # create + apply migration
cd ../worker
pnpm db:generate      # regenerate typed client
```

### Why?

`aba-bl` shares the same database. Centralising migrations in `packages/database` prevents either service from accidentally overwriting the other's schema changes or dropping columns.

## Importing database types

```typescript
// Singleton client (use this everywhere)
import { prisma } from '@/infrastructure/database/prisma';

// Types (re-exported from @aba/database)
import type { User, Company, UserRole } from '@/infrastructure/database/prisma';
```

## File structure

```
src/
  application/
    controllers/      Express route handlers
  domain/
    services/         Business logic (no framework dependencies)
  infrastructure/
    database/
      prisma.ts       Re-exports shared PrismaClient from @aba/database
    http/
      routes/         Express routers
    shared/
      config.ts       Environment variable access
      middlewares/    Rate limiting, auth, proxy utilities
    logs/
      logging.ts      Morgan request logging setup
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Purpose |
|---|---|
| `PORT` | Listening port (default 8001) |
| `DATABASE_URL` | PostgreSQL connection string |
| `KAFKA_BROKERS` | Kafka broker list (e.g. `localhost:9092`) |
| `REDIS_URL` | Redis connection (e.g. `redis://localhost:6379`) |
| `BFF_URL` | URL of the aba-bl API (e.g. `http://localhost:8000`) |
