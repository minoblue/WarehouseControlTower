import { readEnv } from './env.js';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'OPERATIONS' | 'SUPPORT_ENGINEER' | 'ADMIN';
}

export interface Order {
  id: string;
  customerId: string;
  customerReference: string;
  status: string;
  correlationId: string;
  trackingNumber: string | null;
  createdAt: string;
  items: { id: string; sku: string; quantity: number }[];
}

interface LoginResponse {
  data: { accessToken: string; expiresIn: number; user: User };
}

interface OrdersResponse {
  data: Order[];
  meta: { nextCursor: string | null };
}

interface CreateOrderInput {
  customerId: string;
  customerReference: string;
  items: { sku: string; quantity: number }[];
}

interface CreateOrderResponse {
  data: { id: string; status: string; correlationId: string };
}

const API_URL = readEnv('VITE_API_URL', 'http://localhost:3000/api');

export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const token = sessionStorage.getItem('wct_access_token');
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? ((body as { error?: { message?: string } }).error?.message ?? 'Request failed.')
        : 'Request failed.';
    throw new ApiError(message, response.status);
  }
  return body as T;
};

export const api = {
  login: (email: string, password: string): Promise<LoginResponse> =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  orders: (): Promise<OrdersResponse> => request<OrdersResponse>('/orders'),
  createOrder: (input: CreateOrderInput): Promise<CreateOrderResponse> =>
    request<CreateOrderResponse>('/orders', {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
};
