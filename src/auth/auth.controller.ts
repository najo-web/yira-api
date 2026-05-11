// ============================================================
// YIRA — src/auth/auth.controller.ts  (fix Body parsing)
// ============================================================
import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService }  from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser }  from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /api/auth/otp/demander
  @Post('otp/demander')
  demanderOTP(@Body('telephone') telephone: string, @Body('country_code') country_code: string) {
    return this.authService.demanderOTP(telephone, country_code ?? 'CI');
  }

  // POST /api/auth/otp/verifier
  @Post('otp/verifier')
  verifierOTP(
    @Body('telephone')    telephone: string,
    @Body('code')         code: string,
    @Body('country_code') country_code: string,
  ) {
    return this.authService.verifierOTP(telephone, code, country_code ?? 'CI');
  }

  // POST /api/auth/refresh
  @Post('refresh')
  refresh(@Body('refresh_token') refresh_token: string) {
    return this.authService.refreshTokens(refresh_token);
  }

  // GET /api/auth/me  ← protégée par JWT
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return { user, message: '✅ Token JWT valide' };
  }
}