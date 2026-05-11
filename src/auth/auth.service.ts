// ============================================================
// YIRA — src/auth/auth.service.ts  (Sprint 9 — OTP en BDD)
// OTP stocké dans YiraOtpTemp (base_sync)
// Utilisateurs persistants dans YiraUtilisateur
// ============================================================
import { Injectable, UnauthorizedException, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt       from 'bcryptjs';
import { Pool }          from 'pg';

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
  niveau_acces: string;
}

export interface TokenPair {
  access_token:  string;
  refresh_token: string;
  expires_in:    number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private pool: Pool;

  constructor(
    private jwtService:  JwtService,
    private config:      ConfigService,
  ) {}

  async onModuleInit() {
    this.pool = new Pool({ connectionString: this.config.get('DATABASE_SYNC_URL') });
    await this.pool.connect().then(c => { c.release(); });
    this.logger.log('OK AuthService connecte a base_sync (pg)');
  }

  // ── 1. Demander OTP ───────────────────────────────────────
  async demanderOTP(telephone: string, country_code: string): Promise<{ message: string }> {
    const code      = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Supprimer l'ancien OTP si existe
    await this.pool.query(
      'DELETE FROM yira_otp_temp WHERE telephone = $1 AND country_code = $2',
      [telephone, country_code]
    );

    // Insérer le nouvel OTP
    await this.pool.query(
      `INSERT INTO yira_otp_temp (id, telephone, country_code, code, expires_at, tentatives)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0)`,
      [telephone, country_code, code, expiresAt]
    );

    // En dev : afficher dans les logs (en prod → LAfricaMobile SMS)
    this.logger.log(`OTP pour ${telephone} [${country_code}] : ${code}`);

    return { message: `Code envoyé au ${telephone}. Valable 10 minutes.` };
  }

  // ── 2. Vérifier OTP ───────────────────────────────────────
  async verifierOTP(telephone: string, code: string, country_code: string): Promise<TokenPair> {
    // Récupérer l'OTP en BDD
    const res = await this.pool.query(
      'SELECT * FROM yira_otp_temp WHERE telephone = $1 AND country_code = $2',
      [telephone, country_code]
    );

    if (res.rows.length === 0)
      throw new UnauthorizedException('Code expiré — demandez un nouveau');

    const otp = res.rows[0];

    // Vérifier expiration
    if (new Date() > new Date(otp.expires_at)) {
      await this.pool.query('DELETE FROM yira_otp_temp WHERE id = $1', [otp.id]);
      throw new UnauthorizedException('Code expiré');
    }

    // Vérifier tentatives
    if (otp.tentatives >= 3) {
      await this.pool.query('DELETE FROM yira_otp_temp WHERE id = $1', [otp.id]);
      throw new UnauthorizedException('Trop de tentatives — demandez un nouveau code');
    }

    // Vérifier le code
    if (otp.code !== code) {
      await this.pool.query(
        'UPDATE yira_otp_temp SET tentatives = tentatives + 1 WHERE id = $1',
        [otp.id]
      );
      const restantes = 3 - (otp.tentatives + 1);
      throw new UnauthorizedException(`Code incorrect — ${restantes} tentative(s) restante(s)`);
    }

    // OTP valide — supprimer
    await this.pool.query('DELETE FROM yira_otp_temp WHERE id = $1', [otp.id]);

    // Récupérer ou créer l'utilisateur
    const user = await this.obtenirOuCreerUtilisateur(telephone, country_code);

    return this.genererTokens(user);
  }

  // ── 3. Refresh token ──────────────────────────────────────
  async refreshTokens(refresh_token: string): Promise<TokenPair> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refresh_token, {
        secret: this.config.get('JWT_SECRET') + '_refresh',
      });
      const user = await this.obtenirUtilisateur(payload.sub);
      return this.genererTokens(user ?? {
        id: payload.sub, telephone: payload.telephone,
        role: payload.role, country_code: payload.country_code,
        niveau_acces: payload.niveau_acces ?? 'FREE',
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  private async obtenirOuCreerUtilisateur(telephone: string, country_code: string): Promise<any> {
    // Chercher l'utilisateur existant
    const res = await this.pool.query(
      'SELECT * FROM yira_utilisateur WHERE telephone = $1 AND country_code = $2',
      [telephone, country_code]
    );

    if (res.rows.length > 0) return res.rows[0];

    // Créer un nouvel utilisateur
    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    await this.pool.query(
      `INSERT INTO yira_utilisateur (id, telephone, country_code, role, niveau_acces, actif, updated_at)
       VALUES ($1, $2, $3, 'BENEFICIAIRE', 'FREE', true, NOW())`,
      [id, telephone, country_code]
    );

    this.logger.log(`Nouvel utilisateur créé: ${telephone} [${country_code}]`);
    return { id, telephone, country_code, role: 'BENEFICIAIRE', niveau_acces: 'FREE' };
  }

  private async obtenirUtilisateur(id: string): Promise<any> {
    const res = await this.pool.query('SELECT * FROM yira_utilisateur WHERE id = $1', [id]);
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  genererTokens(user: { id: string; telephone: string; role: string; country_code: string; niveau_acces?: string }): TokenPair {
    const payload: JwtPayload = {
      sub:          user.id,
      telephone:    user.telephone,
      role:         user.role as RoleUtilisateur,
      country_code: user.country_code,
      niveau_acces: user.niveau_acces ?? 'FREE',
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