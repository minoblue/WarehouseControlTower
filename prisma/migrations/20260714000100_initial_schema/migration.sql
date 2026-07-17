-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OPERATIONS', 'SUPPORT_ENGINEER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('RECEIVED', 'VALIDATING', 'INVENTORY_ALLOCATED', 'READY_FOR_PICKING', 'DISPATCHED', 'DELIVERED', 'VALIDATION_FAILED', 'INVENTORY_UNAVAILABLE', 'INTEGRATION_FAILED', 'MANUAL_REVIEW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'DISPATCHED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "IdempotencyState" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProcessedEventStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AttemptClassification" AS ENUM ('SUCCESS', 'RETRYABLE', 'NON_RETRYABLE', 'POISON');

-- CreateEnum
CREATE TYPE "AttemptOutcome" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReplayStatus" AS ENUM ('REQUESTED', 'PUBLISHED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "customer_id" VARCHAR(100) NOT NULL,
    "customer_reference" VARCHAR(120) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "failure_code" VARCHAR(100),
    "failure_message_sanitized" VARCHAR(500),
    "correlation_id" UUID NOT NULL,
    "tracking_number" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "on_hand" INTEGER NOT NULL,
    "allocated" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_allocations" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "inventory_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "carrier" VARCHAR(80) NOT NULL,
    "carrier_request_key" VARCHAR(160) NOT NULL,
    "tracking_number" VARCHAR(100) NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "response_metadata_sanitized" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "actor_id" UUID NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "state" "IdempotencyState" NOT NULL DEFAULT 'IN_PROGRESS',
    "response_status" INTEGER,
    "response_body" JSONB,
    "resource_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "correlation_id" UUID NOT NULL,
    "causation_id" UUID,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "id" UUID NOT NULL,
    "consumer" VARCHAR(100) NOT NULL,
    "event_id" UUID NOT NULL,
    "status" "ProcessedEventStatus" NOT NULL DEFAULT 'PROCESSING',
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "lease_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "processed_at" TIMESTAMPTZ(3),
    "result_reference" VARCHAR(160),
    "last_error_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_attempts" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "order_id" UUID,
    "sqs_message_id" VARCHAR(160) NOT NULL,
    "receive_count" INTEGER NOT NULL,
    "classification" "AttemptClassification" NOT NULL,
    "outcome" "AttemptOutcome" NOT NULL,
    "safe_error_code" VARCHAR(100),
    "request_metadata_sanitized" JSONB,
    "response_metadata_sanitized" JSONB,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3) NOT NULL,
    "correlation_id" UUID NOT NULL,

    CONSTRAINT "processing_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_entries" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "correlation_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "source" VARCHAR(80) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "affected_service" VARCHAR(120) NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "detected_at" TIMESTAMPTZ(3) NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(3),
    "resolved_at" TIMESTAMPTZ(3),
    "assigned_to" UUID,
    "business_impact" TEXT,
    "root_cause" TEXT,
    "resolution" TEXT,
    "corrective_actions" TEXT,
    "preventive_actions" TEXT,
    "correlation_ids" UUID[],
    "failure_episode_key" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_notes" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replay_requests" (
    "id" UUID NOT NULL,
    "original_event_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "ReplayStatus" NOT NULL DEFAULT 'REQUESTED',
    "new_event_id" UUID,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "replay_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID NOT NULL,
    "correlation_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "before_metadata" JSONB,
    "after_metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "orders_correlation_id_key" ON "orders"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tracking_number_key" ON "orders"("tracking_number");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_customer_reference_idx" ON "orders"("customer_reference");

-- CreateIndex
CREATE INDEX "order_items_sku_idx" ON "order_items"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_sku_key" ON "order_items"("order_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_sku_key" ON "inventory"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_allocations_order_item_id_key" ON "inventory_allocations"("order_item_id");

-- CreateIndex
CREATE INDEX "inventory_allocations_order_id_idx" ON "inventory_allocations"("order_id");

-- CreateIndex
CREATE INDEX "inventory_allocations_inventory_id_status_idx" ON "inventory_allocations"("inventory_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_carrier_request_key_key" ON "shipments"("carrier_request_key");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tracking_number_key" ON "shipments"("tracking_number");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_scope_actor_id_key_key" ON "idempotency_keys"("scope", "actor_id", "key");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_next_attempt_at_idx" ON "outbox_events"("published_at", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_id_idx" ON "outbox_events"("aggregate_id");

-- CreateIndex
CREATE INDEX "processed_events_status_lease_expires_at_idx" ON "processed_events"("status", "lease_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "processed_events_consumer_event_id_key" ON "processed_events"("consumer", "event_id");

-- CreateIndex
CREATE INDEX "processing_attempts_order_id_idx" ON "processing_attempts"("order_id");

-- CreateIndex
CREATE INDEX "processing_attempts_correlation_id_idx" ON "processing_attempts"("correlation_id");

-- CreateIndex
CREATE INDEX "processing_attempts_event_id_idx" ON "processing_attempts"("event_id");

-- CreateIndex
CREATE INDEX "timeline_entries_order_id_occurred_at_idx" ON "timeline_entries"("order_id", "occurred_at");

-- CreateIndex
CREATE INDEX "timeline_entries_correlation_id_occurred_at_idx" ON "timeline_entries"("correlation_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_failure_episode_key_key" ON "incidents"("failure_episode_key");

-- CreateIndex
CREATE INDEX "incidents_status_severity_detected_at_idx" ON "incidents"("status", "severity", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "incidents_assigned_to_idx" ON "incidents"("assigned_to");

-- CreateIndex
CREATE INDEX "incident_notes_incident_id_created_at_idx" ON "incident_notes"("incident_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "replay_requests_idempotency_key_key" ON "replay_requests"("idempotency_key");

-- CreateIndex
CREATE INDEX "replay_requests_order_id_status_idx" ON "replay_requests"("order_id", "status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_correlation_id_created_at_idx" ON "audit_logs"("correlation_id", "created_at");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_attempts" ADD CONSTRAINT "processing_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_notes" ADD CONSTRAINT "incident_notes_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_notes" ADD CONSTRAINT "incident_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity constraints that Prisma cannot express in the schema DSL.
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "inventory"
  ADD CONSTRAINT "inventory_on_hand_non_negative" CHECK ("on_hand" >= 0),
  ADD CONSTRAINT "inventory_allocated_non_negative" CHECK ("allocated" >= 0),
  ADD CONSTRAINT "inventory_allocated_within_on_hand" CHECK ("allocated" <= "on_hand");

ALTER TABLE "inventory_allocations"
  ADD CONSTRAINT "inventory_allocations_quantity_positive" CHECK ("quantity" > 0);

CREATE UNIQUE INDEX "replay_requests_one_active_per_event"
  ON "replay_requests" ("original_event_id")
  WHERE "status" IN ('REQUESTED', 'PUBLISHED');
