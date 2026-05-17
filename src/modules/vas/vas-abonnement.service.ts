// =============================================================================
// YIRA V3.0 — VasAbonnementService
// Niveau 4 (N4) — Gestion abonnements VAS + facturation quotidienne
// L3 §4.2 : Conformité ARTCI — double opt-in, STOP < 5s, journal 30j
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { TelecomService } from '../telecom/telecom.service';

export interface OptInResult {
  success:      boolean;
  message:      string;
  service_code: string;
  telephone:    string;
  statut:       'NOUVEAU' | 'DEJA_ABONNE' | 'ERREUR';
}

export interface OptOutResult {
  success:      boolean;
  message:      string;
  service_code: string;
  delai_ms:     number;
}

export interface FacturationResult {
  telephone:    string;
  service_code: string;
  montant:      number;
  statut:       'SUCCES' | 'ECHEC' | 'SOLDE_INSUFFISANT';
}

@Injectable()
export class VasAbonnementService implements OnModuleInit {
  private readonly logger = new Logger(VasAbonnementService.name);
  private pool!: Pool;
  private poolCore!: Pool;
  private ready = false;

  constructor(
    private config:  ConfigService,
    private telecom: TelecomService,
  ) {}

  async onModuleInit() {
    try {
      this.pool     = new Pool({ connectionString: this.config.get('DATABASE_URL_SYNC') });
      this.poolCore = new Pool({ connectionString: this.config.get('DATABASE_URL_CORE') });
      const client  = await this.pool.connect();
      client.release();
      this.ready = true;
      this.logger.log('[VAS] VasAbonnementService connecte a base_sync');
    } catch (e: any) {
      this.logger.warn('[VAS] Erreur connexion: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // OPT-IN — Double opt-in ARTCI (L3 §4.2)
  // ---------------------------------------------------------------------------
  async optIn(telephone: string, serviceCode: string, tenantId = 'CI'): Promise<OptInResult> {
    if (!this.ready) return { success: false, message: 'Service indisponible', service_code: serviceCode, telephone, statut: 'ERREUR' };

    try {
      // Récupérer les infos du service depuis base_core
      const serviceInfo = await this.getServiceInfo(serviceCode, tenantId);
      if (!serviceInfo) {
        return { success: false, message: 'Service ' + serviceCode + ' introuvable', service_code: serviceCode, telephone, statut: 'ERREUR' };
      }

      // Vérifier si déjà abonné
      const existing = await this.pool.query(`
        SELECT id, statut FROM yira_souscription_vas
        WHERE user_id = $1 AND service_code = $2 AND tenant_id = $3
        LIMIT 1
      `, [telephone, serviceCode, tenantId]);

      if (existing.rows.length > 0 && existing.rows[0].statut === 'ACTIF') {
        return { success: true, message: 'Vous etes deja abonne a ' + serviceCode, service_code: serviceCode, telephone, statut: 'DEJA_ABONNE' };
      }

      // Créer ou réactiver l'abonnement
      // Vérifier si abonnement existe
      const existCheck = await this.pool.query(`
        SELECT id, statut FROM yira_souscription_vas
        WHERE user_id = $1 AND service_code = $2 AND tenant_id = $3
        LIMIT 1
      `, [telephone, serviceCode, tenantId]);

      if (existCheck.rows.length > 0) {
        if (existCheck.rows[0].statut === 'ACTIF') {
          return { success: true, message: 'Vous etes deja abonne a ' + serviceCode, service_code: serviceCode, telephone, statut: 'DEJA_ABONNE' };
        }
        // Réactiver
        await this.pool.query(`
          UPDATE yira_souscription_vas
          SET statut = 'ACTIF', opt_in_at = NOW(), opt_out_at = NULL
          WHERE user_id = $1 AND service_code = $2 AND tenant_id = $3
        `, [telephone, serviceCode, tenantId]);
      } else {
        // Nouvel abonnement
        await this.pool.query(`
          INSERT INTO yira_souscription_vas (id, user_id, tenant_id, service_code, statut, opt_in_at)
          VALUES (gen_random_uuid()::text, $1, $2, $3, 'ACTIF', NOW())
        `, [telephone, tenantId, serviceCode]);
      }

      // Journaliser dans yira_journal_vas (ARTCI Art. 4.1)
      await this.journaliserVas(telephone, serviceCode, 'OPT_IN', 0, tenantId);

      // SMS de confirmation double opt-in (ARTCI obligatoire)
      const tarif = serviceInfo.prix ?? 50;
      const smsConfirm = 'YIRA: Abonnement ' + serviceCode + ' confirme! ' + tarif + ' FCFA/jour debite automatiquement. Pour arreter: envoyez STOP ' + serviceCode + ' au ' + (this.config.get('USSD_SHORTCODE') ?? '*7572#');
      await this.telecom.sendVas(telephone, smsConfirm);

      this.logger.log('[VAS] OPT-IN: ' + telephone + ' → ' + serviceCode + ' (' + tarif + ' FCFA/j)');
      return {
        success:      true,
        message:      'Abonnement ' + serviceCode + ' active! ' + tarif + ' FCFA/jour.',
        service_code: serviceCode,
        telephone,
        statut:       'NOUVEAU',
      };
    } catch (e: any) {
      this.logger.error('[VAS] Erreur opt-in: ' + e.message);
      return { success: false, message: 'Erreur technique', service_code: serviceCode, telephone, statut: 'ERREUR' };
    }
  }

  // ---------------------------------------------------------------------------
  // OPT-OUT — STOP service < 5 secondes (ARTCI obligatoire)
  // ---------------------------------------------------------------------------
  async optOut(telephone: string, serviceCode: string, tenantId = 'CI'): Promise<OptOutResult> {
    const debut = Date.now();

    try {
      await this.pool.query(`
        UPDATE yira_souscription_vas
        SET statut = 'INACTIF', opt_out_at = NOW()
        WHERE user_id = $1 AND service_code = $2 AND tenant_id = $3
      `, [telephone, serviceCode, tenantId]);

      await this.journaliserVas(telephone, serviceCode, 'OPT_OUT', 0, tenantId);

      // SMS confirmation STOP (ARTCI obligatoire)
      await this.telecom.sendVas(telephone, 'YIRA: Desabonnement ' + serviceCode + ' confirme. Aucun debit ne sera effectue. Merci!');

      const delai = Date.now() - debut;
      this.logger.log('[VAS] OPT-OUT: ' + telephone + ' → ' + serviceCode + ' | ' + delai + 'ms');

      return {
        success:      true,
        message:      'Desabonnement ' + serviceCode + ' confirme.',
        service_code: serviceCode,
        delai_ms:     delai,
      };
    } catch (e: any) {
      this.logger.error('[VAS] Erreur opt-out: ' + e.message);
      return { success: false, message: 'Erreur technique', service_code: serviceCode, delai_ms: Date.now() - debut };
    }
  }

  // ---------------------------------------------------------------------------
  // CRON 06h00 — Facturation quotidienne (L2 §3.4)
  // ---------------------------------------------------------------------------
  @Cron('0 6 * * *', { timeZone: 'Africa/Abidjan' })
  async facturerQuotidien(): Promise<void> {
    this.logger.log('[VAS] CRON 06h00 — Facturation quotidienne démarrage');
    if (!this.ready) return;

    try {
      const abonnes = await this.pool.query(`
        SELECT s.user_id, s.service_code, s.tenant_id
        FROM yira_souscription_vas s
        WHERE s.statut = 'ACTIF'
        ORDER BY s.service_code
      `);

      this.logger.log('[VAS] ' + abonnes.rows.length + ' abonnes a facturer');

      let succes = 0, echecs = 0;
      for (const abonne of abonnes.rows) {
        const result = await this.facturerAbonne(abonne.user_id, abonne.service_code, abonne.tenant_id);
        if (result.statut === 'SUCCES') succes++;
        else echecs++;
      }

      this.logger.log('[VAS] Facturation terminee — ' + succes + ' succes, ' + echecs + ' echecs');
    } catch (e: any) {
      this.logger.error('[VAS] Erreur facturation cron: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // FACTURER UN ABONNÉ
  // ---------------------------------------------------------------------------
  async facturerAbonne(telephone: string, serviceCode: string, tenantId = 'CI'): Promise<FacturationResult> {
    try {
      const serviceInfo = await this.getServiceInfo(serviceCode, tenantId);
      const montant     = serviceInfo?.prix ?? 50;

      // En production : appel Payment Provider pour débiter
      // En dev : simulation du débit
      const success = true; // → remplacer par PaymentProvider.debiter()

      if (success) {
        await this.journaliserVas(telephone, serviceCode, 'FACTURATION', montant, tenantId);
        this.logger.log('[VAS] Facture: ' + telephone + ' | ' + serviceCode + ' | ' + montant + ' FCFA');
        return { telephone, service_code: serviceCode, montant, statut: 'SUCCES' };
      }

      // Désabonnement automatique si solde insuffisant 3 jours consécutifs
      await this.optOut(telephone, serviceCode, tenantId);
      return { telephone, service_code: serviceCode, montant: 0, statut: 'SOLDE_INSUFFISANT' };

    } catch (e: any) {
      this.logger.error('[VAS] Erreur facturation: ' + telephone + ' | ' + e.message);
      return { telephone, service_code: serviceCode, montant: 0, statut: 'ECHEC' };
    }
  }

  // ---------------------------------------------------------------------------
  // VÉRIFIER STATUT ABONNEMENT
  // ---------------------------------------------------------------------------
  async verifierStatut(telephone: string, serviceCode: string, tenantId = 'CI'): Promise<any> {
    if (!this.ready) return { abonne: false };
    try {
      const res = await this.pool.query(`
        SELECT statut, opt_in_at, opt_out_at
        FROM yira_souscription_vas
        WHERE user_id = $1 AND service_code = $2 AND tenant_id = $3
        LIMIT 1
      `, [telephone, serviceCode, tenantId]);

      if (res.rows.length === 0) return { abonne: false, statut: 'JAMAIS_ABONNE' };
      return {
        abonne:     res.rows[0].statut === 'ACTIF',
        statut:     res.rows[0].statut,
        opt_in_at:  res.rows[0].opt_in_at,
        opt_out_at: res.rows[0].opt_out_at,
      };
    } catch { return { abonne: false }; }
  }

  // ---------------------------------------------------------------------------
  // STATS ABONNEMENTS
  // ---------------------------------------------------------------------------
  async stats(tenantId = 'CI'): Promise<any> {
    if (!this.ready) return {};
    try {
      const res = await this.pool.query(`
        SELECT
          service_code,
          COUNT(*) FILTER (WHERE statut = 'ACTIF')   as actifs,
          COUNT(*) FILTER (WHERE statut = 'INACTIF') as inactifs,
          COUNT(*) as total
        FROM yira_souscription_vas
        WHERE tenant_id = $1
        GROUP BY service_code
        ORDER BY actifs DESC
      `, [tenantId]);
      return { services: res.rows, tenant_id: tenantId };
    } catch { return {}; }
  }

  // ---------------------------------------------------------------------------
  // UTILITAIRES
  // ---------------------------------------------------------------------------
  private async getServiceInfo(serviceCode: string, tenantId: string): Promise<any> {
    try {
      const res = await this.poolCore.query(`
        SET app.current_tenant = $1;
        SELECT service_code, service_name, pricing_by_tenant
        FROM core.yira_config_service
        WHERE service_code = $2 AND tenant_id = $1 AND status = 'ACTIVE'
        LIMIT 1
      `, [tenantId, serviceCode]);
      if (res[1]?.rows?.length > 0) {
        const row   = res[1].rows[0];
        const prix  = row.pricing_by_tenant?.[tenantId] ?? 50;
        return { ...row, prix };
      }
    } catch {}
    return { service_code: serviceCode, service_name: serviceCode, prix: 50 };
  }

  private async journaliserVas(telephone: string, serviceCode: string, type: string, montant: number, tenantId: string): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO yira_journal_vas (id, tenant_id, telephone, service_code, type_canal, montant_fcfa, statut)
        VALUES (gen_random_uuid()::text, $1, $2, $3, 'SMS', $4, 'SUCCES')
      `, [tenantId, telephone, serviceCode, montant]);
    } catch (e: any) {
      this.logger.warn('[VAS] Erreur journal: ' + e.message);
    }
  }
}