import { describe, expect, it } from 'vitest';
import { CarrierError } from './carrier.client.js';

describe('CarrierError', () => {
  it('preserves retry classification for safe handling', () => {
    const error = new CarrierError('CARRIER_TIMEOUT', true, 'timed out');
    expect(error.retryable).toBe(true);
    expect(error.code).toBe('CARRIER_TIMEOUT');
  });
});
