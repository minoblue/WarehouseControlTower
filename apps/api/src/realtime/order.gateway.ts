import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { jwtVerify } from 'jose';
import { Server, type Socket } from 'socket.io';
import { apiConfig } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import { createLogger } from '@warehouse/logger';

@WebSocketGateway({
  namespace: '/operations',
  cors: { origin: apiConfig().WEB_ORIGIN, credentials: false },
})
export class OrderGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  public async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    const token = client.handshake.auth.token as unknown;
    if (typeof token !== 'string') {
      client.disconnect(true);
      return;
    }
    try {
      const config = apiConfig();
      await jwtVerify(token, new TextEncoder().encode(config.JWT_SECRET), {
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
        algorithms: ['HS256'],
      });
    } catch {
      client.disconnect(true);
    }
  }

  public orderUpdated(payload: {
    entityId: string;
    status: string;
    version: number;
    correlationId: string;
    occurredAt: string;
  }): void {
    this.server.emit('order.updated', payload);
  }
}

@Injectable()
export class OrderRealtimePublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('api-realtime');
  private timer: NodeJS.Timeout | undefined;
  private cursor = new Date();
  private running = false;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrderGateway,
  ) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => void this.publishCommittedUpdates(), 1000);
  }

  public onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async publishCommittedUpdates(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const startedAt = new Date();
    try {
      const orders = await this.prisma.order.findMany({
        where: { updatedAt: { gt: this.cursor, lte: startedAt } },
        orderBy: { updatedAt: 'asc' },
        take: 100,
      });
      for (const order of orders) {
        this.gateway.orderUpdated({
          entityId: order.id,
          status: order.status,
          version: order.version,
          correlationId: order.correlationId,
          occurredAt: order.updatedAt.toISOString(),
        });
      }
      this.cursor = startedAt;
    } catch (error: unknown) {
      this.logger.error({ error }, 'realtime update polling failed');
    } finally {
      this.running = false;
    }
  }
}
