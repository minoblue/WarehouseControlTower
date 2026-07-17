import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import type { OrderCreatedV1 } from '@warehouse/event-contracts';
import { DomainError } from '@warehouse/shared';
import type { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma.service.js';
import type { CreateOrderDto, ListOrdersQueryDto } from './order.dto.js';

interface CreatedOrderResponse {
  readonly id: string;
  readonly status: OrderStatus;
  readonly correlationId: string;
}

const parseStoredResponse = (value: Prisma.JsonValue): CreatedOrderResponse => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DomainError(
      'IDEMPOTENCY_RECORD_INVALID',
      'Stored idempotency response is invalid.',
      500,
    );
  }
  const { id, status, correlationId } = value;
  const parsedStatus =
    typeof status === 'string'
      ? Object.values(OrderStatus).find((candidate) => candidate === status)
      : undefined;
  if (typeof id !== 'string' || !parsedStatus || typeof correlationId !== 'string') {
    throw new DomainError(
      'IDEMPOTENCY_RECORD_INVALID',
      'Stored idempotency response is invalid.',
      500,
    );
  }
  return { id, status: parsedStatus, correlationId };
};

const canonicalRequest = (input: CreateOrderDto): string =>
  JSON.stringify({
    customerId: input.customerId,
    customerReference: input.customerReference,
    items: [...input.items]
      .map((item) => ({ sku: item.sku.trim().toUpperCase(), quantity: item.quantity }))
      .sort((a, b) => a.sku.localeCompare(b.sku)),
  });

@Injectable()
export class OrdersService {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(
    input: CreateOrderDto,
    idempotencyKey: string | undefined,
    user: AuthenticatedUser,
    correlationId: string,
  ): Promise<{ data: CreatedOrderResponse; replayed: boolean }> {
    if (!idempotencyKey || idempotencyKey.length > 160) {
      throw new DomainError(
        'IDEMPOTENCY_KEY_REQUIRED',
        'A valid Idempotency-Key header is required.',
        400,
      );
    }
    const canonical = canonicalRequest(input);
    const requestHash = createHash('sha256').update(canonical).digest('hex');

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.idempotencyKey.findUnique({
            where: {
              scope_actorId_key: { scope: 'orders.create', actorId: user.id, key: idempotencyKey },
            },
          });
          if (existing) {
            if (existing.requestHash !== requestHash) {
              throw new DomainError(
                'IDEMPOTENCY_KEY_REUSED',
                'The idempotency key was already used for a different request.',
              );
            }
            if (existing.state === 'COMPLETED' && existing.responseBody) {
              return { data: parseStoredResponse(existing.responseBody), replayed: true };
            }
            throw new DomainError(
              'IDEMPOTENCY_REQUEST_IN_PROGRESS',
              'This request is already processing.',
            );
          }

          await transaction.idempotencyKey.create({
            data: {
              scope: 'orders.create',
              actorId: user.id,
              key: idempotencyKey,
              requestHash,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });

          const normalized = JSON.parse(canonical) as CreateOrderDto;
          const order = await transaction.order.create({
            data: {
              customerId: normalized.customerId,
              customerReference: normalized.customerReference,
              correlationId,
              items: { create: normalized.items },
              timeline: {
                create: {
                  correlationId,
                  type: 'ORDER_RECEIVED',
                  source: 'api',
                  summary: 'Order accepted for asynchronous processing.',
                  metadata: { actorId: user.id, role: user.role },
                },
              },
            },
          });
          const eventId = randomUUID();
          const envelope = {
            specVersion: '1.0',
            eventId,
            eventType: 'order.created.v1',
            schemaVersion: 1,
            source: 'warehouse.orders',
            occurredAt: new Date().toISOString(),
            producer: 'api',
            correlationId,
            subject: { orderId: order.id },
            payload: {
              orderId: order.id,
              customerId: normalized.customerId,
              items: normalized.items,
            },
          } satisfies OrderCreatedV1;
          await transaction.outboxEvent.create({
            data: {
              id: eventId,
              aggregateType: 'Order',
              aggregateId: order.id,
              eventType: envelope.eventType,
              schemaVersion: 1,
              correlationId,
              // Prisma JSON uses an open index signature; the envelope is runtime-validated at its boundary.
              payload: envelope as unknown as Prisma.InputJsonValue,
              occurredAt: new Date(envelope.occurredAt),
            },
          });
          const response = { id: order.id, status: order.status, correlationId };
          await transaction.idempotencyKey.update({
            where: {
              scope_actorId_key: { scope: 'orders.create', actorId: user.id, key: idempotencyKey },
            },
            data: {
              state: 'COMPLETED',
              responseStatus: 202,
              responseBody: response,
              resourceId: order.id,
            },
          });
          return { data: response, replayed: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.idempotencyKey.findUnique({
          where: {
            scope_actorId_key: {
              scope: 'orders.create',
              actorId: user.id,
              key: idempotencyKey,
            },
          },
        });
        if (winner?.requestHash !== requestHash) {
          throw new DomainError(
            'IDEMPOTENCY_KEY_REUSED',
            'The idempotency key was already used for a different request.',
          );
        }
        if (winner.state === 'COMPLETED' && winner.responseBody) {
          return { data: parseStoredResponse(winner.responseBody), replayed: true };
        }
        throw new DomainError(
          'IDEMPOTENCY_REQUEST_IN_PROGRESS',
          'This request is already processing.',
        );
      }
      throw error;
    }
  }

  public async list(query: ListOrdersQueryDto): Promise<unknown> {
    const status = Object.values(OrderStatus).includes(query.status as OrderStatus)
      ? (query.status as OrderStatus)
      : undefined;
    const orders = await this.prisma.order.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
      },
      include: { items: true, shipment: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = orders.length > 50;
    const data = hasMore ? orders.slice(0, 50) : orders;
    return { data, meta: { nextCursor: hasMore ? data.at(-1)?.id : null } };
  }

  public async get(id: string): Promise<unknown> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        allocations: { include: { inventory: true } },
        shipment: true,
        timeline: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Order was not found.', 404);
    return { data: order };
  }
}
