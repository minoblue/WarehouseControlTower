import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createLogger } from '@warehouse/logger';
import { apiConfig } from '../config.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('api-outbox');
  private readonly config = apiConfig();
  private readonly client = new EventBridgeClient({
    region: this.config.AWS_REGION,
    ...(this.config.AWS_ENDPOINT_URL ? { endpoint: this.config.AWS_ENDPOINT_URL } : {}),
    credentials: {
      accessKeyId: this.config.AWS_ACCESS_KEY_ID,
      secretAccessKey: this.config.AWS_SECRET_ACCESS_KEY,
    },
  });
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  public constructor(private readonly prisma: PrismaService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => void this.publishBatch(), this.config.OUTBOX_POLL_INTERVAL_MS);
  }

  public onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.client.destroy();
  }

  private async publishBatch(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.prisma.outboxEvent.findMany({
        where: { publishedAt: null, nextAttemptAt: { lte: new Date() } },
        orderBy: { occurredAt: 'asc' },
        take: 10,
      });
      for (const event of events) {
        try {
          const result = await this.client.send(
            new PutEventsCommand({
              Entries: [
                {
                  EventBusName: this.config.EVENT_BUS_NAME,
                  Source: 'warehouse.orders',
                  DetailType: event.eventType,
                  Detail: JSON.stringify(event.payload),
                  Time: event.occurredAt,
                },
              ],
            }),
          );
          if ((result.FailedEntryCount ?? 0) > 0) {
            throw new Error(result.Entries?.[0]?.ErrorCode ?? 'EVENTBRIDGE_ENTRY_REJECTED');
          }
          await this.prisma.outboxEvent.update({
            where: { id: event.id, publishedAt: null },
            data: { publishedAt: new Date(), attemptCount: { increment: 1 }, lastErrorCode: null },
          });
          this.logger.info(
            { eventId: event.id, correlationId: event.correlationId },
            'outbox published',
          );
        } catch (error: unknown) {
          const attempt = event.attemptCount + 1;
          const delay = Math.min(60_000, 500 * 2 ** Math.min(attempt, 7));
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              attemptCount: { increment: 1 },
              nextAttemptAt: new Date(Date.now() + delay + Math.floor(Math.random() * 250)),
              lastErrorCode: 'EVENTBRIDGE_PUBLISH_FAILED',
            },
          });
          this.logger.error({ eventId: event.id, error }, 'outbox publish failed');
        }
      }
    } finally {
      this.running = false;
    }
  }
}
