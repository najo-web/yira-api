// =============================================================================
// YIRA V3.0 — AssessmentUssdService
// Sprint 31 — Pont USSD → Orientation (Service #10 L2 §5.2)
// RIASEC 10Q simplifié sur USSD → Top 3 métiers par SMS
// Code de reprise Redis 30j — session interruptible
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { UssdSessionService } from './ussd-session.service';
import { OpService, ProfilOrientation } from '../op/op.service';
import { TelecomService } from '../telecom/telecom.service';
import { SmsTemplateService } from '../telecom/sms-template.service';
import { YiraConfigService } from '../../core-config/yira-config.service';

const QUESTIONS_RIASEC = [
  { id:'R1', texte:'Que preferez-vous faire?',    opt1:'Reparer objets',       opt2:'Aider personnes',      opt3:'Analyser donnees',     dim1:'R', dim2:'S', dim3:'I' },
  { id:'I1', texte:'Quel sujet vous passionne?',  opt1:'Sciences/Maths',       opt2:'Arts/Musique',          opt3:'Commerce/Gestion',     dim1:'I', dim2:'A', dim3:'C' },
  { id:'A1', texte:'En temps libre vous:',         opt1:'Creez/Dessinez',       opt2:'Organisez/Gerez',       opt3:'Explorez/Cherchez',    dim1:'A', dim2:'C', dim3:'I' },
  { id:'S1', texte:'Votre force principale?',      opt1:'Ecouter/Aider',        opt2:'Analyser/Resoudre',     opt3:'Vendre/Convaincre',    dim1:'S', dim2:'I', dim3:'E' },
  { id:'E1', texte:'Vous preferez travailler:',    opt1:'Seul sur projets',     opt2:'En equipe/Diriger',     opt3:'Avec machines/Tech',   dim1:'I', dim2:'E', dim3:'R' },
  { id:'C1', texte:'Votre style de travail?',      opt1:'Methodique/Precis',    opt2:'Creatif/Libre',         opt3:'Dynamique/Action',     dim1:'C', dim2:'A', dim3:'E' },
  { id:'R2', texte:'Vous aimez:',                  opt1:'Construire/Fabriquer', opt2:'Enseigner/Former',      opt3:'Planifier/Organiser',  dim1:'R', dim2:'S', dim3:'C' },
  { id:'I2', texte:'Le metier ideal pour vous?',   opt1:'Medecin/Chercheur',    opt2:'Artiste/Designer',      opt3:'Entrepreneur/Vendeur', dim1:'I', dim2:'A', dim3:'E' },
  { id:'S2', texte:'Ce qui vous motive:',          opt1:'Aider la communaute',  opt2:'Innover/Decouvrir',     opt3:'Reussir/Performer',    dim1:'S', dim2:'I', dim3:'E' },
  { id:'E2', texte:'Dans un groupe vous etes:',    opt1:'Le leader naturel',    opt2:'Le createur idees',     opt3:'L executant fiable',   dim1:'E', dim2:'A', dim3:'C' },
];

export interface SessionAssessment {
  telephone:  string;
  tenant_id:  string;
  etape:      number;
  reponses:   Record<string, string>;
  scores:     Record<string, number>;
  createdAt:  number;
}

@Injectable()
export class AssessmentUssdService {
  private readonly logger = new Logger(AssessmentUssdService.name);

