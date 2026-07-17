import { Module } from '@nestjs/common';
import { CarrierClient } from './carrier.client.js';
import { HealthController } from './health.controller.js';
import { OrderProcessor } from './order.processor.js';
import { PrismaService } from './prisma.service.js';
import { SqsPoller } from './sqs.poller.js';
import { MetricsController, WorkerMetrics } from './metrics.js';

@Module({
  controllers: [HealthController, MetricsController],
  providers: [PrismaService, CarrierClient, OrderProcessor, SqsPoller, WorkerMetrics],
})
// NestJS uses the decorated class as the application module token.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
