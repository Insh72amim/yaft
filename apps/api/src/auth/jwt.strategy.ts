import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../common/prisma.service';

const cookieExtractor = (request: Request) => request?.cookies?.finance_session ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]), ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? '', issuer: 'yaft', audience: 'yaft-web' });
  }
  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true } });
    if (!user) throw new UnauthorizedException('Your session is no longer valid. Please sign in again.');
    return user;
  }
}
