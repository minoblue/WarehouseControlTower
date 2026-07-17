import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '@warehouse/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const correlationId = String(response.locals.correlationId ?? 'unknown');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let details: unknown[] = [];

    if (exception instanceof DomainError) {
      status = exception.statusCode;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code =
        status === HttpStatus.UNAUTHORIZED
          ? 'UNAUTHORIZED'
          : status === HttpStatus.FORBIDDEN
            ? 'FORBIDDEN'
            : 'REQUEST_FAILED';
      const body = exception.getResponse();
      if (typeof body === 'object' && 'message' in body) {
        const raw = body.message;
        if (Array.isArray(raw)) details = raw;
        else if (typeof raw === 'string') message = raw;
      }
    }

    response.status(status).json({
      error: { code, message, details, correlationId },
      meta: { path: request.path },
    });
  }
}
