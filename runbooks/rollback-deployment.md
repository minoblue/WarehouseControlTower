# Roll Back a Deployment

## Preconditions

- Identify the last known-good image tag and Git SHA.
- Determine whether the release included a database migration.
- Never reverse a destructive migration without a reviewed data recovery plan.

## Procedure

1. Stop new deployment rollout.
2. Restore the previous API, worker, web, and carrier image set.
3. Prefer a forward-compatible corrective migration. Use a down migration only when explicitly tested.
4. Verify API and worker readiness before restoring traffic and polling.

## Verify

Run health checks, create a test order, confirm EventBridge-to-SQS routing, verify one shipment, and inspect error and queue-depth metrics.
