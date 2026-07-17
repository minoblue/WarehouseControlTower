import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { workerConfig } from './config.js';

const bootstrap = async (): Promise<void> => {
  const config = workerConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.enableShutdownHooks();
  await app.listen(config.WORKER_PORT, '0.0.0.0');
};

void bootstrap();
