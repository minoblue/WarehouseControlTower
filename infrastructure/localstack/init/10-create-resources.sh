#!/usr/bin/env sh
set -eu

REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ACCOUNT_ID="000000000000"
EVENT_BUS_NAME="${EVENT_BUS_NAME:-warehouse-events}"
ORDER_QUEUE_NAME="${ORDER_QUEUE_NAME:-order-processing}"
ORDER_DLQ_NAME="${ORDER_DLQ_NAME:-order-processing-dlq}"
MAX_RECEIVE_COUNT="${SQS_MAX_RECEIVE_COUNT:-3}"

awslocal events create-event-bus --name "$EVENT_BUS_NAME" --region "$REGION" >/dev/null 2>&1 || true

DLQ_URL="$(awslocal sqs create-queue --queue-name "$ORDER_DLQ_NAME" --region "$REGION" --query QueueUrl --output text)"
DLQ_ARN="$(awslocal sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names QueueArn --region "$REGION" --query Attributes.QueueArn --output text)"

REDRIVE_POLICY="{\"deadLetterTargetArn\":\"${DLQ_ARN}\",\"maxReceiveCount\":\"${MAX_RECEIVE_COUNT}\"}"
QUEUE_ATTRIBUTES="{\"VisibilityTimeout\":\"${SQS_VISIBILITY_TIMEOUT_SECONDS:-30}\",\"RedrivePolicy\":\"$(printf '%s' "$REDRIVE_POLICY" | sed 's/"/\\"/g')\"}"
QUEUE_URL="$(awslocal sqs create-queue --queue-name "$ORDER_QUEUE_NAME" --attributes "$QUEUE_ATTRIBUTES" --region "$REGION" --query QueueUrl --output text)"
QUEUE_ARN="$(awslocal sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names QueueArn --region "$REGION" --query Attributes.QueueArn --output text)"

awslocal events put-rule \
  --name order-created-to-processing \
  --event-bus-name "$EVENT_BUS_NAME" \
  --event-pattern '{"source":["warehouse.orders"],"detail-type":["order.created.v1"]}' \
  --region "$REGION" >/dev/null

QUEUE_POLICY="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"events.amazonaws.com\"},\"Action\":\"sqs:SendMessage\",\"Resource\":\"${QUEUE_ARN}\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${EVENT_BUS_NAME}/order-created-to-processing\"}}}]}"
POLICY_ATTRIBUTES="{\"Policy\":\"$(printf '%s' "$QUEUE_POLICY" | sed 's/"/\\"/g')\"}"
awslocal sqs set-queue-attributes --queue-url "$QUEUE_URL" --attributes "$POLICY_ATTRIBUTES" --region "$REGION"

awslocal events put-targets \
  --event-bus-name "$EVENT_BUS_NAME" \
  --rule order-created-to-processing \
  --targets "Id=order-processing-sqs,Arn=${QUEUE_ARN}" \
  --region "$REGION" >/dev/null

printf 'LocalStack resources ready: bus=%s queue=%s dlq=%s\n' "$EVENT_BUS_NAME" "$ORDER_QUEUE_NAME" "$ORDER_DLQ_NAME"
