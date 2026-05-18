// =============================================================================
// YIRA V3.0 — OrangeMoneyProvider
// Niveau 2 (N2) — Orange Money Côte d'Ivoire
// API Orange Money CI — Débit VAS quotidien
// Doc : developer.orange.com/apis/om-webpay-ci
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentResult } from './mock.provider';

@Injectable()
export class OrangeMoneyProvider implements OnModuleInit {
  private readonly logger    = new Logger(OrangeMoneyProvider.name);
  private readonly clientId:  string;
  private readonly clientSecret: string;
  private readonly merchantKey: string;
  private readonly apiUrl:    string;
  private accessToken:        string = '';
  private tokenExpiry:        number = 0;
  private ready = false;

  constructor(private config: ConfigService) {
    this.clientId     = config.get('OM_CLIENT_ID')     ?? '';
    this.clientSecret = config.get('OM_CLIENT_SECRET') ?? '';
    this.merchantKey  = config.get('OM_MERCHANT_KEY')  ?? '';
    this.apiUrl       = config.get('OM_API_URL')       ?? 'https://api.orange.com/orange-money-webpay/ci/v1';
  }

  async onModuleInit() {
    if (!this.clientId || this.clientId === 'A_CONFIGURER') {
      this.logger.warn('[OM-CI] Credentials non configures — provider desactive');
      return;
    }
    try {
      await this.refreshToken();
      this.ready = true;
      this.logger.log('[OM-CI] OrangeMoneyProvider connecte');
    } catch (e: any) {
      this.logger.warn('[OM-CI] Erreur init: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // DEBITER — Prélèvement VAS quotidien
  // ---------------------------------------------------------------------------
  async debiter(telephone: string, montant: number, description: string): Promise<PaymentResult> {
    if (!this.ready) return this.mockResult(telephone, montant);

    try {
      await this.ensureToken();
      const body = {
        merchant_key:  this.merchantKey,
        currency:      'XOF',
        order_id:      'YIRA-' + Date.now(),
        amount:        montant,
        return_url:    'https://yira.africa/payment/callback',
        cancel_url:    'https://yira.africa/payment/cancel',
        notif_url:     'https://yira.africa/api/webhooks/payment',
        lang:          'fr',
        reference:     description,
      };

      const response = await fetch(this.apiUrl + '/webpayment', {
        method:  'POST',
        headers: {
          'Authorization': 'Bearer ' + this.accessToken,
          'Content-Type':  'application/json',
          'Accept':        'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      this.logger.log('[OM-CI] Debit → ' + telephone + ' | ' + montant + 'F | ' + (data.status ?? 'N/A'));

      const success = data.status === 'SUCCESS' || data.message === 'SUCCESS';
      return {
        success,
        provider:       'ORANGE_MONEY_CI',
        transaction_id: data.pay_token ?? data.notif_token,
        montant,
        telephone,
        statut:         success ? 'SUCCES' : 'ECHEC',
        error:          success ? undefined : data.message,
        timestamp:      new Date().toISOString(),
      };
    } catch (e: any) {
      this.logger.error('[OM-CI] Erreur debit: ' + e.message);
      return { success: false, provider: 'ORANGE_MONEY_CI', montant, telephone, statut: 'ECHEC', error: e.message, timestamp: new Date().toISOString() };
    }
  }

  // ---------------------------------------------------------------------------
  // TOKEN OAuth2
  // ---------------------------------------------------------------------------
  private async refreshToken(): Promise<void> {
    const credentials = Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64');
    const response    = await fetch('https://api.orange.com/oauth/v3/token', {
      method:  'POST',
      headers: { 'Authorization': 'Basic ' + credentials, 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    'grant_type=client_credentials',
    });
    const data = await response.json();
    if (!data.access_token) throw new Error('Token OM invalide');
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  }

  private async ensureToken(): Promise<void> {
    if (Date.now() >= this.tokenExpiry) await this.refreshToken();
  }

  private mockResult(telephone: string, montant: number): PaymentResult {
    this.logger.warn('[OM-CI][MOCK] Credentials manquants — simulation');
    return { success: true, provider: 'OM_MOCK', transaction_id: 'OM-MOCK-' + Date.now(), montant, telephone, statut: 'SUCCES', timestamp: new Date().toISOString() };
  }

  isReady(): boolean { return this.ready; }
}