import { z } from 'zod';

export const orderCreatedV1Schema = z.object({
  specVersion: z.literal('1.0'),
  eventId: z.uuid(),
  eventType: z.literal('order.created.v1'),
  schemaVersion: z.literal(1),
  source: z.literal('warehouse.orders'),
  occurredAt: z.iso.datetime(),
  producer: z.enum(['api', 'worker']),
  correlationId: z.uuid(),
  causationId: z.uuid().optional(),
  traceparent: z.string().max(512).optional(),
  subject: z.object({ orderId: z.uuid() }),
  payload: z.object({
    orderId: z.uuid(),
    customerId: z.string().min(1).max(100),
    items: z
      .array(z.object({ sku: z.string().min(1).max(64), quantity: z.number().int().positive() }))
      .min(1),
  }),
});

export type OrderCreatedV1 = z.infer<typeof orderCreatedV1Schema>;

export const parseOrderCreatedV1 = (input: unknown): OrderCreatedV1 =>
  orderCreatedV1Schema.parse(input);
