# High SQS Queue Depth

## Signal

The processing queue stays above 20 visible messages for five minutes or worker throughput falls behind order creation.

## Check

1. Confirm worker readiness at `/health/ready` and inspect `wct_worker_messages_total`.
2. Search logs by correlation ID for database, event validation, or carrier failures.
3. Check LocalStack queue attributes and the age of the oldest message.
4. Confirm PostgreSQL pool health and mock-carrier readiness.

## Recover

- Restore the failed dependency first.
- Restart an unhealthy worker gracefully. Undeleted messages remain available after visibility timeout.
- Increase worker concurrency only within database and carrier capacity.
- Do not purge the queue to reduce depth.

## Verify

Queue depth and oldest-message age decline, successful worker outcomes rise, and no duplicate shipments or allocations appear.
