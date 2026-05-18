// =============================================================================
// YIRA V3.0 — PaymentService (Router multi-provider)
// Niveau 2 (N2) — Abstraction complète du Payment Provider
// L3 §4.3 : Multi-tenant — providers configurés dans base_core par pays
// ZÉRO HARDCODE : les providers et préfixes viennent de base_core
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrangeMoneyProvider } from './providers/orange-money.provider';
import { MtnMomoProvider } from './providers/mtn-momo.provider';
import { MockPaymentProvider, PaymentResult } from './providers/mock.provider';
import { YiraConfigService } from '../../core-config/yira-config.service';
import { Pool } from 'pg';

export { PaymentResult };

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private pool!: Pool;
  private ready = false;

  constructor(
    private config:    ConfigService,
    private om:        OrangeMoneyProvider,
    private mtn:       MtnMomoProvider,
    private mock:      MockPaymentProvider,
    private yiraConf:  YiraConfigService,
  ) {}

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_SYNC') });
      const c    = await this.pool.connect();
      c.release();
      this.ready = true;
      this.logger.log('[PAYMENT] PaymentService connecte — OM:' + this.om.isReady() + ' MTN:' + this.mtn.isReady());
    } catch (e: any) {
      this.logger.warn('[PAYMENT] Erreur init: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // DEBITER — Point d'entrée unique pour tous les modules
  // Routing depuis base_core (Zéro Hardcode multi-tenant)
  // ---------------------------------------------------------------------------
  async debiter(
    telephone: string,
    montant:   number,
    description: string,
    tenantId = 'CI',
  ): Promise<PaymentResult> {

    // Récupérer les providers du pays depuis base_core
    const cfg      = await this.yiraConf.getConfig(tenantId);
    const providers = cfg.mobile_money_providers ?? [];

    // Détecter le provider selon le numéro ET la config du pays
    const providerCode = this.detectProvider(telephone, providers);
    this.logger.log('[PAYMENT] Debit → ' + telephone + ' | ' + montant + 'F | provider: ' + providerCode + ' | tenant: ' + tenantId);

    let result: PaymentResult;

    switch (providerCode) {
      case 'OM_CI':
      case 'OM_SN':
      case 'OM_ML':
      case 'OM_BF':
      case 'OM_GN':
        result = this.om.isReady()
          ? await this.om.debiter(telephone, montant, description)
          : await this.mock.debiter(telephone, montant, description);
        break;

      case 'MOMO_CI':
      case 'MTN_SN':
      case 'MTN_GN':
        result = this.mtn.isReady()
          ? await this.mtn.debiter(telephone, montant, description)
          : await this.mock.debiter(telephone, montant, description);
        break;

      case 'WAVE_CI':
      case 'WAVE_SN':
        // Wave API — à implémenter (même architecture)
        this.logger.warn('[PAYMENT] Wave non encore integre — fallback mock');
        result = await this.mock.debiter(telephone, montant, description);
        break;

      case 'MOOV_CI':
      case 'MOOV_ML':
      case 'MOOV_BF':
        // Moov Money — à implémenter
        this.logger.warn('[PAYMENT] Moov Money non encore integre — fallback mock');
        result = await this.mock.debiter(telephone, montant, description);
        break;

      default:
        this.logger.warn('[PAYMENT] Provider inconnu — fallback mock');
        result = await this.mock.debiter(telephone, montant, description);
    }

    await this.journaliser(telephone, montant, description, result, tenantId, providerCode);
    return result;
  }

  // ---------------------------------------------------------------------------
  // DÉTECTER LE PROVIDER — Depuis base_core.mobile_money_providers
  // Zéro Hardcode : les préfixes viennent de la config du pays
  // ---------------------------------------------------------------------------
  private detectProvider(telephone: string, providers: any[]): string {
    const clean  = telephone.replace(/\D/g, '');
    const local  = clean.length > 8 ? clean.slice(-8) : clean;
    const prefix2 = local.slice(0, 2);
    const prefix3 = local.slice(0, 3);

    // Chercher dans les providers actifs du pays (triés par priorité)
    const actifs = providers
      .filter(p => p.active)
      .sort((a, b) => a.priority - b.priority);

    for (const provider of actifs) {
      const prefixes: string[] = provider.prefixes ?? [];
      if (prefixes.length === 0) continue;
      if (prefixes.some(p => prefix2 === p || prefix3 === p)) {
        return provider.code;
      }
    }

    // Fallback : premier provider actif du pays
    const premier = actifs[0];
    if (premier) {
      this.logger.warn('[PAYMENT] Prefixe ' + prefix2 + ' non reconnu → fallback ' + premier.code);
      return premier.code;
    }

    return 'MOCK';
  }

  // ---------------------------------------------------------------------------
  // WEBHOOK — Confirmation asynchrone paiement
  // ---------------------------------------------------------------------------
  async traiterWebhook(payload: any, tenantId = 'CI'): Promise<void> {
    this.logger.log('[PAYMENT] Webhook recu: ' + JSON.stringify(payload).slice(0, 100));
    const transactionId = payload.pay_token ?? payload.financialTransactionId ?? payload.transaction_id;
    const statut        = payload.status === 'SUCCESS' || payload.status === 'SUCCESSFUL' ? 'SUCCES' : 'ECHEC';

    if (transactionId) {
      try {
        await this.pool.query(`
          UPDATE yira_journal_paiement
          SET statut = $1, updated_at = NOW(), webhook_payload = $2
          WHERE transaction_id = $3 AND tenant_id = $4
        `, [statut, JSON.stringify(payload), transactionId, tenantId]);
        this.logger.log('[PAYMENT] Webhook traite → ' + transactionId + ' | ' + statut);
      } catch (e: any) {
        this.logger.error('[PAYMENT] Erreur webhook: ' + e.message);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // JOURNALISER — avec tenant_id
  // ---------------------------------------------------------------------------
  private async journaliser(
    telephone: string, montant: number, description: string,
    result: PaymentResult, tenantId: string, providerCode: string,
  ): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO yira_journal_paiement
          (id, tenant_id, telephone, montant_fcfa, description,
           provider, transaction_id, statut, created_at)
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT DO NOTHING
      `, [tenantId, telephone, montant, description,
          providerCode, result.transaction_id ?? 'N/A', result.statut]);
    } catch (e: any) {
      this.logger.warn('[PAYMENT] Erreur journal: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // STATUS — Pour YIRA-COMMAND dashboard
  // ---------------------------------------------------------------------------
  getStatus(tenantId = 'CI'): any {
    return {
      tenant_id:    tenantId,
      orange_money: this.om.isReady(),
      mtn_momo:     this.mtn.isReady(),
      wave:         false, // À implémenter
      moov:         false, // À implémenter
      mock_actif:   !this.om.isReady() && !this.mtn.isReady(),
      ready:        this.ready,
    };
  }
}