import { Injectable } from '@nestjs/common';
import {
  AttemptClassification,
  AttemptOutcome,
  Prisma,
  ProcessedEventStatus,
} from '@prisma/client';
import type { Message } from '@aws-sdk/client-sqs';
import type { OrderCreatedV1 } from '@warehouse/event-contracts';
import { DomainError } from '@warehouse/shared';
import { CarrierClient, CarrierError } from './carrier.client.js';
import { PrismaService } from './prisma.service.js';

interface ProcessingContext {
  readonly message: Message;
  readonly event: OrderCreatedV1;
  readonly receiveCount: number;
  readonly startedAt: Date;
}

@Injectable()
export class OrderProcessor {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly carrier: CarrierClient,
  ) {}

  public async process(context: ProcessingContext): Promise<void> {
    const { event } = context;
    const completed = await this.claimEvent(event.eventId);
    if (completed) return;

    try {
      await this.allocateInventory(event);
      const shipment = await this.carrier.createShipment({
        orderId: event.payload.orderId,
        idempotencyKey: `shipment:${event.payload.orderId}`,
        correlationId: event.correlationId,
      });
      await this.prisma.$transaction([
        this.prisma.shipment.upsert({
          where: { orderId: event.payload.orderId },
          update: {},
          create: {
            orderId: event.payload.orderId,
            carrier: 'mock-carrier',
            carrierRequestKey: `shipment:${event.payload.orderId}`,
            trackingNumber: shipment.trackingNumber,
            status: 'DISPATCHED',
            responseMetadataSanitized: { status: shipment.status },
          },
        }),
        this.prisma.order.update({
          where: { id: event.payload.orderId },
          data: {
            status: 'DISPATCHED',
            trackingNumber: shipment.trackingNumber,
            version: { increment: 1 },
            failureCode: null,
            failureMessageSanitized: null,
          },
        }),
        this.prisma.timelineEntry.create({
          data: {
            orderId: event.payload.orderId,
            correlationId: event.correlationId,
            type: 'ORDER_DISPATCHED',
            source: 'worker',
            summary: 'Carrier shipment created and order dispatched.',
            metadata: { trackingNumber: shipment.trackingNumber },
          },
        }),
        this.prisma.processedEvent.update({
          where: { consumer_eventId: { consumer: 'order-worker', eventId: event.eventId } },
          data: {
            status: ProcessedEventStatus.COMPLETED,
            processedAt: new Date(),
            resultReference: shipment.trackingNumber,
            lastErrorCode: null,
          },
        }),
        this.attemptQuery(context, AttemptClassification.SUCCESS, AttemptOutcome.SUCCEEDED),
      ]);
    } catch (error: unknown) {
      const carrierError = error instanceof CarrierError ? error : undefined;
      const classification = carrierError?.retryable
        ? AttemptClassification.RETRYABLE
        : AttemptClassification.NON_RETRYABLE;
      const code =
        carrierError?.code ?? (error instanceof DomainError ? error.code : 'PROCESSING_FAILED');
      const nextStatus =
        error instanceof DomainError && error.code === 'INVENTORY_UNAVAILABLE'
          ? 'INVENTORY_UNAVAILABLE'
          : carrierError?.retryable
            ? 'INTEGRATION_FAILED'
            : 'MANUAL_REVIEW';
      await this.prisma.$transaction([
        this.prisma.order.updateMany({
          where: { id: event.payload.orderId, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
          data: {
            status: nextStatus,
            failureCode: code,
            failureMessageSanitized: 'Order processing requires another attempt or support review.',
            version: { increment: 1 },
          },
        }),
        this.prisma.timelineEntry.create({
          data: {
            orderId: event.payload.orderId,
            correlationId: event.correlationId,
            type: 'PROCESSING_ATTEMPT_FAILED',
            source: 'worker',
            summary: `Processing attempt ${String(context.receiveCount)} failed with ${code}.`,
            metadata: { classification, receiveCount: context.receiveCount },
          },
        }),
        this.prisma.processedEvent.update({
          where: { consumer_eventId: { consumer: 'order-worker', eventId: event.eventId } },
          data: { status: ProcessedEventStatus.FAILED, lastErrorCode: code },
        }),
        this.attemptQuery(context, classification, AttemptOutcome.FAILED, code),
      ]);
      throw error;
    }
  }

  private async claimEvent(eventId: string): Promise<boolean> {
    const existing = await this.prisma.processedEvent.findUnique({
      where: { consumer_eventId: { consumer: 'order-worker', eventId } },
    });
    if (existing?.status === ProcessedEventStatus.COMPLETED) return true;
    if (
      existing?.status === ProcessedEventStatus.PROCESSING &&
      existing.leaseExpiresAt > new Date()
    ) {
      throw new DomainError('EVENT_ALREADY_PROCESSING', 'Event is already being processed.');
    }
    await this.prisma.processedEvent.upsert({
      where: { consumer_eventId: { consumer: 'order-worker', eventId } },
      create: {
        consumer: 'order-worker',
        eventId,
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
      update: {
        status: ProcessedEventStatus.PROCESSING,
        attemptCount: { increment: 1 },
        leaseExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    return false;
  }

  private async allocateInventory(event: OrderCreatedV1): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const order = await transaction.order.findUnique({
          where: { id: event.payload.orderId },
          include: { items: true, allocations: true },
        });
        if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Order was not found.', 404);
        if (order.status === 'DELIVERED' || order.status === 'CANCELLED') return;
        if (order.allocations.length > 0) return;

        await transaction.order.update({
          where: { id: order.id },
          data: { status: 'VALIDATING', version: { increment: 1 } },
        });
        const skus = order.items.map((item) => item.sku).sort();
        const inventories = await transaction.$queryRaw<
          { id: string; sku: string; on_hand: number; allocated: number }[]
        >(
          Prisma.sql`SELECT id, sku, on_hand, allocated FROM inventory WHERE sku IN (${Prisma.join(skus)}) ORDER BY sku FOR UPDATE`,
        );
        const bySku = new Map(inventories.map((item) => [item.sku, item]));
        for (const item of order.items) {
          const inventory = bySku.get(item.sku);
          if (!inventory || inventory.on_hand - inventory.allocated < item.quantity) {
            await transaction.order.update({
              where: { id: order.id },
              data: { status: 'INVENTORY_UNAVAILABLE', failureCode: 'INVENTORY_UNAVAILABLE' },
            });
            throw new DomainError(
              'INVENTORY_UNAVAILABLE',
              `Inventory is unavailable for SKU ${item.sku}.`,
            );
          }
        }
        for (const item of order.items) {
          const inventory = bySku.get(item.sku);
          if (!inventory)
            throw new DomainError(
              'INVENTORY_UNAVAILABLE',
              'Inventory disappeared during allocation.',
            );
          await transaction.inventory.update({
            where: { id: inventory.id },
            data: { allocated: { increment: item.quantity }, version: { increment: 1 } },
          });
          await transaction.inventoryAllocation.create({
            data: {
              orderId: order.id,
              orderItemId: item.id,
              inventoryId: inventory.id,
              quantity: item.quantity,
            },
          });
        }
        await transaction.order.update({
          where: { id: order.id },
          data: { status: 'READY_FOR_PICKING', version: { increment: 1 } },
        });
        await transaction.timelineEntry.createMany({
          data: [
            {
              orderId: order.id,
              correlationId: event.correlationId,
              type: 'INVENTORY_ALLOCATED',
              source: 'worker',
              summary: 'Inventory allocated atomically.',
            },
            {
              orderId: order.id,
              correlationId: event.correlationId,
              type: 'READY_FOR_PICKING',
              source: 'worker',
              summary: 'Order is ready for carrier shipment creation.',
            },
          ],
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private attemptQuery(
    context: ProcessingContext,
    classification: AttemptClassification,
    outcome: AttemptOutcome,
    safeErrorCode?: string,
  ): Prisma.Prisma__ProcessingAttemptClient<unknown> {
    return this.prisma.processingAttempt.create({
      data: {
        eventId: context.event.eventId,
        orderId: context.event.payload.orderId,
        sqsMessageId: context.message.MessageId ?? 'unknown',
        receiveCount: context.receiveCount,
        classification,
        outcome,
        ...(safeErrorCode ? { safeErrorCode } : {}),
        startedAt: context.startedAt,
        finishedAt: new Date(),
        correlationId: context.event.correlationId,
      },
    });
  }
}
