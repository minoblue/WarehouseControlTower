import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  public use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header('x-correlation-id');
    const correlationId = incoming && uuidPattern.test(incoming) ? incoming : randomUUID();
    response.setHeader('X-Correlation-ID', correlationId);
    response.locals.correlationId = correlationId;
    next();
  }
}
