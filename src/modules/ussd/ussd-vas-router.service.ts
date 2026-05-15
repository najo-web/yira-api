import { Injectable, Logger } from '@nestjs/common';
import { CoreConfigService } from '../../core-config/core-config.service';
import { UssdSession } from './ussd-session.service';

export interface VasRouteResult {
  handled:     boolean;
  response:    string;
  serviceCode: string | null;
  session:     UssdSession;
}

@Injectable()
export class UssdVasRouterService {
  private readonly logger = new Logger(UssdVasRouterService.name);

  constructor(private readonly coreConfig: CoreConfigService) {}

  async router(
    vasPath: string,
    telephone: string,
    session: UssdSession,
    choix: string[],
  ): Promise<VasRouteResult> {
    const tenantId    = session.tenant_id;
    const serviceCode = this.pathToCode(vasPath);

    try {
      const service  = await this.coreConfig.getVasService(tenantId, serviceCode);
      const optinKey = 'optin_' + service.serviceCode;

      this.logger.log('[VAS] Router -> ' + service.serviceCode + ' (' + service.serviceName + ')');

      // Confirmation opt-in (choix final = '1' et pas encore souscrit)
      if (choix.length >= 3 && choix[choix.length - 1] === '1' && !session.data[optinKey]) {
        session.data[optinKey]                          = true;
        session.data['optin_at_' + service.serviceCode] = new Date().toISOString();
        this.logger.log('[VAS] Opt-in confirme: ' + telephone + ' -> ' + service.serviceCode);
        return {
          handled: true, serviceCode: service.serviceCode, session,
          response: 'END Souscription confirmee!\n' + service.serviceName + '\nVous recevrez votre\npremiere question bientot!',
        };
      }

      // Refus opt-in
      if (choix.length >= 3 && choix[choix.length - 1] === '2') {
        return {
          handled: true, serviceCode: service.serviceCode, session,
          response: 'END Pas de souci!\nA bientot sur YIRA!',
        };
      }

      // Deja souscrit — contenu
      if (session.data[optinKey]) {
        return {
          handled: true, serviceCode: service.serviceCode, session,
          response: 'END ' + service.serviceName + '\nContenu en chargement...\nReessayez dans 1 minute.',
        };
      }

      // Pas encore souscrit — menu opt-in
      return {
        handled: true, serviceCode: service.serviceCode, session,
        response: 'CON ' + service.serviceName + '\nService: 50F/jour\nVotre accord:\n1. Je souscris\n2. Non merci\n0. Retour',
      };

    } catch {
      this.logger.warn('[VAS] Service non trouve: ' + serviceCode);
      return { handled: false, response: '', serviceCode: null, session };
    }
  }

  private pathToCode(path: string): string {
    const map: Record<string, string> = {
      '1': 'ZOUGLOU', '2': 'CULTURE', '3': 'SANTE',
      '4': 'EMPLOI',  '5': 'ORIENTATION', '6': 'CONCOURS',
    };
    return map[path] ?? path;
  }
}