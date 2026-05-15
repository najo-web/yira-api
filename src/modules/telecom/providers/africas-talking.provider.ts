import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import AfricasTalking from 'africastalking';

export interface SmsResult {
  success:    boolean;
  provider:   string;
  messageId?: string;
  error?:     string;
  fallback:   boolean;
}

@Injectable()
export class AfricasTalkingProvider implements OnModuleInit {
  private readonly logger = new Logger(AfricasTalkingProvider.name);
  private at:      any;
  private sms:     any;
  private airtime: any;
  private readonly username: string;
  private readonly env:      string;
  private ready = false;

  constructor(private config: ConfigService) {
    this.username = config.get('AFRICASTALKING_USERNAME') ?? 'YIRA';
    this.env      = config.get('AFRICASTALKING_ENV')      ?? 'sandbox';
  }

  async onModuleInit() {
    const apiKey = this.config.get('AFRICASTALKING_API_KEY') ?? '';
    if (!apiKey || apiKey === 'TON_API_KEY_AT') {
      this.logger.warn('[AT] API Key non configuree — provider en mode mock');
      return;
    }
    try {
      this.at      = AfricasTalking({ username: this.username, apiKey });
      this.sms     = this.at.SMS;
      this.airtime = this.at.AIRTIME;
      this.ready   = true;
      this.logger.log('[AT] AfricasTalking connecte — env: ' + this.env + ' | user: ' + this.username);
    } catch (err: any) {
      this.logger.error('[AT] Erreur init: ' + err.message);
    }
  }

  private async sendSms(to: string, message: string): Promise<SmsResult> {
    if (!this.ready) {
      this.logger.warn('[AT][MOCK] SMS -> ' + to + ' | ' + message);
      return { success: true, provider: 'AT_MOCK', fallback: true };
    }
    try {
      const result    = await this.sms.send({ to: [to], message });
      const recipient = result?.SMSMessageData?.Recipients?.[0];
      const success   = recipient?.status === 'Success';
      this.logger.log('[AT] SMS -> ' + to + ' | ' + (success ? 'OK' : 'ECHEC') + ' | ' + recipient?.status);
      return {
        success,
        provider:  'AFRICASTALKING',
        messageId: recipient?.messageId,
        error:     success ? undefined : recipient?.status,
        fallback:  false,
      };
    } catch (err: any) {
      this.logger.error('[AT] SMS echec -> ' + to + ' | ' + err.message);
      return { success: false, provider: 'AFRICASTALKING', error: err.message, fallback: true };
    }
  }

  async sendOtp(telephone: string, code: string): Promise<SmsResult> {
    return this.sendSms(telephone, 'YIRA - Code: ' + code + '. Valable 10 min. Ne partagez pas.');
  }

  async sendVas(telephone: string, content: string): Promise<SmsResult> {
    return this.sendSms(telephone, content.slice(0, 160));
  }

  async sendSos(telephone: string, message: string): Promise<SmsResult> {
    const result = await this.sendSms(telephone, ('YIRA-SOS: ' + message).slice(0, 160));
    if (!result.success) this.logger.error('[AT][SOS] CRITIQUE echec SMS SOS -> ' + telephone);
    return result;
  }

  async sendStopConfirm(telephone: string, serviceCode: string): Promise<SmsResult> {
    return this.sendSms(telephone, 'YIRA: Desabonnement ' + serviceCode + ' confirme. Merci!');
  }

  async sendModerationAlert(telephone: string, groupe: string, nb: number): Promise<SmsResult> {
    return this.sendSms(telephone, 'YIRA-CMD: ' + nb + ' questions ' + groupe + ' a valider avant 07h45.');
  }

  async sendAirtime(telephone: string, amount: number, currency = 'XOF'): Promise<SmsResult> {
    if (!this.ready) {
      this.logger.warn('[AT][MOCK] Airtime -> ' + telephone + ' | ' + amount + ' ' + currency);
      return { success: true, provider: 'AT_MOCK', fallback: true };
    }
    try {
      const result  = await this.airtime.send({
        recipients: [{ phoneNumber: telephone, amount: currency + ' ' + amount }],
      });
      const success = result?.responses?.[0]?.status === 'Success';
      this.logger.log('[AT] Airtime -> ' + telephone + ' | ' + amount + currency + ' | ' + (success ? 'OK' : 'ECHEC'));
      return { success, provider: 'AFRICASTALKING', fallback: false };
    } catch (err: any) {
      this.logger.error('[AT] Airtime echec -> ' + err.message);
      return { success: false, provider: 'AFRICASTALKING', error: err.message, fallback: true };
    }
  }

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

  isReady(): boolean { return this.ready; }
}