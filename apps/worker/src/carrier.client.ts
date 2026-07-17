import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { workerConfig } from './config.js';

const responseSchema = z.object({
  trackingNumber: z.string().min(1).max(100),
  status: z.literal('CREATED'),
});

export class CarrierError extends Error {
  public constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'CarrierError';
  }
}

@Injectable()
export class CarrierClient {
  private readonly config = workerConfig();

  public async createShipment(input: {
    orderId: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<{ trackingNumber: string; status: 'CREATED' }> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.config.CARRIER_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.config.CARRIER_BASE_URL}/shipments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': input.idempotencyKey,
          'x-correlation-id': input.correlationId,
        },
        body: JSON.stringify({ orderId: input.orderId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new CarrierError(
          `CARRIER_HTTP_${String(response.status)}`,
          retryable,
          'Carrier request failed.',
          response.status,
        );
      }
      const body: unknown = await response.json();
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) {
        throw new CarrierError('CARRIER_INVALID_RESPONSE', false, 'Carrier response was invalid.');
      }
      return parsed.data;
    } catch (error: unknown) {
      if (error instanceof CarrierError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CarrierError('CARRIER_TIMEOUT', true, 'Carrier request timed out.');
      }
      throw new CarrierError('CARRIER_NETWORK_FAILURE', true, 'Carrier network request failed.');
    } finally {
      clearTimeout(timer);
    }
  }
}
