// =============================================================================
// YIRA V3.0 — YiraConfigService (Zéro Hardcode — L3 §3.1)
// Service centralisé — lit TOUT depuis base_core.country_config
// Cache Redis 1h — un seul appel SQL par pays par heure
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export interface YiraConfig {
  tenant_id:            string;
  country_name:         string;
  ussd_short_code:      string;
  currency_code:        string;
  vas_tarif_groupe_a:   number;
  vas_tarif_groupe_a_premium: number;
  vas_tarif_groupe_b:   number;
  vas_questions_gratuites: number;
  mobile_money_providers: any[];
  signer_mise_min:          number;
  signer_mise_max:          number;
  signer_max_pauses:        number;
  signer_frais_retrait_pct: number;
  signer_jours_epargne:     number;
  credit_multiplicateur_bronze: number;
  credit_multiplicateur_argent: number;
  credit_multiplicateur_or:     number;
  sara_score_depot:         number;
  sara_score_recompense:    number;
  sara_score_quiz:          number;
  sara_score_tontine:       number;
  frais_vie_mensuel_fcfa:   number;
  salaire_median_fcfa:      number;
  artci_numero_agrement:    string;
  artci_societe_nom:        string;
  artci_revenue_share_pct:  number;
  artci_date_expiration:    string;
  artci_contact:            string;
  artci_nb_services:        number;
  trust_index_min_b2c:      number;
  trust_index_min_b2b:      number;
  trust_index_min_b2g:      number;
  cqci_min_score:           number;
}

const CACHE_TTL = 3600;

