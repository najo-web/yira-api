import { Injectable, Logger } from '@nestjs/common';
import { IaService } from '../../ia/ia.service';
import { UssdSessionService, UssdSession } from './ussd-session.service';
import { UssdVasRouterService } from './ussd-vas-router.service';

const MENU_PRINCIPAL = "CON Bienvenue sur YIRA Africa\n1. Quiz VAS\n2. Orientation scolaire\n3. Orientation pro\n4. Mon profil\n0. Quitter";
const MENU_OS = "CON YIRA Orientation Scolaire\n1. Passer le test RIASEC\n2. Voir mes resultats\n3. Filieres recommandees\n0. Retour";

const QUESTIONS = [
  "CON YIRA Test (1/6)\nJ aime construire\nou reparer des objets:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup",
  "CON YIRA Test (2/6)\nJ aime resoudre des\nproblemes complexes:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup",
  "CON YIRA Test (3/6)\nJ aime creer des\noeuvres artistiques:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup",
  "CON YIRA Test (4/6)\nJ aime aider\nles autres:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup",
  "CON YIRA Test (5/6)\nJ aime diriger\nun groupe:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup",
  "CON YIRA Test (6/6)\nJ aime organiser\net classer:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup",
];

@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name);

  constructor(
    private iaService:      IaService,
    private sessionService: UssdSessionService,
    private vasRouter:      UssdVasRouterService,
  ) {}

  async traiter(params: {
    sessionId: string; phoneNumber: string;
    serviceCode: string; text: string;
  }): Promise<string> {
    const { sessionId, phoneNumber, text } = params;
    const tel = phoneNumber.replace('+225', '').replace(/\s/g, '');
    const tenant_id = 'CI';

    this.logger.log('[USSD] ' + tel + ' -> "' + text + '"');

    let session = await this.sessionService.get(sessionId);
    if (!session) {
      session = {
        telephone: tel, tenant_id,
        etape: 'MENU', qNum: 0,
        reponses: [], data: {}, createdAt: Date.now(),
      };
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

  private async traiterChoix(
    choix: string[], session: UssdSession, sessionId: string,
  ): Promise<string> {

    if (choix.length === 0) { session.etape = 'MENU'; return MENU_PRINCIPAL; }

    // Choix 1 â€” Quiz VAS (router vers base_core)
    if (choix[0] === '1') {
      if (choix.length === 1) {
        return "CON YIRA Quiz VAS\n1. Quiz Zouglou\n2. Quiz Culture\n3. Quiz Sante\n0. Retour";
      }
      // Router VAS â€” le sous-choix pointe vers un service base_core
      const vasPath = choix[1];
      const vasResult = await this.vasRouter.router(vasPath, session.telephone, session, choix);
      if (vasResult.handled) return vasResult.response;
      return MENU_PRINCIPAL;
    }

    // Choix 2 â€” Orientation scolaire
    if (choix[0] === '2') {
      if (choix.length === 1) { session.etape = 'MENU_OS'; return MENU_OS; }

      if (choix[1] === '1') {
        const repDonnees = choix.length - 2;
        if (repDonnees === 0) {
          session.etape = 'TEST'; session.qNum = 1; session.reponses = [];
          return QUESTIONS[0];
        }
        const dernierChoix = parseInt(choix[choix.length - 1]);
        if (isNaN(dernierChoix) || dernierChoix < 1 || dernierChoix > 4) {
          return QUESTIONS[session.qNum - 1] + '\nRep: 1, 2, 3 ou 4';
        }
        if (session.reponses.length < repDonnees) session.reponses.push(dernierChoix);
        if (session.reponses.length >= 6) return this.genererResultat(session, sessionId);
        session.qNum = session.reponses.length + 1;
        return QUESTIONS[session.reponses.length];
      }

      if (choix[1] === '2') {
        if (session.data.profil) {
          return 'END YIRA Resultats\nProfil: ' + session.data.profil + '\nyira.africa/r/' + session.data.ref;
        }
        return 'END Passez d abord le test.\nChoisissez option 1.';
      }

      if (choix[1] === '0') return MENU_PRINCIPAL;
      return MENU_OS;
    }

    // Choix 3 â€” Orientation pro
if (choix[0] === '3') return "CON YIRA Orientation Pro\n1. Mon bilan pro\n2. Metiers CI\n0. Retour";
// Choix 4 — Mon profil
    if (choix[0] === '4') return 'END Votre profil YIRA\nyira.africa/r/' + session.telephone.slice(-6);

    // Quitter
    if (choix[0] === '0') {
      await this.sessionService.delete(sessionId);
      return 'END Merci d utiliser YIRA!\nBonne orientation!';
    }

    return MENU_PRINCIPAL;
  }

  private async genererResultat(session: UssdSession, sessionId: string): Promise<string> {
    const dims = ['R','I','A','S','E','C'];
    const scores: Record<string, number> = {};
    dims.forEach((d, i) => { scores[d] = session.reponses[i] * 25; });
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const profil = sorted.slice(0, 3).map(([d]) => d).join('');
    const ref    = sessionId.slice(-6).toUpperCase();

    session.data.profil = profil;
    session.data.ref    = ref;

    const iaResult = await this.iaService.generate({
      module: 'YIRAOS', usage: 'USSD_RESULT',
      pays: session.tenant_id, canal: 'USSD',
      variables: { profil_riasec: profil },
    });

    const resume = (iaResult.text ?? 'Profil ' + profil + ': bon potentiel CI').slice(0, 80);
    return 'END YIRA Resultats\nProfil: ' + profil + '\n' + resume + '\nRapport: yira.africa/r/' + ref;
  }
}