  constructor(
    private sessionSvc: UssdSessionService,
    private opSvc:      OpService,
    private telecom:    TelecomService,
    private smsTpl:     SmsTemplateService,
    private yiraConf:   YiraConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // ENTRÉE — Lancer ou reprendre le quiz orientation
  // ---------------------------------------------------------------------------
  async traiter(telephone: string, choix: string[], tenantId = 'CI'): Promise<string> {
    const key     = 'assessment:ussd:' + telephone;
    let   session = await this.chargerSession(key);

    if (!session) {
      session = {
        telephone, tenant_id: tenantId,
        etape: 0, reponses: {},
        scores: { R:0, I:0, A:0, S:0, E:0, C:0 },
        createdAt: Date.now(),
      };
      this.logger.log('[ASSESS] Nouvelle session → ' + telephone);
    }

    // Session déjà terminée
    if (session.etape >= QUESTIONS_RIASEC.length) {
      return this.afficherResume(session);
    }

    // Traiter la réponse si fournie
    const rep = choix.length > 0 ? choix[choix.length - 1] : '';

    // Pause/reprendre plus tard
    if (rep === '0') {
      await this.sauvegarderSession(key, session);
      const cfg = await this.yiraConf.getConfig(tenantId);
      return 'END YIRA-Orientation\nSession sauvegardee!\nReprenez avec votre\ncode de reprise sur\n' + cfg.ussd_short_code;
    }

    // Enregistrer la réponse
    if (['1','2','3'].includes(rep)) {
      const q   = QUESTIONS_RIASEC[session.etape];
      const dim = rep === '1' ? q.dim1 : rep === '2' ? q.dim2 : q.dim3;
      session.reponses[q.id] = rep;
      session.scores[dim]    = (session.scores[dim] ?? 0) + 1;
      session.etape++;
    }

    // Quiz terminé
    if (session.etape >= QUESTIONS_RIASEC.length) {
      await this.sauvegarderSession(key, session);
      return await this.terminer(session, tenantId);
    }

    // Question suivante
    await this.sauvegarderSession(key, session);
    return this.afficherQuestion(session);
  }

  // ---------------------------------------------------------------------------
  // AFFICHER QUESTION
  // ---------------------------------------------------------------------------
  private afficherQuestion(session: SessionAssessment): string {
    const q   = QUESTIONS_RIASEC[session.etape];
    const num = session.etape + 1;
    const pct = Math.round((session.etape / QUESTIONS_RIASEC.length) * 100);
    return `CON YIRA-Orient. (${num}/10-${pct}%)\n${q.texte}\n1. ${q.opt1}\n2. ${q.opt2}\n3. ${q.opt3}\n0. Pause/Reprendre`;
  }

  // ---------------------------------------------------------------------------
  // TERMINER — Calculer résultat + envoyer SMS
  // ---------------------------------------------------------------------------
  private async terminer(session: SessionAssessment, tenantId: string): Promise<string> {
    const dominant = this.calculerDominant(session.scores);
    const cfg      = await this.yiraConf.getConfig(tenantId);

    // Obtenir top 3 métiers via OpService
    let top3 = 'voir rapport complet';
    try {
      const profil: ProfilOrientation = {
        telephone:    session.telephone,
        country_code: tenantId,
        niveau:       'BEPC',
        riasec: {
          r: session.scores['R'] ?? 0,
          i: session.scores['I'] ?? 0,
          a: session.scores['A'] ?? 0,
          s: session.scores['S'] ?? 0,
          e: session.scores['E'] ?? 0,
          c: session.scores['C'] ?? 0,
        },
      };
      const result = await this.opSvc.evaluer(profil);
      if (result?.metiers?.length > 0) {
        top3 = result.metiers
          .slice(0, 3)
          .map((m: any) => m.nom_metier ?? m.nom ?? String(m))
          .join(', ');
      }
    } catch (e: any) {
      this.logger.warn('[ASSESS] OpService erreur: ' + e.message);
    }

    // SMS résultat depuis template base_game
    const sms = await this.smsTpl.obtenir('NIE_RAPPORT', {
      filiere:   dominant,
      metier:    top3.slice(0, 60),
      shortcode: cfg.ussd_short_code,
    }, tenantId);
    await this.telecom.sendVas(session.telephone, sms);

    // Nettoyer session Redis
    await this.supprimerSession('assessment:ussd:' + session.telephone);

    this.logger.log('[ASSESS] Resultat envoye → ' + session.telephone + ' | ' + dominant);

    const shortNoHash = cfg.ussd_short_code.replace('#', '');
    return `END YIRA-Orientation\nProfil: ${dominant}\nTop metiers SMS envoye!\n\nRapport complet 700F:\n*${shortNoHash}*RAPPORT#`;
  }

  // ---------------------------------------------------------------------------
  // RÉSUMÉ (session déjà terminée)
  // ---------------------------------------------------------------------------
  private afficherResume(session: SessionAssessment): string {
    const dominant = this.calculerDominant(session.scores);
    return `CON YIRA-Orientation\nProfil: ${dominant}\n\n1. Rapport complet (700F)\n2. Refaire le test\n0. Retour menu`;
  }

  // ---------------------------------------------------------------------------
  // CALCULER DOMINANT RIASEC
  // ---------------------------------------------------------------------------
  private calculerDominant(scores: Record<string, number>): string {
    const noms: Record<string, string> = {
      R: 'Realiste-Technique',
      I: 'Investigateur',
      A: 'Artistique-Creatif',
      S: 'Social-Humanitaire',
      E: 'Entrepreneur',
      C: 'Conventionnel',
    };
    const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return noms[top?.[0] ?? 'I'] ?? 'Investigateur';
  }

  // ---------------------------------------------------------------------------
  // REDIS — Gestion sessions assessment
  // ---------------------------------------------------------------------------
  private async chargerSession(key: string): Promise<SessionAssessment | null> {
    try {
      const raw = await (this.sessionSvc as any)['redis'].get(key);
      if (!raw) return null;
      return JSON.parse(raw) as SessionAssessment;
    } catch { return null; }
  }

  private async sauvegarderSession(key: string, session: SessionAssessment): Promise<void> {
    try {
      await (this.sessionSvc as any)['redis'].set(
        key, JSON.stringify(session), 'EX', 30 * 24 * 3600,
      );
    } catch (e: any) {
      this.logger.warn('[ASSESS] Erreur sauvegarde: ' + e.message);
    }
  }

  private async supprimerSession(key: string): Promise<void> {
    try { await (this.sessionSvc as any)['redis'].del(key); } catch {}
  }
}