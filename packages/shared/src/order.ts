export const ORDER_STATUSES = {
  RECEIVED: 'RECEIVED',
  VALIDATING: 'VALIDATING',
  INVENTORY_ALLOCATED: 'INVENTORY_ALLOCATED',
  READY_FOR_PICKING: 'READY_FOR_PICKING',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVENTORY_UNAVAILABLE: 'INVENTORY_UNAVAILABLE',
  INTEGRATION_FAILED: 'INTEGRATION_FAILED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

const allowedTransitions = {
  RECEIVED: ['VALIDATING', 'CANCELLED'],
  VALIDATING: [
    'INVENTORY_ALLOCATED',
    'VALIDATION_FAILED',
    'INVENTORY_UNAVAILABLE',
    'MANUAL_REVIEW',
  ],
  INVENTORY_ALLOCATED: ['READY_FOR_PICKING', 'INTEGRATION_FAILED', 'MANUAL_REVIEW', 'CANCELLED'],
  READY_FOR_PICKING: ['DISPATCHED', 'INTEGRATION_FAILED', 'MANUAL_REVIEW', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'MANUAL_REVIEW'],
  DELIVERED: [],
  VALIDATION_FAILED: ['RECEIVED', 'CANCELLED'],
  INVENTORY_UNAVAILABLE: ['RECEIVED', 'CANCELLED'],
  INTEGRATION_FAILED: ['READY_FOR_PICKING', 'MANUAL_REVIEW', 'CANCELLED'],
  MANUAL_REVIEW: ['RECEIVED', 'READY_FOR_PICKING', 'CANCELLED'],
  CANCELLED: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;

export const canTransitionOrder = (from: OrderStatus, to: OrderStatus): boolean =>
  (allowedTransitions[from] as readonly OrderStatus[]).includes(to);

export const assertOrderTransition = (from: OrderStatus, to: OrderStatus): void => {
  if (!canTransitionOrder(from, to)) {
    throw new DomainError(
      'ORDER_INVALID_TRANSITION',
      `Order cannot transition from ${from} to ${to}.`,
    );
  }
};

import { DomainError } from './errors.js';
