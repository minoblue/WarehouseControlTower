# Warehouse Control Tower

Event-driven logistics operations and L3 incident support, designed to run entirely on a local machine.

## Current implementation

The first vertical slice includes:

- A strict TypeScript pnpm/Turborepo workspace.
- NestJS API with seeded JWT authentication and role enforcement.
- Idempotent order intake with a transactional PostgreSQL outbox.
- LocalStack EventBridge routing to SQS with a three-receive DLQ policy.
- A NestJS worker with event validation, duplicate detection, atomic inventory allocation, carrier timeouts, retry classification, and idempotent shipments.
- A controllable mock carrier.
- A Carbon-based React operations dashboard with live Socket.IO invalidation and polling fallback.
- Structured Pino logs, health/readiness endpoints, Prometheus metrics, migrations, seeds, and production builds.

The project uses LocalStack to emulate AWS EventBridge, SQS, dead-letter queues, CloudWatch-compatible services, and Secrets Manager locally. The application uses standard AWS SDK clients and can be migrated to an AWS account by changing environment configuration rather than application logic.

CloudWatch-compatible logs and Secrets Manager are optional future profiles. The MVP uses EventBridge, SQS, and a DLQ; Pino and Prometheus provide primary local visibility.

## Architecture

```text
React dashboard
      ↓ REST + Socket.IO
NestJS API → PostgreSQL outbox
      ↓
LocalStack EventBridge
      ↓
LocalStack SQS → DLQ
      ↓
NestJS worker
      ↓
Mock carrier service
```

## Prerequisites

- Docker Desktop or another running Docker Engine.
- Node.js 22.12 or newer for host-side frontend builds.
- Corepack and pnpm 10.12.1 when running commands outside containers.

## Start locally

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Web dashboard: `http://localhost:8080`
- API documentation: `http://localhost:3000/api/docs`
- API health: `http://localhost:3000/api/health/ready`
- Worker health: `http://localhost:3001/health/ready`
- API metrics: `http://localhost:3000/api/metrics`
- Worker metrics: `http://localhost:3001/metrics`

Compose applies the committed migration and seed before starting the API and worker.

## Seeded local users

| Role          | Email                        | Password variable          |
| ------------- | ---------------------------- | -------------------------- |
| Operations    | `operations@warehouse.local` | `DEMO_OPERATIONS_PASSWORD` |
| Support       | `support@warehouse.local`    | `DEMO_SUPPORT_PASSWORD`    |
| Administrator | `admin@warehouse.local`      | `DEMO_ADMIN_PASSWORD`      |

The default values in `.env.example` are local-only demonstration credentials. Change them when sharing a reachable environment.

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm test:unit
pnpm build
```

To run infrastructure separately, start Docker Desktop and use:

```bash
docker compose up -d postgres localstack
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Host-run applications need service URLs changed from Compose names to `localhost`, as shown in `.env.example` comments or a local uncommitted `.env`.

## Demonstrating the happy path

1. Sign in as the operations user.
2. Create an order using one of the seeded SKUs, such as `PALLET-STD`.
3. Observe the order move from `RECEIVED` to `DISPATCHED`.
4. Confirm that the dashboard refreshes when the Socket.IO notification arrives.
5. Open the order through the API to inspect its correlation ID and timeline.

Fault controls, DLQ projection, incident support, and replay UI are the next implementation slice.

## Database commands

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:dev
pnpm db:seed
```

Production schema changes must be added as committed migrations. Do not edit a production database manually.

## Quality commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
```

Integration tests and the Compose smoke workflow require a running Docker Engine.

## Operational behavior

- `/api/health/live` and `/health/live` check process liveness only.
- Readiness verifies PostgreSQL connectivity. SQS readiness will be expanded in the failure/recovery slice.
- The API preserves accepted orders during EventBridge outages using the outbox.
- The worker deletes an SQS message only after durable processing success.
- Carrier calls are outside database transactions and use deterministic idempotency keys.
- Local AWS credentials are intentionally fake. Never put real AWS credentials in `.env` or source control.