@Injectable()
export class YiraConfigService implements OnModuleInit {
  private readonly logger = new Logger(YiraConfigService.name);
  private pool!:  Pool;
  private redis!: any;
  private ready = false;
  private memCache: Map<string, { data: YiraConfig; expiry: number }> = new Map();

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    try {
      this.pool = new Pool({ connectionString: this.config.get('DATABASE_URL_CORE') });
      const client = await this.pool.connect();
      client.release();

      try {
        this.redis = createClient({ url: this.config.get('REDIS_URL') ?? 'redis://localhost:6379' });
        await this.redis.connect();
        this.logger.log('[CONFIG] Cache Redis connecte');
      } catch {
        this.logger.warn('[CONFIG] Redis non disponible — cache memoire actif');
      }

      this.ready = true;
      this.logger.log('[CONFIG] YiraConfigService connecte a base_core');
      await this.getConfig('CI');
    } catch (e: any) {
      this.logger.warn('[CONFIG] Erreur init: ' + e.message);
    }
  }

  async getConfig(tenantId = 'CI'): Promise<YiraConfig> {
    const cacheKey = 'yira:config:' + tenantId;

    const memCached = this.memCache.get(tenantId);
    if (memCached && Date.now() < memCached.expiry) return memCached.data;

    try {
      if (this.redis?.isReady) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const data = JSON.parse(cached) as YiraConfig;
          this.memCache.set(tenantId, { data, expiry: Date.now() + 300000 });
          return data;
        }
      }
    } catch {}

    const config = await this.chargerDepuisBase(tenantId);

    try {
      if (this.redis?.isReady) await this.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(config));
    } catch {}
    this.memCache.set(tenantId, { data: config, expiry: Date.now() + 300000 });

    return config;
  }

  async invaliderCache(tenantId = 'CI'): Promise<void> {
    this.memCache.delete(tenantId);
    try { if (this.redis?.isReady) await this.redis.del('yira:config:' + tenantId); } catch {}
    this.logger.log('[CONFIG] Cache invalide pour ' + tenantId);
    await this.getConfig(tenantId);
  }

  async getTarif(serviceGroup: string, tenantId = 'CI'): Promise<number> {
    const cfg = await this.getConfig(tenantId);
    if (serviceGroup === 'A_PREMIUM') return cfg.vas_tarif_groupe_a_premium;
    if (serviceGroup === 'A') return cfg.vas_tarif_groupe_a;
    if (serviceGroup === 'B') return cfg.vas_tarif_groupe_b;
    return 0;
  }

  async getArtciConfig(tenantId = 'CI'): Promise<any> {
    const cfg = await this.getConfig(tenantId);
    return {
      numero_agrement:   cfg.artci_numero_agrement,
      societe_nom:       cfg.artci_societe_nom,
      revenue_share_pct: cfg.artci_revenue_share_pct,
      date_expiration:   cfg.artci_date_expiration,
      contact:           cfg.artci_contact,
      nb_services:       cfg.artci_nb_services,
    };
  }

  async getSignerConfig(tenantId = 'CI'): Promise<any> {
    const cfg = await this.getConfig(tenantId);
    return {
      mise_min:              cfg.signer_mise_min,
      mise_max:              cfg.signer_mise_max,
      max_pauses:            cfg.signer_max_pauses,
      frais_retrait_pct:     cfg.signer_frais_retrait_pct,
      jours_epargne:         cfg.signer_jours_epargne,
      multiplicateur_bronze: cfg.credit_multiplicateur_bronze,
      multiplicateur_argent: cfg.credit_multiplicateur_argent,
      multiplicateur_or:     cfg.credit_multiplicateur_or,
    };
  }

  async getSaraScores(tenantId = 'CI'): Promise<any> {
    const cfg = await this.getConfig(tenantId);
    return {
      depot:      cfg.sara_score_depot,
      recompense: cfg.sara_score_recompense,
      quiz:       cfg.sara_score_quiz,
      tontine:    cfg.sara_score_tontine,
    };
  }

  async getShortcode(tenantId = 'CI'): Promise<string> {
    const cfg = await this.getConfig(tenantId);
    return cfg.ussd_short_code;
  }

  private async chargerDepuisBase(tenantId: string): Promise<YiraConfig> {
    try {
      const res = await this.pool.query(`
        SELECT tenant_id, country_name, ussd_short_code, currency_code,
               vas_pricing, mobile_money_providers,
               parametres_metier, artci_config, scoring_config
        FROM core.country_config
        WHERE tenant_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
        LIMIT 1
      `, [tenantId]);

      if (res.rows.length === 0) return this.getConfigDefaut(tenantId);

      const row = res.rows[0];
      const vas = row.vas_pricing        ?? {};
      const pm  = row.parametres_metier  ?? {};
      const ac  = row.artci_config       ?? {};
      const sc  = row.scoring_config     ?? {};

      const config: YiraConfig = {
        tenant_id:            row.tenant_id,
        country_name:         row.country_name,
        ussd_short_code:      row.ussd_short_code,
        currency_code:        row.currency_code,
        mobile_money_providers: row.mobile_money_providers ?? [],
        vas_tarif_groupe_a:         vas.GROUP_A_PAYANT?.default_fcfa ?? 50,
        vas_tarif_groupe_a_premium: vas.GROUP_A_PAYANT?.premium_fcfa ?? 75,
        vas_tarif_groupe_b:         vas.GROUP_B_FREEMIUM?.paid_bundle_fcfa ?? 100,
        vas_questions_gratuites:    vas.GROUP_B_FREEMIUM?.free_questions_per_day ?? 3,
        signer_mise_min:          pm.signer_mise_min ?? 500,
        signer_mise_max:          pm.signer_mise_max ?? 1000000,
        signer_max_pauses:        pm.signer_max_pauses ?? 3,
        signer_frais_retrait_pct: pm.signer_frais_retrait_pct ?? 1,
        signer_jours_epargne:     pm.signer_jours_epargne ?? 30,
        credit_multiplicateur_bronze: pm.credit_multiplicateur_bronze ?? 2,
        credit_multiplicateur_argent: pm.credit_multiplicateur_argent ?? 3,
        credit_multiplicateur_or:     pm.credit_multiplicateur_or ?? 5,
        sara_score_depot:         pm.sara_score_depot ?? 10,
        sara_score_recompense:    pm.sara_score_recompense ?? 20,
        sara_score_quiz:          pm.sara_score_quiz ?? 5,
        sara_score_tontine:       pm.sara_score_tontine ?? 25,
        frais_vie_mensuel_fcfa:   pm.frais_vie_mensuel_fcfa ?? 150000,
        salaire_median_fcfa:      pm.salaire_median_fcfa ?? 450000,
        artci_numero_agrement:   ac.numero_agrement ?? 'N/A',
        artci_societe_nom:       ac.societe_nom ?? 'Najo Technologies',
        artci_revenue_share_pct: ac.revenue_share_pct ?? 35,
        artci_date_expiration:   ac.date_expiration ?? 'N/A',
        artci_contact:           ac.contact ?? 'contact@najo.tech',
        artci_nb_services:       ac.nb_services_actifs ?? 37,
        trust_index_min_b2c: sc.trust_index_min_b2c ?? 60,
        trust_index_min_b2b: sc.trust_index_min_b2b ?? 75,
        trust_index_min_b2g: sc.trust_index_min_b2g ?? 85,
        cqci_min_score:      sc.cqci_min_score ?? 0.75,
      };

      this.logger.log('[CONFIG] Config ' + tenantId + ' chargee depuis base_core');
      return config;
    } catch (e: any) {
      this.logger.error('[CONFIG] Erreur: ' + e.message);
      return this.getConfigDefaut(tenantId);
    }
  }

  private getConfigDefaut(tenantId: string): YiraConfig {
    return {
      tenant_id: tenantId, country_name: 'Côte d\'Ivoire',
      ussd_short_code: '*7572#', currency_code: 'XOF',
      mobile_money_providers: [],
      vas_tarif_groupe_a: 50, vas_tarif_groupe_a_premium: 75,
      vas_tarif_groupe_b: 100, vas_questions_gratuites: 3,
      signer_mise_min: 500, signer_mise_max: 1000000,
      signer_max_pauses: 3, signer_frais_retrait_pct: 1,
      signer_jours_epargne: 30,
      credit_multiplicateur_bronze: 2, credit_multiplicateur_argent: 3,
      credit_multiplicateur_or: 5,
      sara_score_depot: 10, sara_score_recompense: 20,
      sara_score_quiz: 5, sara_score_tontine: 25,
      frais_vie_mensuel_fcfa: 150000, salaire_median_fcfa: 450000,
      artci_numero_agrement: '57/SVA/3/24',
      artci_societe_nom: 'IZYWORK SARL (Najo Technologies)',
      artci_revenue_share_pct: 35,
      artci_date_expiration: '2026-09-27',
      artci_contact: 'courrier@artci.ci',
      artci_nb_services: 37,
      trust_index_min_b2c: 60, trust_index_min_b2b: 75,
      trust_index_min_b2g: 85, cqci_min_score: 0.75,
    };
  }

  isReady(): boolean { return this.ready; }
}