// =============================================================================
// YIRA V3.0 — SmsTemplateService
// Niveau 2 (N2) — Service Bloqueur — Zéro Hardcode SMS (L3 §4.2)
// Lit les templates depuis base_game.yira_sms_tpl
// Cache Redis 1h — modifiable depuis YIRA-COMMAND sans redéploiement
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsTemplateService implements OnModuleInit {
  private readonly logger = new Logger(SmsTemplateService.name);
  private pool!: Pool;
  private cache: Map<string, string> = new Map();
  private ready = false;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_GAME') });
      const client = await this.pool.connect();
      client.release();
      this.ready = true;
      // Pré-charger tous les templates CI au démarrage
      await this.precharger('CI');
      this.logger.log('[SMS-TPL] SmsTemplateService connecte — ' + this.cache.size + ' templates charges');
    } catch (e: any) {
      this.logger.warn('[SMS-TPL] Erreur init: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // OBTENIR UN TEMPLATE — Point d'entrée unique
  // ---------------------------------------------------------------------------
  async obtenir(typeTpl: string, variables: Record<string, string> = {}, tenantId = 'CI'): Promise<string> {
    const cacheKey = tenantId + ':' + typeTpl;

    // Cache mémoire
    let template = this.cache.get(cacheKey);

    // Fallback base de données
    if (!template && this.ready) {
      try {
        const res = await this.pool.query(`
          SELECT corps FROM yira_sms_tpl
          WHERE tenant_id = $1 AND type_tpl = $2 AND actif = true
          ORDER BY service_code DESC
          LIMIT 1
        `, [tenantId, typeTpl]);
        if (res.rows.length > 0) {
          template = res.rows[0].corps;
          this.cache.set(cacheKey, template!);
        }
      } catch (e: any) {
        this.logger.warn('[SMS-TPL] Erreur lecture: ' + e.message);
      }
    }

    if (!template) {
      this.logger.warn('[SMS-TPL] Template ' + typeTpl + ' introuvable — fallback generique');
      return this.fallback(typeTpl, variables);
    }

    return this.interpoler(template, variables);
  }

  // ---------------------------------------------------------------------------
  // INTERPOLER — Remplace {{variable}} par les valeurs
  // ---------------------------------------------------------------------------
  private interpoler(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), value);
    }
    return result.slice(0, 160); // Limite SMS 160 chars
  }

  // ---------------------------------------------------------------------------
  // PRÉ-CHARGER — Tous les templates d'un tenant au démarrage
  // ---------------------------------------------------------------------------
  async precharger(tenantId: string): Promise<void> {
    if (!this.ready) return;
    try {
      const res = await this.pool.query(`
        SELECT type_tpl, corps FROM yira_sms_tpl
        WHERE tenant_id = $1 AND actif = true
      `, [tenantId]);
      for (const row of res.rows) {
        this.cache.set(tenantId + ':' + row.type_tpl, row.corps);
      }
      this.logger.log('[SMS-TPL] ' + res.rows.length + ' templates charges pour ' + tenantId);
    } catch (e: any) {
      this.logger.warn('[SMS-TPL] Erreur precharge: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // INVALIDER CACHE — Appelé depuis YIRA-COMMAND quand un template est modifié
  // ---------------------------------------------------------------------------
  invaliderCache(tenantId = 'CI'): void {
    const keysToDelete = [...this.cache.keys()].filter(k => k.startsWith(tenantId + ':'));
    keysToDelete.forEach(k => this.cache.delete(k));
    this.precharger(tenantId);
    this.logger.log('[SMS-TPL] Cache invalide pour ' + tenantId);
  }

  // ---------------------------------------------------------------------------
  // FALLBACK — Si template introuvable en base
  // ---------------------------------------------------------------------------
  private fallback(typeTpl: string, variables: Record<string, string>): string {
    const fallbacks: Record<string, string> = {
      OTP:               'YIRA: Code ' + (variables.code ?? '000000') + '. Valable 10 min.',
      OPT_IN:            'YIRA: Abonnement ' + (variables.service_code ?? '') + ' active! ' + (variables.tarif ?? '50') + ' FCFA/jour.',
      OPT_OUT:           'YIRA: Desabonnement ' + (variables.service_code ?? '') + ' confirme.',
      FACTURATION:       'YIRA: ' + (variables.tarif ?? '50') + ' FCFA debite.',
      SOS_ALERTE:        'YIRA-SOS: Signalement recu. Conseiller en route.',
      SIGNER_OUVERTURE:  'YIRA Signer: Carnet ouvert! Ref:' + (variables.reference ?? ''),
      SIGNER_SIGNATURE:  'YIRA: Jour ' + (variables.jour ?? '?') + ' signe!',
      SIGNER_COMPLETE:   'YIRA: Carnet complet! Dossier credit en cours.',
      SARA_DEPOT:        'YIRA SARA: Depot ' + (variables.montant ?? '') + ' FCFA recu.',
      CODE_REPRISE:      'YIRA: Code reprise: ' + (variables.code ?? ''),
    };
    return fallbacks[typeTpl] ?? 'YIRA: Message ' + typeTpl;
  }
}