import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AuthGuard } from './common/auth.guard.js';
import { CorrelationMiddleware } from './common/correlation.middleware.js';
import { HealthController } from './health.controller.js';
import { OrdersController } from './orders/orders.controller.js';
import { OrdersService } from './orders/orders.service.js';
import { ApiMetrics, ApiMetricsInterceptor, MetricsController } from './metrics.js';
import { OutboxPublisher } from './outbox/outbox.publisher.js';
import { PrismaService } from './prisma.service.js';
import { OrderGateway, OrderRealtimePublisher } from './realtime/order.gateway.js';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
  controllers: [AuthController, HealthController, MetricsController, OrdersController],
  providers: [
    PrismaService,
    AuthService,
    OrdersService,
    OutboxPublisher,
    OrderGateway,
    OrderRealtimePublisher,
    ApiMetrics,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: ApiMetricsInterceptor },
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('{*path}');
  }
}
