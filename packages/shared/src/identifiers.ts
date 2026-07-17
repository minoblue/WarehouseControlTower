export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type OrderId = Brand<string, 'OrderId'>;
export type EventId = Brand<string, 'EventId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
export type IncidentId = Brand<string, 'IncidentId'>;

export const toOrderId = (value: string): OrderId => value as OrderId;
export const toEventId = (value: string): EventId => value as EventId;
export const toCorrelationId = (value: string): CorrelationId => value as CorrelationId;
export const toIncidentId = (value: string): IncidentId => value as IncidentId;
