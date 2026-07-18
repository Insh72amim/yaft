import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './auth.dto';
import { JwtAuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register') @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.register(dto); this.setCookie(response, result.token); return result.user;
  }

  @Post('login') @HttpCode(200) @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto); this.setCookie(response, result.token); return result.user;
  }

  @Post('logout') @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response) { response.clearCookie('finance_session', { path: '/' }); }

  @Get('me') @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { id: string }) { return this.auth.profile(user.id); }

  private setCookie(response: Response, token: string) {
    response.cookie('finance_session', token, { httpOnly: true, sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production', maxAge: 15 * 60 * 1000, path: '/' });
  }
}
