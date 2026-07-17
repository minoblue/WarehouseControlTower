import { describe, expect, it } from 'vitest';
import { assertOrderTransition, canTransitionOrder } from './order.js';

describe('order state transitions', () => {
  it('allows the documented happy-path transition', () => {
    expect(canTransitionOrder('RECEIVED', 'VALIDATING')).toBe(true);
  });

  it('rejects transitions out of a terminal state', () => {
    expect(canTransitionOrder('DELIVERED', 'RECEIVED')).toBe(false);
    expect(() => {
      assertOrderTransition('CANCELLED', 'VALIDATING');
    }).toThrow('Order cannot transition from CANCELLED to VALIDATING.');
  });
});
