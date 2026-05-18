// =============================================================================
// YIRA V3.0 — MtnMomoProvider
// Niveau 2 (N2) — MTN Mobile Money Côte d'Ivoire
// API MTN MoMo — Débit VAS quotidien
// Doc : momodeveloper.mtn.com
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentResult } from './mock.provider';

@Injectable()
export class MtnMomoProvider implements OnModuleInit {
  private readonly logger       = new Logger(MtnMomoProvider.name);
  private readonly subscriptionKey: string;
  private readonly apiUser:     string;
  private readonly apiKey:      string;
  private readonly apiUrl:      string;
  private readonly targetEnv:   string;
  private accessToken:          string = '';
  private tokenExpiry:          number = 0;
  private ready = false;

  constructor(private config: ConfigService) {
    this.subscriptionKey = config.get('MTN_SUBSCRIPTION_KEY') ?? '';
    this.apiUser         = config.get('MTN_API_USER')         ?? '';
    this.apiKey          = config.get('MTN_API_KEY')          ?? '';
    this.apiUrl          = config.get('MTN_API_URL')          ?? 'https://proxy.momoapi.mtn.com';
    this.targetEnv       = config.get('MTN_TARGET_ENV')       ?? 'mtncotedivoire';
  }

  async onModuleInit() {
    if (!this.subscriptionKey || this.subscriptionKey === 'A_CONFIGURER') {
      this.logger.warn('[MTN-CI] Credentials non configures — provider desactive');
      return;
    }
    try {
      await this.refreshToken();
      this.ready = true;
      this.logger.log('[MTN-CI] MtnMomoProvider connecte');
    } catch (e: any) {
      this.logger.warn('[MTN-CI] Erreur init: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // DEBITER — Prélèvement VAS quotidien (RequestToDebit)
  // ---------------------------------------------------------------------------
  async debiter(telephone: string, montant: number, description: string): Promise<PaymentResult> {
    if (!this.ready) return this.mockResult(telephone, montant);

    try {
      await this.ensureToken();
      const referenceId = crypto.randomUUID();
      const body = {
        amount:       String(montant),
        currency:     'XOF',
        externalId:   'YIRA-' + Date.now(),
        payer:        { partyIdType: 'MSISDN', partyId: telephone.replace('+', '') },
        payerMessage: description,
        payeeNote:    'YIRA VAS ' + new Date().toISOString().split('T')[0],
      };

      await fetch(this.apiUrl + '/collection/v1_0/requesttodebit', {
        method:  'POST',
        headers: {
          'Authorization':              'Bearer ' + this.accessToken,
          'X-Reference-Id':             referenceId,
          'X-Target-Environment':       this.targetEnv,
          'Ocp-Apim-Subscription-Key':  this.subscriptionKey,
          'Content-Type':               'application/json',
        },
        body: JSON.stringify(body),
      });

      // Vérification statut après 3s
      await new Promise(r => setTimeout(r, 3000));
      const statusRes  = await fetch(this.apiUrl + '/collection/v1_0/requesttodebit/' + referenceId, {
        headers: {
          'Authorization':             'Bearer ' + this.accessToken,
          'X-Target-Environment':      this.targetEnv,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        },
      });
      const statusData = await statusRes.json();
      const success    = statusData.status === 'SUCCESSFUL';

      this.logger.log('[MTN-CI] Debit → ' + telephone + ' | ' + montant + 'F | ' + statusData.status);
      return {
        success,
        provider:       'MTN_MOMO_CI',
        transaction_id: referenceId,
        montant,
        telephone,
        statut:         success ? 'SUCCES' : statusData.status === 'FAILED' ? 'ECHEC' : 'PENDING',
        error:          success ? undefined : statusData.reason,
        timestamp:      new Date().toISOString(),
      };
    } catch (e: any) {
      this.logger.error('[MTN-CI] Erreur debit: ' + e.message);
      return { success: false, provider: 'MTN_MOMO_CI', montant, telephone, statut: 'ECHEC', error: e.message, timestamp: new Date().toISOString() };
    }
  }

  private async refreshToken(): Promise<void> {
    const credentials = Buffer.from(this.apiUser + ':' + this.apiKey).toString('base64');
    const response    = await fetch(this.apiUrl + '/collection/token/', {
      method:  'POST',
      headers: {
        'Authorization':             'Basic ' + credentials,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      },
    });
    const data = await response.json();
    if (!data.access_token) throw new Error('Token MTN invalide');
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  }

  private async ensureToken(): Promise<void> {
    if (Date.now() >= this.tokenExpiry) await this.refreshToken();
  }

  private mockResult(telephone: string, montant: number): PaymentResult {
    this.logger.warn('[MTN-CI][MOCK] Credentials manquants — simulation');
    return { success: true, provider: 'MTN_MOCK', transaction_id: 'MTN-MOCK-' + Date.now(), montant, telephone, statut: 'SUCCES', timestamp: new Date().toISOString() };
  }

  isReady(): boolean { return this.ready; }
}