# Database Connection Exhaustion

## Signal

Readiness fails, requests wait for database connections, or pool utilization remains above 80 percent.

## Check

1. Inspect active and waiting connections in PostgreSQL.
2. Identify long transactions and slow queries.
3. Confirm API and worker instance counts and configured pool limits.
4. Search for shutdowns that did not release clients.

## Recover

- Stop the source of unbounded concurrency.
- Gracefully restart a leaking service after active work drains.
- Cancel only confirmed abandoned queries.
- Do not raise PostgreSQL connection limits without checking memory and aggregate pool size.

## Verify

Readiness recovers, waiting connections return to zero, and order processing resumes without duplicate effects.
