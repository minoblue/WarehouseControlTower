import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { jwtVerify } from 'jose';
import { apiConfig } from '../config.js';
import type { AuthenticatedUser } from './authenticated-user.js';
import { IS_PUBLIC } from './public.decorator.js';
import { ROLES } from './roles.decorator.js';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuthGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();

    try {
      const config = apiConfig();
      const result = await jwtVerify(
        authorization.slice(7),
        new TextEncoder().encode(config.JWT_SECRET),
        { issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE, algorithms: ['HS256'] },
      );
      const { sub, email, role } = result.payload;
      if (!sub || typeof email !== 'string' || typeof role !== 'string') {
        throw new UnauthorizedException();
      }
      request.user = { id: sub, email, role: role as UserRole };
      const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (roles && !roles.includes(request.user.role)) throw new ForbiddenException();
      return true;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException();
    }
  }
}
