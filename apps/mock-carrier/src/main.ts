import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Module,
  Param,
  Post,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IsIn, IsString, IsUUID } from 'class-validator';
import helmet from 'helmet';

const modes = [
  'healthy',
  'timeout',
  'http-500',
  'rate-limit',
  'invalid-response',
  'network-failure',
] as const;
type Mode = (typeof modes)[number];

class CreateShipmentDto {
  @IsUUID()
  public orderId!: string;
}

class SetModeDto {
  @IsString()
  @IsIn(modes)
  public mode!: Mode;
}

@Controller()
class CarrierController {
  private mode: Mode = 'healthy';
  private readonly shipments = new Map<string, { trackingNumber: string; status: 'CREATED' }>();

  @Get('health/live')
  public live(): unknown {
    return { status: 'ok', service: 'mock-carrier' };
  }

  @Post('shipments')
  public async create(
    @Body() input: CreateShipmentDto,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<unknown> {
    if (!key) throw new HttpException('Idempotency-Key is required.', 400);
    const existing = this.shipments.get(key);
    if (existing) return existing;
    if (this.mode === 'timeout') await new Promise((resolve) => setTimeout(resolve, 10_000));
    if (this.mode === 'http-500') throw new HttpException('Simulated carrier failure.', 500);
    if (this.mode === 'rate-limit') throw new HttpException('Simulated rate limit.', 429);
    if (this.mode === 'network-failure')
      throw new HttpException('Simulated connection failure.', 503);
    if (this.mode === 'invalid-response') return { unexpected: true };
    const shipment = {
      trackingNumber: `WCT-${input.orderId.replaceAll('-', '').slice(0, 12).toUpperCase()}`,
      status: 'CREATED' as const,
    };
    this.shipments.set(key, shipment);
    return shipment;
  }

  @Get('shipments/:trackingNumber')
  public get(@Param('trackingNumber') trackingNumber: string): unknown {
    const shipment = [...this.shipments.values()].find(
      (item) => item.trackingNumber === trackingNumber,
    );
    if (!shipment) throw new HttpException('Shipment not found.', 404);
    return shipment;
  }

  @Put('admin/mode')
  public setMode(
    @Body() input: SetModeDto,
    @Headers('x-mock-admin-key') adminKey: string | undefined,
  ): unknown {
    if (process.env.NODE_ENV === 'production') throw new HttpException('Not found.', 404);
    if (!adminKey || adminKey !== process.env.MOCK_CARRIER_ADMIN_KEY)
      throw new HttpException('Forbidden.', 403);
    this.mode = input.mode;
    return { mode: this.mode };
  }
}

@Module({ controllers: [CarrierController] })
// NestJS uses the decorated class as the application module token.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  await app.listen(Number(process.env.MOCK_CARRIER_PORT ?? 3002), '0.0.0.0');
};

void bootstrap();
