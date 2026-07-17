import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:3000/api';
const integration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

interface LoginBody {
  data: { accessToken: string };
}

interface CreatedOrderBody {
  data: { id: string };
}

interface OrderBody {
  data: {
    status: string;
    trackingNumber: string | null;
    timeline: { type: string }[];
  };
}

const fetchJson = async <T>(
  path: string,
  init?: RequestInit,
): Promise<{ response: Response; body: T }> => {
  const response = await fetch(`${apiUrl}${path}`, init);
  const body = (await response.json()) as T;
  if (!response.ok) throw new Error(`${path} failed with HTTP ${String(response.status)}`);
  return { response, body };
};

integration('event-driven order flow', () => {
  it('creates one idempotent order and dispatches it through EventBridge and SQS', async () => {
    const login = await fetchJson<LoginBody>('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'operations@warehouse.local',
        password: process.env.DEMO_OPERATIONS_PASSWORD ?? 'LocalOperations123!',
      }),
    });
    const token = login.body.data.accessToken;
    const idempotencyKey = `integration-${randomUUID()}`;
    const payload = {
      customerId: 'INTEGRATION-CUSTOMER',
      customerReference: `INTEGRATION-${Date.now().toString()}`,
      items: [{ sku: 'PALLET-STD', quantity: 1 }],
    };
    const createOptions: RequestInit = {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    };
    const created = await fetchJson<CreatedOrderBody>('/orders', createOptions);
    const replayed = await fetchJson<CreatedOrderBody>('/orders', createOptions);

    expect(replayed.body.data.id).toBe(created.body.data.id);
    expect(replayed.response.headers.get('idempotent-replayed')).toBe('true');

    const deadline = Date.now() + 45_000;
    let order: OrderBody['data'] | undefined;
    while (Date.now() < deadline) {
      const result = await fetchJson<OrderBody>(`/orders/${created.body.data.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      order = result.body.data;
      if (order.status === 'DISPATCHED') break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    expect(order?.status).toBe('DISPATCHED');
    expect(order?.trackingNumber).toMatch(/^WCT-/);
    expect(order?.timeline.map((entry) => entry.type)).toEqual(
      expect.arrayContaining(['ORDER_RECEIVED', 'INVENTORY_ALLOCATED', 'ORDER_DISPATCHED']),
    );
  }, 60_000);
});
