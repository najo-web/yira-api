import { Injectable, Logger } from '@nestjs/common';
import { CoreConfigService } from '../../core-config/core-config.service';
import { UssdSession } from './ussd-session.service';

export interface VasRouteResult {
  handled:     boolean;
  response:    string;
  serviceCode: string | null;
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
    const tenantId = session.tenant_id;
    const serviceCode = this.pathToCode(vasPath);

    try {
      const service = await this.coreConfig.getVasService(tenantId, serviceCode);
      this.logger.log('[VAS] Router -> ' + service.serviceCode + ' (' + service.serviceName + ')');

      if (service.doubleOptinRequired && !session.data['optin_' + service.serviceCode]) {
        const prix = 50;
        return {
          handled: true,
          serviceCode: service.serviceCode,
          response: 'CON ' + service.serviceName + '\nService: ' + prix + 'F/jour\nVotre accord:\n1. Je souscris\n2. Non merci\n0. Retour',
        };
      }

      if (choix.length >= 3 && choix[choix.length - 1] === '1' && !session.data['optin_' + service.serviceCode]) {
        session.data['optin_' + service.serviceCode] = true;
        session.data['optin_at_' + service.serviceCode] = new Date().toISOString();
        this.logger.log('[VAS] Opt-in confirme: ' + telephone + ' -> ' + service.serviceCode);
      }

      if (choix.length >= 3 && choix[choix.length - 1] === '2') {
        return { handled: true, serviceCode: service.serviceCode, response: 'END Pas de souci!\nA bientot sur YIRA!' };
      }

      return {
        handled: true,
        serviceCode: service.serviceCode,
        response: 'END ' + service.serviceName + '\nContenu en chargement...\nReessayez dans 1 minute.',
      };

    } catch {
      this.logger.warn('[VAS] Service non trouve: ' + serviceCode);
      return { handled: false, response: '', serviceCode: null };
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