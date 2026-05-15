// =============================================================================
// YIRA V3.0 — TelecomService (Router multi-provider)
// Niveau 2 (N2) — Abstraction complète du provider télécom
// L3 §4.2 : Commutation transparente entre providers sans modification métier
// Provider primaire  : AfricasTalking (DEV/TEST — sandbox gratuit)
// Provider secondaire: LAfricaMobile  (PROD CI)
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AfricasTalkingProvider } from './providers/africas-talking.provider';

export interface SmsResult {
  success:    boolean;
  provider:   string;
  messageId?: string;
  error?:     string;
  fallback:   boolean;
}

@Injectable()
export class TelecomService implements OnModuleInit {
  private readonly logger = new Logger(TelecomService.name);
  private readonly lamUrl:       string;
  private readonly lamAccount:   string;
  private readonly lamPassword:  string;
  private readonly lamSenderOtp: string;
  private readonly lamSenderVas: string;
  private readonly lamSenderSos: string;
  private readonly useLam:       boolean;

  constructor(
    private config: ConfigService,
    private at:     AfricasTalkingProvider,
  ) {
    this.lamUrl       = config.get('LAFRICAMOBILE_SMS_URL')     ?? '';
    this.lamAccount   = config.get('LAFRICAMOBILE_ACCOUNT_ID')  ?? '';
    this.lamPassword  = config.get('LAFRICAMOBILE_PASSWORD')    ?? '';
    this.lamSenderOtp = config.get('LAFRICAMOBILE_SENDER_OTP')  ?? 'YIRACI';
    this.lamSenderVas = config.get('LAFRICAMOBILE_SENDER_VAS')  ?? 'YIRAVAS';
    this.lamSenderSos = config.get('LAFRICAMOBILE_SENDER_SOS')  ?? 'YIRASOS';
    this.useLam       = this.lamAccount !== '' &&
                        this.lamAccount !== 'TON_LOGIN' &&
                        this.lamAccount !== 'A_CONFIGURER_EN_PROD';
  }

  async onModuleInit() {
    const provider = this.at.isReady() ? 'AfricasTalking' : this.useLam ? 'LAfricaMobile' : 'MOCK';
    this.logger.log('[TELECOM] Provider actif: ' + provider);
  }

  // ---------------------------------------------------------------------------
  // OTP
  // ---------------------------------------------------------------------------
  async sendOtp(telephone: string, code: string, pays = 'CI'): Promise<SmsResult> {
    const to = this.formatTelephone(telephone, pays);
    if (this.at.isReady()) return this.at.sendOtp(to, code);
    const text = 'YIRA - Code: ' + code + '. Valable 10 min. Ne partagez pas.';
    return this.sendLam(to, text, this.lamSenderOtp);
  }

  // ---------------------------------------------------------------------------
  // VAS push quiz
  // ---------------------------------------------------------------------------
  async sendVas(telephone: string, content: string, pays = 'CI'): Promise<SmsResult> {
    const to = this.formatTelephone(telephone, pays);
    if (this.at.isReady()) return this.at.sendVas(to, content);
    return this.sendLam(to, content.slice(0, 160), this.lamSenderVas);
  }

  // ---------------------------------------------------------------------------
  // SOS urgence
  // ---------------------------------------------------------------------------
  async sendSos(telephone: string, message: string, pays = 'CI'): Promise<SmsResult> {
    const to = this.formatTelephone(telephone, pays);
    if (this.at.isReady()) return this.at.sendSos(to, message);
    return this.sendLam(to, ('YIRA-SOS: ' + message).slice(0, 160), this.lamSenderSos);
  }

  // ---------------------------------------------------------------------------
  // STOP CONFIRM < 5s ARTCI
  // ---------------------------------------------------------------------------
  async sendStopConfirm(telephone: string, serviceCode: string, pays = 'CI'): Promise<SmsResult> {
    const to = this.formatTelephone(telephone, pays);
    if (this.at.isReady()) return this.at.sendStopConfirm(to, serviceCode);
    return this.sendLam(to, 'YIRA: Desabonnement ' + serviceCode + ' confirme. Merci!', this.lamSenderVas);
  }

