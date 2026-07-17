# Replay a Dead-Letter Message

## Safety conditions

- The original failure is understood or the dependency is confirmed healthy.
- The order state remains eligible for replay.
- The actor has `SUPPORT_ENGINEER` or `ADMIN` permission.
- A reason and idempotency key are supplied.

## Procedure

1. Find the transaction by correlation ID.
2. Review attempts, the original validated event, inventory allocation, and carrier idempotency state.
3. Submit one replay request through the support API when that slice is enabled.
4. The platform rebuilds a new event from authoritative state and links it to the original event.
5. Do not manually edit or copy the failed payload into SQS.

## Verify

The replay completes once, one carrier shipment exists, the original failure evidence remains, and an audit record identifies the actor and reason.
