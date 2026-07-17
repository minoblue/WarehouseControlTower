import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/public.decorator.js';
import { PrismaService } from './prisma.service.js';

@Controller()
export class HealthController {
  public constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health/live')
  public live(): unknown {
    return { status: 'ok', service: 'api' };
  }

  @Public()
  @Get('health/ready')
  public async ready(): Promise<unknown> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', dependencies: { database: 'up' } };
    } catch {
      throw new ServiceUnavailableException('API dependencies are unavailable.');
    }
  }

  @Public()
  @Get('version')
  public version(): unknown {
    return {
      version: process.env.APP_VERSION ?? 'dev',
      gitSha: process.env.GIT_SHA ?? 'local',
    };
  }
}
