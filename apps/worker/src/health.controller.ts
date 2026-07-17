import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Controller()
export class HealthController {
  public constructor(private readonly prisma: PrismaService) {}

  @Get('health/live')
  public live(): unknown {
    return { status: 'ok', service: 'worker' };
  }

  @Get('health/ready')
  public async ready(): Promise<unknown> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', dependencies: { database: 'up' } };
    } catch {
      throw new ServiceUnavailableException('Worker dependencies are unavailable.');
    }
  }
}
