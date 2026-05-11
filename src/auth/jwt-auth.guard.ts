// ============================================================
// YIRA — src/auth/jwt-auth.guard.ts
// ============================================================
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard }    from '@nestjs/passport';
import { Reflector }    from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    return isPublic ? true : super.canActivate(ctx);
  }
}