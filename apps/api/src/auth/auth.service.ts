import { Injectable, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { SignJWT } from 'jose';
import { apiConfig } from '../config.js';
import { PrismaService } from '../prisma.service.js';
import type { LoginDto } from './auth.dto.js';

@Injectable()
export class AuthService {
  public constructor(private readonly prisma: PrismaService) {}

  public async login(input: LoginDto): Promise<{
    accessToken: string;
    expiresIn: number;
    user: { id: string; email: string; displayName: string; role: string };
  }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user?.active || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const config = apiConfig();
    const accessToken = await new SignJWT({ email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(config.JWT_ISSUER)
      .setAudience(config.JWT_AUDIENCE)
      .setIssuedAt()
      .setJti(crypto.randomUUID())
      .setExpirationTime(`${String(config.JWT_ACCESS_TTL_SECONDS)}s`)
      .sign(new TextEncoder().encode(config.JWT_SECRET));

    return {
      accessToken,
      expiresIn: config.JWT_ACCESS_TTL_SECONDS,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    };
  }
}
