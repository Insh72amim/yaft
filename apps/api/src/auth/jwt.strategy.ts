import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

const cookieExtractor = (request: Request) => request?.cookies?.finance_session ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]), ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? '', issuer: 'yaft', audience: 'yaft-web' });
  }
  validate(payload: { sub: string; email: string }) { return { id: payload.sub, email: payload.email }; }
}
