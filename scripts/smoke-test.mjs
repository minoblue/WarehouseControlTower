import { randomUUID } from 'node:crypto';

const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:3000/api';
const password = process.env.DEMO_OPERATIONS_PASSWORD ?? 'LocalOperations123!';

const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = body?.error?.code ?? `HTTP_${response.status}`;
    throw new Error(`${path} failed with ${code}`);
  }
  return { response, body };
};

const waitForDispatched = async (orderId, token) => {
  const deadline = Date.now() + 45_000;
  let status = 'UNKNOWN';
  while (Date.now() < deadline) {
    const { body } = await request(`/orders/${orderId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    status = body.data.status;
    if (status === 'DISPATCHED') return body.data;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Order did not dispatch before the deadline; last status was ${status}`);
};

const main = async () => {
  await request('/health/ready');
  const { body: login } = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'operations@warehouse.local',
      password,
    }),
  });
  const token = login.data?.accessToken;
  if (typeof token !== 'string') throw new Error('Login response did not contain an access token');

  const idempotencyKey = `smoke-${randomUUID()}`;
  const payload = {
    customerId: 'SMOKE-CUSTOMER',
    customerReference: `SMOKE-${Date.now()}`,
    items: [{ sku: 'PALLET-STD', quantity: 1 }],
  };
  const createOptions = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  };
  const created = await request('/orders', createOptions);
  const replayed = await request('/orders', createOptions);
  if (created.body.data.id !== replayed.body.data.id) {
    throw new Error('Idempotent replay returned a different order');
  }
  if (replayed.response.headers.get('idempotent-replayed') !== 'true') {
    throw new Error('Idempotent replay was not identified by the API');
  }

  const order = await waitForDispatched(created.body.data.id, token);
  console.log(
    JSON.stringify({
      result: 'passed',
      orderId: order.id,
      status: order.status,
      trackingNumber: order.trackingNumber,
      timelineEntries: order.timeline.length,
      idempotentReplay: true,
    }),
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Smoke test failed');
  process.exitCode = 1;
});
