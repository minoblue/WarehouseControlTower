# Carrier Integration Timeout

## Signal

Worker attempts report `CARRIER_TIMEOUT`, processing retries increase, and orders enter `INTEGRATION_FAILED`.

## Check

1. Check mock-carrier health separately from its configured fault mode.
2. Trace a correlation ID from order receipt to the outbound carrier span/log.
3. Confirm the configured carrier timeout is shorter than SQS visibility timeout.
4. Determine whether the carrier accepted an earlier request using the deterministic shipment key.

## Recover

- Restore carrier health or disable the local timeout fault.
- Allow bounded SQS retries to continue.
- If the message reaches the DLQ, follow the replay runbook after verifying carrier idempotency.

## Verify

One shipment exists for the order, the message is deleted after commit, and the order reaches `DISPATCHED`.
