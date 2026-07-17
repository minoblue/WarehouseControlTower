import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  type NestInterceptor,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import { finalize, type Observable } from 'rxjs';
import { Public } from './common/public.decorator.js';

@Injectable()
export class ApiMetrics {
  private readonly registry = new Registry();
  private readonly duration = new Histogram({
    name: 'wct_api_http_request_duration_seconds',
    help: 'API HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  public constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'wct_api_' });
  }

  public observe(method: string, route: string, status: number, seconds: number): void {
    this.duration.observe({ method, route, status: String(status) }, seconds);
  }

  public contentType(): string {
    return this.registry.contentType;
  }

  public metrics(): Promise<string> {
    return this.registry.metrics();
  }
}

@Injectable()
export class ApiMetricsInterceptor implements NestInterceptor {
  public constructor(private readonly metrics: ApiMetrics) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = process.hrtime.bigint();
    const http = context.switchToHttp();
    const request = http.getRequest<{ method: string; route?: { path?: string }; path: string }>();
    const response = http.getResponse<{ statusCode: number }>();
    return next.handle().pipe(
      finalize(() => {
        const duration = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        this.metrics.observe(
          request.method,
          request.route?.path ?? request.path,
          response.statusCode,
          duration,
        );
      }),
    );
  }
}

@Controller()
export class MetricsController {
  public constructor(private readonly metricsService: ApiMetrics) {}

  @Public()
  @Get('metrics')
  public async metrics(@Res() response: Response): Promise<void> {
    response.type(this.metricsService.contentType()).send(await this.metricsService.metrics());
  }
}
