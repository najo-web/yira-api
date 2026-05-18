// =============================================================================
// YIRA V3.0 — UssdVasRouterService
// Niveau 4 (N4) — Router VAS USSD + Pont Assessment #10
// Sprint 31 — Service #10 ORIENTATION branché AssessmentUssdService
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { CoreConfigService } from '../../core-config/core-config.service';
import { UssdSession } from './ussd-session.service';
import { AssessmentUssdService } from './assessment-ussd.service';

export interface VasRouteResult {
  handled:     boolean;
  response:    string;
  serviceCode: string | null;
  session:     UssdSession;
}

@Injectable()
export class UssdVasRouterService {
  private readonly logger = new Logger(UssdVasRouterService.name);

  private readonly PATH_TO_CODE: Record<string, string> = {
    '1*1': 'ZOUGLOU',     '1*2': 'CULTURE',   '1*3': 'SPORT',
    '1*4': 'PROVERBE',    '1*5': 'QUIZIK',    '1*6': 'CUISINE',
    '1*7': 'EDU',         '1*8': 'ALPHA',     '1*9': 'HISTOIRE',
    '2*1': 'PALU',        '2*2': 'DEPIST',    '2*3': 'MAMA',
    '2*4': 'VACCIN',      '2*5': 'NUTRI',     '2*6': 'HYGIENE',
    '2*7': 'EAU',         '2*8': 'CANCER',    '2*9': 'ESPRIT',
    '2*10': 'HANDICAP',
    '3*1': 'AGRI',        '3*2': 'METEO',     '3*3': 'FINANCE',
    '3*4': 'MICRO',       '3*5': 'ACTUQUIZ',  '3*6': 'SECURITE',
    '4*1': 'ORIENTATION', '4*2': 'EMPLOI',    '4*3': 'ROUTE',
    '4*4': 'DROIT',       '4*5': 'FEMME',     '4*6': 'ELECTION',
    '4*7': 'ARNAQUE',     '4*8': 'CONCOURS',  '4*9': 'SENIOR',
    '4*10': 'TRAVAIL',    '4*11': 'VOD',
    '5*1': 'SOS',
  };

  // Services qui ont un flux spécial (non standard opt-in)
  private readonly SERVICES_SPECIAUX = ['ORIENTATION', 'SOS'];

  constructor(
    private readonly coreConfig:  CoreConfigService,
    private readonly assessSvc:   AssessmentUssdService,
  ) {}

  // ---------------------------------------------------------------------------
  // ROUTER PRINCIPAL — par chemin USSD (ex: '1*1', '4*1')
  // ---------------------------------------------------------------------------
  async routerByPath(
    vasPath:   string,
    telephone: string,
    session:   UssdSession,
    choix:     string[],
  ): Promise<VasRouteResult> {
    const serviceCode = this.PATH_TO_CODE[vasPath] ?? vasPath;
    return this.routerByCode(serviceCode, telephone, session, choix, vasPath);
  }

  // ---------------------------------------------------------------------------
  // ROUTER PAR CODE SERVICE
  // ---------------------------------------------------------------------------
  private async routerByCode(
    serviceCode: string,
    telephone:   string,
    session:     UssdSession,
    choix:       string[],
    vasPath:     string,
  ): Promise<VasRouteResult> {
    const tenantId = session.tenant_id;

    // ── SERVICE SPÉCIAUX ────────────────────────────────────────────────────

    // Service #10 ORIENTATION → AssessmentUssdService
    if (serviceCode === 'ORIENTATION') {
      const response = await this.assessSvc.traiter(telephone, choix, tenantId);
      return { handled: true, serviceCode, session, response };
    }

    // Service #37 SOS → flux urgence direct
    if (serviceCode === 'SOS') {
      return {
        handled: true, serviceCode, session,
        response: 'END YIRA-SOS\nSignalement enregistre\nConseiller en route\nUrgence: 185',
      };
    }

    // ── SERVICES STANDARD VAS ───────────────────────────────────────────────
    try {
      const service  = await this.coreConfig.getVasService(tenantId, serviceCode);
      const optinKey = 'optin_' + service.serviceCode;
      const prix     = (service.pricingByTenant as any)?.[tenantId]?.daily_fcfa ?? 0;

      this.logger.log('[VAS] Router → ' + service.serviceCode + ' (' + service.serviceName + ')');

      // Confirmation opt-in (choix = 1)
      if (choix.length >= 3 && choix[choix.length - 1] === '1' && !session.data[optinKey]) {
        session.data[optinKey]                           = true;
        session.data['optin_at_' + service.serviceCode] = new Date().toISOString();
        this.logger.log('[VAS] Opt-in confirme: ' + telephone + ' → ' + service.serviceCode);

        let msgConf = 'Souscription confirmee! Premiere question bientot par SMS!';
        try {
          const refs = await this.coreConfig.getReferentials(tenantId, 'METIER');
          msgConf    = refs.find(r => r.refCode === 'MSG_OPTIN_CONF')?.labelFr ?? msgConf;
        } catch {}

        return { handled: true, serviceCode: service.serviceCode, session, response: 'END ' + msgConf };
      }

      // Refus opt-in (choix = 2)
      if (choix.length >= 3 && choix[choix.length - 1] === '2') {
        let msgRefus = 'Pas de souci! A bientot sur YIRA!';
        try {
          const refs = await this.coreConfig.getReferentials(tenantId, 'METIER');
          msgRefus   = refs.find(r => r.refCode === 'MSG_OPTIN_REFUS')?.labelFr ?? msgRefus;
        } catch {}
        return { handled: true, serviceCode: service.serviceCode, session, response: 'END ' + msgRefus };
      }

      // Déjà souscrit → accès direct
      if (session.data[optinKey]) {
        return {
          handled: true, serviceCode: service.serviceCode, session,
          response: 'END ' + service.serviceName + '\nContenu en chargement...\nReessayez dans 1 minute.',
        };
      }

      // Menu opt-in standard — prix depuis base_core
      const prixTxt = prix > 0 ? prix + 'F/jour' : 'Gratuit';
      return {
        handled: true, serviceCode: service.serviceCode, session,
        response: 'CON ' + service.serviceName + '\nService: ' + prixTxt + '\nVotre accord:\n1. Je souscris\n2. Non merci\n0. Retour',
      };

    } catch {
      this.logger.warn('[VAS] Service non trouve: ' + serviceCode);
      return { handled: false, response: '', serviceCode: null, session };
    }
  }
}