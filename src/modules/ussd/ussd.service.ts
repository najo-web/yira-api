// =============================================================================
// YIRA V3.0 — UssdService
// Niveau 4 (N4) — Moteur USSD + Code de Reprise L2 §3.2
// Menus depuis base_core (Zéro Hardcode)
// Code de reprise 6 chars — envoyé par SMS à chaque nouvelle session
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { IaService } from '../../ia/ia.service';
import { UssdSessionService, UssdSession } from './ussd-session.service';
import { UssdVasRouterService } from './ussd-vas-router.service';
import { CoreConfigService } from '../../core-config/core-config.service';
import { TelecomService } from '../telecom/telecom.service';
import { SmsTemplateService } from '../telecom/sms-template.service';

@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name);

  constructor(
    private iaService:      IaService,
    private sessionService: UssdSessionService,
    private vasRouter:      UssdVasRouterService,
    private coreConfig:     CoreConfigService,
    private telecom:        TelecomService,
    private smsTpl:         SmsTemplateService,
  ) {}

  async traiter(params: {
    sessionId: string; phoneNumber: string;
    serviceCode: string; text: string;
  }): Promise<string> {
    const { sessionId, phoneNumber, text } = params;
    const tel       = phoneNumber.replace('+225', '').replace(/\s/g, '');
    const tenant_id = 'CI';

    this.logger.log('[USSD] ' + tel + ' -> "' + text + '"');

    let session   = await this.sessionService.get(sessionId);
    const isNouvelle = !session;

    if (!session) {
      session = {
        telephone: tel, tenant_id,
        etape: 'MENU', qNum: 0,
        reponses: [], data: {}, createdAt: Date.now(),
      };

      // Code de reprise L2 §3.2 — envoyé par SMS à chaque nouvelle session
      this.envoyerCodeReprise(phoneNumber, tenant_id).catch(() => {});
    }

    const choix   = text === '' ? [] : text.split('*');
    const reponse = await this.traiterChoix(choix, session, sessionId);
    const tronque = reponse.length > 182 ? reponse.slice(0, 179) + '...' : reponse;

    if (tronque.startsWith('END')) {
      await this.sessionService.delete(sessionId);
    } else {
      await this.sessionService.set(sessionId, session);
    }

    return tronque;
  }

  // ---------------------------------------------------------------------------
  // CODE DE REPRISE — L2 §3.2
  // Code 6 chars alphanumérique — valable 30 jours — stocké Redis
  // ---------------------------------------------------------------------------
  private async envoyerCodeReprise(telephone: string, tenantId: string): Promise<void> {
    try {
      const code = this.genererCodeReprise();
      // Stocker dans Redis avec TTL 30 jours
      await this.sessionService.setReprise(telephone, code);
      // Envoyer par SMS depuis template base_game
      const msg = await this.smsTpl.obtenir('CODE_REPRISE', { code }, tenantId);
      await this.telecom.sendVas(telephone, msg);
      this.logger.log('[USSD] Code reprise envoye → ' + telephone + ' | ' + code);
    } catch (e: any) {
      this.logger.warn('[USSD] Erreur code reprise: ' + e.message);
    }
  }

  private genererCodeReprise(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  // ---------------------------------------------------------------------------
  // Menus depuis base_core — Zéro Hardcode
  // ---------------------------------------------------------------------------
  private async buildMenuPrincipal(tenantId: string): Promise<string> {
    try {
      const refs    = await this.coreConfig.getReferentials(tenantId, 'METIER');
      const get     = (code: string) => refs.find(r => r.refCode === code)?.labelFr ?? code;
      const accueil = get('MENU_ACCUEIL');
      const p1      = get('PORTE_1');
      const p2      = get('PORTE_2');
      const p3      = get('PORTE_3');
      const p4      = get('PORTE_4');
      const p5      = get('PORTE_5');
      const quitter = get('LABEL_QUITTER');
      return `CON ${accueil}\n1. ${p1}\n2. ${p2}\n3. ${p3}\n4. ${p4}\n5. ${p5}\n0. ${quitter}`;
    } catch {
      return 'CON YIRA Africa\n1. Apprendre\n2. Sante\n3. Argent\n4. Avenir\n5. SOS\n0. Quitter';
    }
  }

  private async buildMsgAuRevoir(tenantId: string): Promise<string> {
    try {
      const refs = await this.coreConfig.getReferentials(tenantId, 'METIER');
      return refs.find(r => r.refCode === 'MSG_AU_REVOIR')?.labelFr ?? 'Merci d utiliser YIRA!';
    } catch {
      return 'Merci d utiliser YIRA!';
    }
  }

  private async buildMenuPorte(porteNum: string, tenantId: string): Promise<string> {
    try {
      const refs    = await this.coreConfig.getReferentials(tenantId, 'METIER');
      const accueil = refs.find(r => r.refCode === 'PORTE_' + porteNum)?.labelFr ?? 'Menu ' + porteNum;
      const services = await this.loadServicesForPorte(porteNum, tenantId);
      if (services.length === 0) return 'CON ' + accueil + '\nAucun service disponible\n0. Retour';
      let menu = 'CON ' + accueil;
      services.slice(0, 6).forEach((svc, idx) => {
        const prix = svc.prix > 0 ? ' (' + svc.prix + 'F/j)' : ' (Gratuit)';
        menu += '\n' + (idx + 1) + '. ' + svc.nom + prix;
      });
      menu += '\n0. Retour';
      return menu;
    } catch {
      return 'CON Menu ' + porteNum + '\nErreur chargement\n0. Retour';
    }
  }

  private async loadServicesForPorte(porteNum: string, tenantId: string): Promise<Array<{code: string, nom: string, prix: number, path: string}>> {
    const allServices: Array<{code: string, nom: string, prix: number, path: string}> = [];
    for (let i = 1; i <= 11; i++) {
      const path = porteNum + '*' + i;
      try {
        const svc  = await this.coreConfig.getVasService(tenantId, this.pathToServiceCode(path));
        const prix = (svc.pricingByTenant as any)?.[tenantId]?.daily_fcfa ?? 0;
        allServices.push({ code: svc.serviceCode, nom: svc.serviceName, prix, path });
      } catch { break; }
    }
    return allServices;
  }

  private pathToServiceCode(path: string): string {
    const map: Record<string, string> = {
      '1*1': 'ZOUGLOU',  '1*2': 'CULTURE',   '1*3': 'SPORT',
      '1*4': 'PROVERBE', '1*5': 'QUIZIK',    '1*6': 'CUISINE',
      '1*7': 'EDU',      '1*8': 'ALPHA',      '1*9': 'HISTOIRE',
      '2*1': 'PALU',     '2*2': 'DEPIST',    '2*3': 'MAMA',
      '2*4': 'VACCIN',   '2*5': 'NUTRI',     '2*6': 'HYGIENE',
      '2*7': 'EAU',      '2*8': 'CANCER',    '2*9': 'ESPRIT',
      '2*10': 'HANDICAP',
      '3*1': 'AGRI',     '3*2': 'METEO',     '3*3': 'FINANCE',
      '3*4': 'MICRO',    '3*5': 'ACTUQUIZ',  '3*6': 'SECURITE',
      '4*1': 'ORIENTATION','4*2': 'EMPLOI',  '4*3': 'ROUTE',
      '4*4': 'DROIT',    '4*5': 'FEMME',     '4*6': 'ELECTION',
      '4*7': 'ARNAQUE',  '4*8': 'CONCOURS',  '4*9': 'SENIOR',
      '4*10': 'TRAVAIL', '4*11': 'VOD',
      '5*1': 'SOS',
    };
    return map[path] ?? path;
  }

  private async traiterChoix(
    choix: string[], session: UssdSession, sessionId: string,
  ): Promise<string> {
    const tenant = session.tenant_id;

    if (choix.length === 0) {
      session.etape = 'MENU';
      return this.buildMenuPrincipal(tenant);
    }

    if (['1','2','3','4'].includes(choix[0])) {
      const porte = choix[0];
      if (choix.length === 1) {
        session.etape = 'PORTE_' + porte;
        return this.buildMenuPorte(porte, tenant);
      }
      const vasPath  = porte + '*' + choix[1];
      const vasResult = await this.vasRouter.routerByPath(vasPath, session.telephone, session, choix);
      if (vasResult.handled) {
        session = vasResult.session;
        return vasResult.response;
      }
      return this.buildMenuPrincipal(tenant);
    }

    if (choix[0] === '5') {
      const vasResult = await this.vasRouter.routerByPath('5*1', session.telephone, session, choix);
      if (vasResult.handled) {
        session = vasResult.session;
        return vasResult.response;
      }
      return 'END SOS-YIRA\nAppel urgence: 185\nService 24h/24 gratuit';
    }

    if (choix[0] === '0') {
      await this.sessionService.delete(sessionId);
      const msg = await this.buildMsgAuRevoir(tenant);
      return 'END ' + msg;
    }

    return this.buildMenuPrincipal(tenant);
  }
}