  // ---------------------------------------------------------------------------
  // MODERATION ALERT 05h15
  // ---------------------------------------------------------------------------
  async sendModerationAlert(telephone: string, groupe: string, nb: number): Promise<SmsResult> {
    const to = this.formatTelephone(telephone, 'CI');
    if (this.at.isReady()) return this.at.sendModerationAlert(to, groupe, nb);
    return this.sendLam(to, 'YIRA-CMD: ' + nb + ' questions ' + groupe + ' a valider avant 07h45.', this.lamSenderOtp);
  }

  // ---------------------------------------------------------------------------
  // AIRTIME récompenses SARA
  // ---------------------------------------------------------------------------
  async sendAirtime(telephone: string, montant: number, pays = 'CI'): Promise<SmsResult> {
    const to = this.formatTelephone(telephone, pays);
    if (this.at.isReady()) return this.at.sendAirtime(to, montant);
    this.logger.warn('[TELECOM] Airtime non disponible — LAM non configure');
    return { success: false, provider: 'NONE', error: 'Provider non configure', fallback: true };
  }

  // ---------------------------------------------------------------------------
  // CHECK CREDIT
  // ---------------------------------------------------------------------------
  async checkCredit(): Promise<number> {
    if (this.at.isReady()) return 999;
    if (!this.useLam) return 0;
    try {
      const params   = new URLSearchParams({ accountid: this.lamAccount, password: this.lamPassword });
      const response = await fetch(this.lamUrl + '/credit?' + params.toString(), { method: 'GET' });
      const raw      = await response.text();
      return parseInt(raw.trim()) || 0;
    } catch { return -1; }
  }

  // ---------------------------------------------------------------------------
  // LAM fallback — GET XML
  // ---------------------------------------------------------------------------
  private async sendLam(to: string, text: string, sender: string): Promise<SmsResult> {
    if (!this.useLam) {
      this.logger.warn('[LAM][MOCK] SMS → ' + to + ' | ' + text);
      return { success: true, provider: 'MOCK', fallback: true };
    }
    try {
      const xml = '<push><message>' +
        '<accountid>' + this.lamAccount + '</accountid>' +
        '<password>' + this.lamPassword + '</password>' +
        '<sender>' + sender + '</sender>' +
        '<to>' + to + '</to>' +
        '<text>' + this.escapeXml(text) + '</text>' +
        '</message></push>';
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 5000);
      const response   = await fetch(this.lamUrl + '?xml=' + encodeURIComponent(xml), {
        method: 'GET', signal: controller.signal,
      });
      clearTimeout(timeout);
      const raw = await response.text();
      this.logger.log('[LAM] SMS → ' + to + ' | HTTP ' + response.status + ' | ' + raw);
      if (response.ok) return { success: true, provider: 'LAFRICAMOBILE', messageId: raw, fallback: false };
      return { success: false, provider: 'LAFRICAMOBILE', error: raw, fallback: false };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      this.logger.error('[LAM] Echec → ' + to + ' | ' + (isTimeout ? 'TIMEOUT' : err.message));
      return { success: false, provider: 'LAFRICAMOBILE', error: isTimeout ? 'TIMEOUT' : err.message, fallback: true };
    }
  }

  // ---------------------------------------------------------------------------
  // FORMAT TELEPHONE
  // ---------------------------------------------------------------------------
  formatTelephone(telephone: string, pays = 'CI'): string {
  if (telephone.startsWith('+')) return telephone;
  if (telephone.startsWith('00')) return '+' + telephone.slice(2);
  const clean = telephone.replace(/\s/g, '');
  const prefixes: Record<string, string> = {
    CI: '+225', SN: '+221', BF: '+226',
    ML: '+223', GN: '+224', TG: '+228',
  };
  const prefix = prefixes[pays] ?? '+225';
  if (pays === 'CI') return prefix + clean;
  return prefix + clean.replace(/^0+/, '');
}
private escapeXml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
               .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
}