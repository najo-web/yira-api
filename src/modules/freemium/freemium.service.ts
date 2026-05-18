// =============================================================================
// YIRA V3.0 — FreemiumService
// Sprint 36 — Compteur sessions gratuites + Consentement parental
// L2 §5.2 : 3 sessions gratuites/semaine par service
// L3 §4.1 : Consentement parental obligatoire si mineur < 18 ans
// =============================================================================
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { TelecomService } from '../telecom/telecom.service';
import { YiraConfigService } from '../../core-config/yira-config.service';

export type NiveauAcces = 'FREE' | 'BASIC' | 'PREMIUM';

export interface FiltreFreemium {
  afficher_salaires:     boolean;
  afficher_pii_complet:  boolean;
  afficher_acteurs_ci:   boolean;
  afficher_pdf:          boolean;
  afficher_sara:         boolean;
  message_upgrade?:      string;
}

export interface StatutFreemium {
  telephone:        string;
  service_code:     string;
  nb_sessions:      number;
  max_sessions:     number;
  sessions_restantes: number;
  peut_acceder:     boolean;
  message:          string;
}

@Injectable()
export class FreemiumService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FreemiumService.name);
  private pool!: Pool;
  private syncReady = false;

  constructor(
    private config:    ConfigService,
    private telecom:   TelecomService,
    private yiraConf:  YiraConfigService,
  ) {}

  async onModuleInit() {
    const url = this.config.get<string>('DATABASE_URL_SYNC');
    if (!url) { this.logger.warn('[FREEMIUM] DATABASE_URL_SYNC non definie'); return; }
    try {
      this.pool      = new Pool({ connectionString: url });
      const c        = await this.pool.connect();
      c.release();
      this.syncReady = true;
      this.logger.log('[FREEMIUM] FreemiumService connecte a base_sync');
    } catch (e: any) {
      this.logger.warn('[FREEMIUM] Erreur init: ' + e.message);
    }
  }

  async onModuleDestroy() {
    if (this.pool) await this.pool.end().catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // VÉRIFIER ET INCRÉMENTER SESSION FREEMIUM
  // L2 §5.2 : 3 sessions gratuites/semaine
  // ---------------------------------------------------------------------------
  async verifierEtIncrementer(
    telephone:   string,
    serviceCode: string,
    tenantId = 'CI',
  ): Promise<StatutFreemium> {
    const cfg         = await this.yiraConf.getConfig(tenantId);
    const maxSessions = (cfg as any)?.freemium_max_sessions ?? 3;
    const semaine     = this.getSemaineCode();

    if (!this.syncReady) {
      // Mode dégradé — autoriser l'accès
      return { telephone, service_code: serviceCode, nb_sessions: 0, max_sessions: maxSessions, sessions_restantes: maxSessions, peut_acceder: true, message: 'Mode degrade — acces autorise' };
    }

    try {
      // Upsert compteur session
      const res = await this.pool.query(`
        INSERT INTO yira_freemium_session
          (tenant_id, telephone, service_code, semaine, nb_sessions, updated_at)
        VALUES ($1, $2, $3, $4, 1, NOW())
        ON CONFLICT (tenant_id, telephone, service_code, semaine)
        DO UPDATE SET nb_sessions = yira_freemium_session.nb_sessions + 1, updated_at = NOW()
        RETURNING nb_sessions
      `, [tenantId, telephone, serviceCode, semaine]);

      const nbSessions        = res.rows[0]?.nb_sessions ?? 1;
      const sessionsRestantes = Math.max(0, maxSessions - nbSessions);
      const peutAcceder       = nbSessions <= maxSessions;

      let message = '';
      if (peutAcceder) {
        message = sessionsRestantes > 0
          ? 'Session ' + nbSessions + '/' + maxSessions + ' — ' + sessionsRestantes + ' session(s) restante(s) cette semaine'
          : 'Derniere session gratuite cette semaine';
      } else {
        message = 'Sessions gratuites epuisees. Abonnez-vous pour continuer (50 FCFA/jour).';
      }

      this.logger.log('[FREEMIUM] ' + telephone + ' | ' + serviceCode + ' | session ' + nbSessions + '/' + maxSessions);

      return { telephone, service_code: serviceCode, nb_sessions: nbSessions, max_sessions: maxSessions, sessions_restantes: sessionsRestantes, peut_acceder: peutAcceder, message };
    } catch (e: any) {
      this.logger.warn('[FREEMIUM] Erreur compteur: ' + e.message);
      return { telephone, service_code: serviceCode, nb_sessions: 0, max_sessions: maxSessions, sessions_restantes: maxSessions, peut_acceder: true, message: 'Erreur compteur — acces autorise' };
    }
  }

  // ---------------------------------------------------------------------------
  // VÉRIFIER SEULEMENT (sans incrémenter)
  // ---------------------------------------------------------------------------
  async verifierStatut(telephone: string, serviceCode: string, tenantId = 'CI'): Promise<StatutFreemium> {
    const cfg         = await this.yiraConf.getConfig(tenantId);
    const maxSessions = (cfg as any)?.freemium_max_sessions ?? 3;
    const semaine     = this.getSemaineCode();

    if (!this.syncReady) {
      return { telephone, service_code: serviceCode, nb_sessions: 0, max_sessions: maxSessions, sessions_restantes: maxSessions, peut_acceder: true, message: 'Mode degrade' };
    }

    try {
      const res = await this.pool.query(
        'SELECT nb_sessions FROM yira_freemium_session WHERE tenant_id=$1 AND telephone=$2 AND service_code=$3 AND semaine=$4',
        [tenantId, telephone, serviceCode, semaine]
      );
      const nbSessions        = res.rows[0]?.nb_sessions ?? 0;
      const sessionsRestantes = Math.max(0, maxSessions - nbSessions);
      const peutAcceder       = nbSessions < maxSessions;
      return { telephone, service_code: serviceCode, nb_sessions: nbSessions, max_sessions: maxSessions, sessions_restantes: sessionsRestantes, peut_acceder: peutAcceder, message: peutAcceder ? sessionsRestantes + ' session(s) restante(s)' : 'Sessions epuisees' };
    } catch (e: any) {
      this.logger.warn('[FREEMIUM] Erreur statut: ' + e.message);
      return { telephone, service_code: serviceCode, nb_sessions: 0, max_sessions: maxSessions, sessions_restantes: maxSessions, peut_acceder: true, message: 'Erreur' };
    }
  }

  // ---------------------------------------------------------------------------
  // CONSENTEMENT PARENTAL — Envoyer OTP au parent
  // L3 §4.1 : OTP envoyé au numéro du parent ou tuteur légal
  // ---------------------------------------------------------------------------
  async demanderConsentementParental(
    telephoneMineur: string,
    telephoneParent: string,
    tenantId = 'CI',
  ): Promise<{ success: boolean; message: string }> {
    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expireAt  = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    try {
      // Stocker le consentement en attente
      await this.pool.query(`
        INSERT INTO yira_consentement_parental
          (tenant_id, telephone_mineur, telephone_parent, otp_code, statut, expire_at)
        VALUES ($1, $2, $3, $4, 'EN_ATTENTE', $5)
        ON CONFLICT (tenant_id, telephone_mineur)
        DO UPDATE SET otp_code=$4, statut='EN_ATTENTE', expire_at=$5, valide_at=NULL
      `, [tenantId, telephoneMineur, telephoneParent, otp, expireAt]);

      // Envoyer OTP au parent
      const sms = 'YIRA: Votre enfant (' + telephoneMineur + ') souhaite acceder aux services YIRA. Code autorisation: ' + otp + '. Valable 30 min. Repondez YIRA OTP ' + otp + ' pour autoriser.';
      await this.telecom.sendOtp(telephoneParent, otp, tenantId);

      this.logger.log('[FREEMIUM] Consentement parental envoye → ' + telephoneParent + ' pour ' + telephoneMineur);
      return { success: true, message: 'OTP envoye au parent ' + telephoneParent };
    } catch (e: any) {
      this.logger.error('[FREEMIUM] Erreur consentement: ' + e.message);
      return { success: false, message: 'Erreur envoi consentement: ' + e.message };
    }
  }

  // ---------------------------------------------------------------------------
  // VALIDER CONSENTEMENT PARENTAL — Vérifier OTP
  // ---------------------------------------------------------------------------
  async validerConsentementParental(
    telephoneMineur: string,
    otp:             string,
    tenantId = 'CI',
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.pool.query(`
        SELECT * FROM yira_consentement_parental
        WHERE tenant_id=$1 AND telephone_mineur=$2
          AND statut='EN_ATTENTE' AND expire_at > NOW()
      `, [tenantId, telephoneMineur]);

      if (res.rows.length === 0) {
        return { success: false, message: 'Aucun consentement en attente ou expire' };
      }

      const consentement = res.rows[0];
      if (consentement.otp_code !== otp) {
        return { success: false, message: 'Code OTP incorrect' };
      }

      // Valider
      await this.pool.query(
        "UPDATE yira_consentement_parental SET statut='VALIDE', valide_at=NOW() WHERE tenant_id=$1 AND telephone_mineur=$2",
        [tenantId, telephoneMineur]
      );

      this.logger.log('[FREEMIUM] Consentement parental valide pour ' + telephoneMineur);
      return { success: true, message: 'Consentement parental valide — acces autorise' };
    } catch (e: any) {
      this.logger.error('[FREEMIUM] Erreur validation consentement: ' + e.message);
      return { success: false, message: 'Erreur validation: ' + e.message };
    }
  }

  // ---------------------------------------------------------------------------
  // VÉRIFIER SI CONSENTEMENT PARENTAL VALIDE
  // ---------------------------------------------------------------------------
  async estConsentementValide(telephoneMineur: string, tenantId = 'CI'): Promise<boolean> {
    try {
      const res = await this.pool.query(
        "SELECT id FROM yira_consentement_parental WHERE tenant_id=$1 AND telephone_mineur=$2 AND statut='VALIDE'",
        [tenantId, telephoneMineur]
      );
      return res.rows.length > 0;
    } catch { return false; }
  }

  // ---------------------------------------------------------------------------
  // FILTRE FREEMIUM (méthode existante conservée)
  // ---------------------------------------------------------------------------
  async obtenirFiltre(country_code: string, niveau: NiveauAcces): Promise<FiltreFreemium> {
    if (niveau === 'PREMIUM') return this.filtreComplet();
    if (niveau === 'BASIC') return {
      afficher_salaires:    true,
      afficher_pii_complet: false,
      afficher_acteurs_ci:  true,
      afficher_pdf:         false,
      afficher_sara:        true,
      message_upgrade:      'Passez PREMIUM pour acceder aux PDF et profils complets',
    };
    return {
      afficher_salaires:    false,
      afficher_pii_complet: false,
      afficher_acteurs_ci:  false,
      afficher_pdf:         false,
      afficher_sara:        false,
      message_upgrade:      'Abonnez-vous pour acceder a toutes les fonctionnalites YIRA',
    };
  }

  async estFreemiumActif(country_code: string): Promise<boolean> {
    return true;
  }

  // ---------------------------------------------------------------------------
  // UTILITAIRES
  // ---------------------------------------------------------------------------
  private filtreComplet(): FiltreFreemium {
    return { afficher_salaires: true, afficher_pii_complet: true, afficher_acteurs_ci: true, afficher_pdf: true, afficher_sara: true };
  }

  private getSemaineCode(): string {
    const now     = new Date();
    const debut   = new Date(now.getFullYear(), 0, 1);
    const semaine = Math.ceil(((now.getTime() - debut.getTime()) / 86400000 + debut.getDay() + 1) / 7);
    return now.getFullYear() + '-S' + String(semaine).padStart(2, '0');
  }
}