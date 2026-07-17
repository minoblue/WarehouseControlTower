import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseOrderCreatedV1 } from './index.js';

const validEvent = (): Record<string, unknown> => {
  const orderId = randomUUID();
  return {
    specVersion: '1.0',
    eventId: randomUUID(),
    eventType: 'order.created.v1',
    schemaVersion: 1,
    source: 'warehouse.orders',
    occurredAt: new Date().toISOString(),
    producer: 'api',
    correlationId: randomUUID(),
    subject: { orderId },
    payload: { orderId, customerId: 'customer-1', items: [{ sku: 'SKU-1', quantity: 2 }] },
  };
};

describe('order.created.v1 contract', () => {
  it('accepts a complete valid envelope', () => {
    expect(parseOrderCreatedV1(validEvent()).eventType).toBe('order.created.v1');
  });

  it('rejects a non-positive item quantity', () => {
    const event = validEvent();
    event.payload = {
      orderId: randomUUID(),
      customerId: 'customer-1',
      items: [{ sku: 'x', quantity: 0 }],
    };
    expect(() => parseOrderCreatedV1(event)).toThrow();
  });
});
