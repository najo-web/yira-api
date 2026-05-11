// ============================================================
// YIRA — src/auth/auth.service.ts
// Login email · OTP SMS · Refresh token · Profil
// ============================================================
import {
  Injectable, UnauthorizedException,
  BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt       from 'bcryptjs';
import { PrismaClient }  from '@prisma/client';
import { Inject }        from '@nestjs/common';
import { PRISMA_SYNC }   from '../database/database.module';

export enum RoleUtilisateur {
  BENEFICIAIRE  = 'BENEFICIAIRE',
  CONSEILLER    = 'CONSEILLER',
  EMPLOYEUR     = 'EMPLOYEUR',
  INSTITUTION   = 'INSTITUTION',
  JOURNALIST    = 'JOURNALIST',
  ADMIN_PAYS    = 'ADMIN_PAYS',
  SUPER_ADMIN   = 'SUPER_ADMIN',
}

export interface JwtPayload {
  sub:          string;
  telephone:    string;
  role:         RoleUtilisateur;
  country_code: string;
}

export interface TokenPair {
  access_token:  string;
  refresh_token: string;
  expires_in:    number;
}

// OTP stocké en mémoire (on migrera en BDD au Sprint 3 avec Prisma migrations)
const otpStore = new Map<string, { code: string; expires: Date; attempts: number }>();

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService:  JwtService,
    private config:      ConfigService,
    @Inject(PRISMA_SYNC) private prisma: PrismaClient,
  ) {}

  // ── 1. Demander un OTP SMS ─────────────────────────────────
  async demanderOTP(telephone: string, country_code: string): Promise<{ message: string }> {
    const code      = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const key       = `${telephone}_${country_code}`;

    otpStore.set(key, { code, expires: expiresAt, attempts: 0 });

    // En dev : afficher le code dans les logs (en prod → LAfricaMobile SMS)
    this.logger.log(`📱 OTP pour ${telephone} [${country_code}] : ${code}`);

    return { message: `Code envoyé au ${telephone}. Valable 10 minutes.` };
  }

  // ── 2. Vérifier l'OTP et retourner les tokens ─────────────
  async verifierOTP(telephone: string, code: string, country_code: string): Promise<TokenPair> {
    const key  = `${telephone}_${country_code}`;
    const data = otpStore.get(key);

    if (!data)
      throw new UnauthorizedException('Code expiré — demandez un nouveau');
    if (new Date() > data.expires) {
      otpStore.delete(key);
      throw new UnauthorizedException('Code expiré');
    }
    if (data.attempts >= 3) {
      otpStore.delete(key);
      throw new UnauthorizedException('Trop de tentatives — demandez un nouveau code');
    }
    if (data.code !== code) {
      data.attempts++;
      throw new UnauthorizedException(
        `Code incorrect — ${3 - data.attempts} tentative(s) restante(s)`
      );
    }

    otpStore.delete(key);

    // Créer ou récupérer l'utilisateur
    let user: any;
    try {
      user = await (this.prisma as any).yiraUtilisateur?.findFirst({
        where: { telephone, country_code },
      });
    } catch { user = null; }

    if (!user) {
      // Utilisateur fictif en attendant les migrations Prisma
      user = { id: `user_${Date.now()}`, telephone, country_code, role: RoleUtilisateur.BENEFICIAIRE };
    }

    return this.genererTokens(user);
  }

  // ── 3. Refresh token ───────────────────────────────────────
  async refreshTokens(refresh_token: string): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refresh_token, {
        secret: this.config.get('JWT_SECRET') + '_refresh',
      });
      return this.genererTokens({
        id: payload.sub, telephone: payload.telephone,
        role: payload.role, country_code: payload.country_code,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  genererTokens(user: { id: string; telephone: string; role: string; country_code: string }): TokenPair {
    const payload: JwtPayload = {
      sub: user.id, telephone: user.telephone,
      role: user.role as RoleUtilisateur, country_code: user.country_code,
    };
    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRY', '7d'),
    });
    const refresh_token = this.jwtService.sign(payload, {
      secret:    this.config.get('JWT_SECRET') + '_refresh',
      expiresIn: this.config.get('JWT_REFRESH_EXPIRY', '30d'),
    });
    return { access_token, refresh_token, expires_in: 7 * 24 * 60 * 60 };
  }
}