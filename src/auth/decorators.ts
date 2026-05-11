// ============================================================
// YIRA — src/auth/decorators.ts
// ============================================================
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RoleUtilisateur } from './auth.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY     = 'roles';

/** Route accessible sans JWT */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restreindre à des rôles précis */
export const Roles = (...roles: RoleUtilisateur[]) => SetMetadata(ROLES_KEY, roles);

/** Injecter le payload JWT dans le paramètre */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user
);

/** Injecter le country_code du JWT */
export const CountryCode = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest().user?.country_code ?? 'CI'
);