import { Controller, Get, Header, Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Registry } from 'prom-client';

@Injectable()
export class WorkerMetrics {
  private readonly registry = new Registry();
  private readonly processed = new Counter({
    name: 'wct_worker_messages_total',
    help: 'SQS messages handled by outcome.',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });
  private readonly inflight = new Gauge({
    name: 'wct_worker_inflight',
    help: 'Messages currently being handled.',
    registers: [this.registry],
  });

  public constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'wct_worker_' });
  }

  public start(): void {
    this.inflight.inc();
  }

  public finish(outcome: 'success' | 'failure'): void {
    this.inflight.dec();
    this.processed.inc({ outcome });
  }

  public contentType(): string {
    return this.registry.contentType;
  }

  public metrics(): Promise<string> {
    return this.registry.metrics();
  }
}

@Controller()
export class MetricsController {
  public constructor(private readonly workerMetrics: WorkerMetrics) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  public metrics(): Promise<string> {
    return this.workerMetrics.metrics();
  }
}
