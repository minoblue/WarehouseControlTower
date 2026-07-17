import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message,
} from '@aws-sdk/client-sqs';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { parseOrderCreatedV1 } from '@warehouse/event-contracts';
import { createLogger } from '@warehouse/logger';
import { workerConfig } from './config.js';
import { OrderProcessor } from './order.processor.js';
import { WorkerMetrics } from './metrics.js';

const unwrapEventBridgeMessage = (body: string): unknown => {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed === 'object' && parsed !== null && 'detail' in parsed) {
    return parsed.detail;
  }
  return parsed;
};

@Injectable()
export class SqsPoller implements OnModuleInit, OnModuleDestroy {
  private readonly config = workerConfig();
  private readonly logger = createLogger('order-worker');
  private readonly client = new SQSClient({
    region: this.config.AWS_REGION,
    ...(this.config.AWS_ENDPOINT_URL ? { endpoint: this.config.AWS_ENDPOINT_URL } : {}),
    credentials: {
      accessKeyId: this.config.AWS_ACCESS_KEY_ID,
      secretAccessKey: this.config.AWS_SECRET_ACCESS_KEY,
    },
  });
  private stopping = false;
  private loop: Promise<void> | undefined;

  public constructor(
    private readonly processor: OrderProcessor,
    private readonly metrics: WorkerMetrics,
  ) {}

  public onModuleInit(): void {
    this.loop = this.poll();
  }

  public async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    await this.loop;
    this.client.destroy();
  }

  private async poll(): Promise<void> {
    while (!this.stopping) {
      try {
        const response = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: this.config.ORDER_QUEUE_URL,
            WaitTimeSeconds: this.config.SQS_WAIT_TIME_SECONDS,
            VisibilityTimeout: this.config.SQS_VISIBILITY_TIMEOUT_SECONDS,
            MaxNumberOfMessages: Math.min(10, this.config.WORKER_CONCURRENCY),
            MessageSystemAttributeNames: ['ApproximateReceiveCount'],
          }),
        );
        await Promise.all((response.Messages ?? []).map((message) => this.handle(message)));
      } catch (error: unknown) {
        this.logger.error({ error }, 'sqs polling failed');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async handle(message: Message): Promise<void> {
    if (!message.Body || !message.ReceiptHandle) return;
    this.metrics.start();
    try {
      const event = parseOrderCreatedV1(unwrapEventBridgeMessage(message.Body));
      const receiveCount = Number(message.Attributes?.ApproximateReceiveCount ?? '1');
      await this.processor.process({ message, event, receiveCount, startedAt: new Date() });
      await this.client.send(
        new DeleteMessageCommand({
          QueueUrl: this.config.ORDER_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );
      this.logger.info(
        { eventId: event.eventId, correlationId: event.correlationId },
        'message completed',
      );
      this.metrics.finish('success');
    } catch (error: unknown) {
      this.logger.warn({ messageId: message.MessageId, error }, 'message processing failed');
      this.metrics.finish('failure');
    }
  }
}
