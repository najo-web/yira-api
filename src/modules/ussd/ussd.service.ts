// ============================================================
// YIRA — src/modules/ussd/ussd.service.ts  (fix routing)
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { IaService }          from '../../ia/ia.service';

const MENU_PRINCIPAL = `CON Bienvenue sur YIRA Africa
1. Orientation scolaire
2. Orientation pro
3. Mon profil
4. Aide
0. Quitter`;

const MENU_OS = `CON YIRA Orientation Scolaire
1. Passer le test RIASEC
2. Voir mes resultats
3. Filieres recommandees
0. Retour`;

interface UssdSession {
  telephone: string;
  etape:     string;
  qNum:      number;
  reponses:  number[];
  data:      Record<string, any>;
  createdAt: number;
}

const QUESTIONS = [
  `CON YIRA Test (1/6)\nJ'aime construire\nou reparer des objets:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup`,
  `CON YIRA Test (2/6)\nJ'aime resoudre des\nproblemes complexes:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup`,
  `CON YIRA Test (3/6)\nJ'aime creer des\noeuvres artistiques:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup`,
  `CON YIRA Test (4/6)\nJ'aime aider\nles autres:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup`,
  `CON YIRA Test (5/6)\nJ'aime diriger\nun groupe:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup`,
  `CON YIRA Test (6/6)\nJ'aime organiser\net classer:\n1-Pas du tout 2-Un peu\n3-Assez 4-Beaucoup`,
];

@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name);
  private sessions = new Map<string, UssdSession>();

  constructor(private iaService: IaService) {
    setInterval(() => this.nettoyerSessions(), 60_000);
  }

  async traiter(params: {
    sessionId: string; phoneNumber: string;
    serviceCode: string; text: string;
  }): Promise<string> {
    const { sessionId, phoneNumber, text } = params;
    const tel = phoneNumber.replace('+225', '').replace(/\s/g, '');

    this.logger.log(`[USSD] ${tel} → "${text}"`);

    // Récupérer ou créer session
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = { telephone: tel, etape: 'MENU', qNum: 0, reponses: [], data: {}, createdAt: Date.now() };
      this.sessions.set(sessionId, session);
    }

    // Découper les choix cumulés
    const choix = text === '' ? [] : text.split('*');
    const reponse = await this.traiterChoix(choix, session, sessionId);

    return reponse.length > 182 ? reponse.slice(0, 179) + '...' : reponse;
  }

  private async traiterChoix(
    choix: string[],
    session: UssdSession,
    sessionId: string,
  ): Promise<string> {

    // Menu principal — aucun choix
    if (choix.length === 0) {
      session.etape = 'MENU';
      return MENU_PRINCIPAL;
    }

    // Choix 1 : Orientation Scolaire
    if (choix[0] === '1') {

      // Sous-menu OS
      if (choix.length === 1) {
        session.etape = 'MENU_OS';
        return MENU_OS;
      }

      // Choix 1 dans OS : démarrer test
      if (choix[1] === '1') {

        // Nombre de réponses déjà données = choix.length - 2
        const repDonnees = choix.length - 2;

        // Pas encore de réponse → question 1
        if (repDonnees === 0) {
          session.etape  = 'TEST';
          session.qNum   = 1;
          session.reponses = [];
          return QUESTIONS[0];
        }

        // Enregistrer la dernière réponse si valide
        const dernierChoix = parseInt(choix[choix.length - 1]);
        if (isNaN(dernierChoix) || dernierChoix < 1 || dernierChoix > 4) {
          return QUESTIONS[session.qNum - 1] + '\nRep: 1, 2, 3 ou 4';
        }

        // Ajouter la réponse
        if (session.reponses.length < repDonnees) {
          session.reponses.push(dernierChoix);
        }

        // Toutes les 6 questions répondues ?
        if (session.reponses.length >= 6) {
          return this.genererResultat(session, sessionId);
        }

        // Question suivante
        session.qNum = session.reponses.length + 1;
        return QUESTIONS[session.reponses.length];
      }

      // Choix 2 dans OS : voir résultats
      if (choix[1] === '2') {
        if (session.data.profil) {
          return `END YIRA Resultats\nProfil: ${session.data.profil}\nyira.africa/r/${session.data.ref}`;
        }
        return `END Passez d'abord le test.\nChoisissez option 1.`;
      }

      // Retour
      if (choix[1] === '0') return MENU_PRINCIPAL;

      return MENU_OS;
    }

    // Choix 2 : Orientation Pro
    if (choix[0] === '2') {
      return `CON YIRA Orientation Pro\n1. Mon bilan pro\n2. Metiers CI\n0. Retour`;
    }

    // Choix 3 : Mon profil
    if (choix[0] === '3') {
      return `END Votre profil YIRA\nyira.africa/r/${session.telephone.slice(-6)}`;
    }

    // Quitter
    if (choix[0] === '0') {
      this.sessions.delete(sessionId);
      return `END Merci d'utiliser YIRA!\nBonne orientation!`;
    }

    return MENU_PRINCIPAL;
  }

  private async genererResultat(session: UssdSession, sessionId: string): Promise<string> {
    const dims   = ['R','I','A','S','E','C'];
    const scores: Record<string, number> = {};
    dims.forEach((d, i) => { scores[d] = session.reponses[i] * 25; });

    const sorted  = Object.entries(scores).sort((a,b) => b[1]-a[1]);
    const profil  = sorted.slice(0,3).map(([d]) => d).join('');
    const ref     = sessionId.slice(-6).toUpperCase();

    session.data.profil = profil;
    session.data.ref    = ref;

    // Résumé IA court (USSD ≤ 160 chars)
    const iaResult = await this.iaService.generate({
      module: 'YIRAOS', usage: 'USSD_RESULT',
      pays: 'CI', canal: 'USSD',
      variables: { profil_riasec: profil },
    });

    const resume = (iaResult.text ?? `Profil ${profil}: bon potentiel CI`).slice(0, 80);

    return `END YIRA Resultats\nProfil: ${profil}\n${resume}\nRapport: yira.africa/r/${ref}`;
  }

  private nettoyerSessions() {
    const now = Date.now();
    for (const [id, s] of this.sessions.entries()) {
      if (now - s.createdAt > 3 * 60 * 1000) this.sessions.delete(id);
    }
  }
}