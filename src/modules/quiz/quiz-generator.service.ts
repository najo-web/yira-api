// =============================================================================
// YIRA V3.0 — QuizGeneratorService
// Sprint 33 — ContentSourceService intégré (scraping CSP réel)
// Niveau 4 (N4) — Génération quotidienne des questions VAS par 24 agents IA
// L3 §5.1 : Cron 05h00 Africa/Abidjan
// Filtre CQ-CI : score culturel ≥ 0.75 obligatoire
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CoreConfigService } from '../../core-config/core-config.service';
import { TelecomService } from '../../modules/telecom/telecom.service';
import { ContentSourceService } from './content-source/content-source.service';
import { PrismaClient as PrismaGame } from '.prisma/client-game';

export interface QuizQuestion {
  serviceCode:  string;
  agentName:    string;
  question:     string;
  optionA:      string;
  optionB:      string;
  optionC:      string;
  bonneRep:     'A' | 'B' | 'C';
  explication:  string;
  difficulte:   number;
  cqciScore:    number;
  source_csp?:  string; // Nouvelle — source du fait utilisé
}

@Injectable()
export class QuizGeneratorService {
  private readonly logger   = new Logger(QuizGeneratorService.name);
  private readonly prisma   = new PrismaGame({ datasources: { db: { url: process.env.DATABASE_URL_GAME } } });
  private readonly tenantId = 'CI';

  private readonly AGENTS: Record<string, string> = {
    ZOUGLOU:     'ZOUGLOU_AGENT',    CULTURE:  'CULTURE_AGENT',
    SPORT:       'SPORT_AGENT',      PROVERBE: 'PROVERBE_AGENT',
    QUIZIK:      'QUIZIK_AGENT',     CUISINE:  'CUISINE_AGENT',
    EDU:         'EDU_AGENT',        ALPHA:    'ALPHA_AGENT',
    HISTOIRE:    'HISTOIRE_AGENT',   PALU:     'PALU_AGENT',
    DEPIST:      'DEPIST_AGENT',     MAMA:     'MAMA_AGENT',
    VACCIN:      'VACCIN_AGENT',     NUTRI:    'NUTRI_AGENT',
    HYGIENE:     'HYGIENE_AGENT',    EAU:      'EAU_AGENT',
    CANCER:      'CANCER_AGENT',     ESPRIT:   'ESPRIT_AGENT',
    HANDICAP:    'HANDICAP_AGENT',   AGRI:     'AGRI_AGENT',
    METEO:       'METEO_AGENT',      FINANCE:  'FINANCE_AGENT',
    MICRO:       'MICRO_AGENT',      ACTUQUIZ: 'ACTU_AGENT',
    SECURITE:    'SECURITE_AGENT',   ORIENTATION: 'ORIENTATION_AGENT',
    EMPLOI:      'EMPLOI_AGENT',     ROUTE:    'ROUTE_AGENT',
    DROIT:       'DROIT_AGENT',      FEMME:    'FEMME_AGENT',
    ELECTION:    'ELECTION_AGENT',   ARNAQUE:  'ARNAQUE_AGENT',
    CONCOURS:    'CONCOURS_AGENT',   SENIOR:   'SENIOR_AGENT',
    TRAVAIL:     'TRAVAIL_AGENT',    VOD:      'VOD_AGENT',
    SOS:         'SOS_AGENT',
  };

  constructor(
    private coreConfig:     CoreConfigService,
    private telecom:        TelecomService,
    private config:         ConfigService,
    private contentSource:  ContentSourceService,
  ) {}

  // ---------------------------------------------------------------------------
  // CRON 05h00 — Génération quotidienne
  // ---------------------------------------------------------------------------
  @Cron('0 5 * * *', { timeZone: 'Africa/Abidjan' })
  async genererQuotidien(): Promise<void> {
    this.logger.log('[QUIZ-GEN] Demarrage generation quotidienne — ' + new Date().toISOString());
    let generes = 0;
    let echecs  = 0;

    const services = Object.keys(this.AGENTS);
    for (const serviceCode of services) {
      try {
        const question = await this.genererQuestion(serviceCode);
        if (question && question.cqciScore >= 0.75) {
          await this.stockerQuestion(question);
          generes++;
          this.logger.log('[QUIZ-GEN] OK ' + serviceCode + ' — CQ-CI: ' + question.cqciScore + (question.source_csp ? ' | CSP: ' + question.source_csp : ''));
        } else {
          this.logger.warn('[QUIZ-GEN] REJETE ' + serviceCode + ' — score CQ-CI insuffisant: ' + (question?.cqciScore ?? 0));
          echecs++;
        }
      } catch (err: any) {
        this.logger.error('[QUIZ-GEN] ECHEC ' + serviceCode + ' — ' + err.message);
        echecs++;
      }
      await this.sleep(2000);
    }

    this.logger.log('[QUIZ-GEN] Termine — ' + generes + ' questions generees, ' + echecs + ' echecs');
    await this.notifierModerateurs(generes);
  }

  // ---------------------------------------------------------------------------
  // GÉNÉRATION D'UNE QUESTION — avec injection CSP
  // ---------------------------------------------------------------------------
  private async genererQuestion(serviceCode: string): Promise<QuizQuestion | null> {
    const agentName = this.AGENTS[serviceCode] ?? 'GENERIC_AGENT';
    const heure     = new Date().getHours();
    const mode      = heure < 12 ? 'INFO' : 'QUIZ';

    // ── NOUVEAU Sprint 33 — Scraper les faits du jour depuis CSP ──────────
    let contexteCSP = '';
    let sourceCsp   = '';
    try {
      const faits = await this.contentSource.obtenirFaits(serviceCode, this.tenantId, 3);
      if (faits.length > 0) {
        contexteCSP = await this.contentSource.construireContexteIA(serviceCode, this.tenantId);
        sourceCsp   = faits[0].source;
        this.logger.log('[QUIZ-GEN] CSP actif pour ' + serviceCode + ' — ' + faits.length + ' faits');
      }
    } catch (e: any) {
      this.logger.warn('[QUIZ-GEN] CSP non disponible pour ' + serviceCode + ': ' + e.message);
    }
    // ────────────────────────────────────────────────────────────────────────

    const promptSystem = this.buildPromptSystem(serviceCode, mode);
    const promptUser   = this.buildPromptUser(serviceCode, mode, contexteCSP);

    try {
      const apiKey = this.config.get('ANTHROPIC_API_KEY') ?? '';

      if (!apiKey) {
        return this.mockQuestion(serviceCode, agentName, sourceCsp);
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages:   [{ role: 'user', content: promptSystem + '\n\n' + promptUser }],
        }),
      });

      const data = await response.json() as any;
      const text = data?.content?.[0]?.text ?? '';
      const q    = this.parseReponseIA(text, serviceCode, agentName);
      if (q) q.source_csp = sourceCsp;
      return q;

    } catch (err: any) {
      this.logger.error('[QUIZ-GEN] Erreur IA pour ' + serviceCode + ': ' + err.message);
      return this.mockQuestion(serviceCode, agentName, sourceCsp);
    }
  }

  // ---------------------------------------------------------------------------
  // PROMPTS — avec injection du contexte CSP
  // ---------------------------------------------------------------------------
  private buildPromptSystem(serviceCode: string, mode: string): string {
    return 'Tu es un agent editorial YIRA specialise en ' + serviceCode + ' pour la Cote dIvoire. ' +
           'Tu generes du contenu educatif et culturellement adapte au contexte ivoirien et ouest-africain. ' +
           'Toujours en francais simple et accessible. Maximum 160 caracteres par champ. ' +
           'Mode actuel: ' + mode + '. ' +
           'Reponds UNIQUEMENT en JSON valide, sans markdown ni explication.';
  }

  private buildPromptUser(serviceCode: string, mode: string, contexteCSP: string): string {
    const base = contexteCSP
      ? contexteCSP + '\n'  // Injecter les faits CSP en premier
      : '';

    if (mode === 'QUIZ') {
      return base +
        'Genere une question quiz sur ' + serviceCode + ' pour un utilisateur ivoirien. ' +
        (contexteCSP ? 'Base-toi sur un des faits ci-dessus pour ancrer la question dans l\'actualite reelle. ' : '') +
        'Format JSON strict: {"question":"...","optionA":"...","optionB":"...","optionC":"...","bonneRep":"A","explication":"...","difficulte":1}';
    }
    return base +
      'Genere une info utile du jour sur ' + serviceCode + ' pour un ivoirien. ' +
      'Format JSON strict: {"question":"Info du jour:","optionA":"...","optionB":"","optionC":"","bonneRep":"A","explication":"...","difficulte":1}';
  }

  // ---------------------------------------------------------------------------
  // PARSE RÉPONSE IA
  // ---------------------------------------------------------------------------
  private parseReponseIA(text: string, serviceCode: string, agentName: string): QuizQuestion | null {
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const data  = JSON.parse(clean);
      const cqciScore = this.calculerScoreCQCI(data.question, serviceCode);

      return {
        serviceCode,
        agentName,
        question:    (data.question    ?? '').slice(0, 100),
        optionA:     (data.optionA     ?? '').slice(0, 40),
        optionB:     (data.optionB     ?? '').slice(0, 40),
        optionC:     (data.optionC     ?? '').slice(0, 40),
        bonneRep:    data.bonneRep     ?? 'A',
        explication: (data.explication ?? '').slice(0, 80),
        difficulte:  data.difficulte   ?? 1,
        cqciScore,
      };
    } catch { return null; }
  }

  // ---------------------------------------------------------------------------
  // FILTRE CQ-CI
  // ---------------------------------------------------------------------------
  private calculerScoreCQCI(question: string, serviceCode: string): number {
    let score = 0.75;
    const motsCulturels = ['ivoir', 'abidjan', 'ci', 'cote', 'afrique', 'ouest', 'fcfa', 'orange', 'mtn', 'artci'];
    const motsInterdits = ['trump', 'biden', 'ukraine', 'putin', 'israel'];
    const q = question.toLowerCase();
    motsCulturels.forEach(m => { if (q.includes(m)) score += 0.03; });
    motsInterdits.forEach(m => { if (q.includes(m)) score -= 0.20; });
    return Math.min(1.0, Math.max(0.0, score));
  }

  // ---------------------------------------------------------------------------
  // STOCKER EN BASE_GAME
  // ---------------------------------------------------------------------------
  private async stockerQuestion(q: QuizQuestion): Promise<void> {
    const expireAt = new Date();
    expireAt.setHours(23, 59, 59, 999);

    await this.prisma.yiraGameQuestion.create({
      data: {
        tenant_id:         this.tenantId,
        service_code:      q.serviceCode,
        agent_id:          q.agentName,
        question:          q.question,
        option_a:          q.optionA,
        option_b:          q.optionB,
        option_c:          q.optionC,
        bonne_rep:         q.bonneRep,
        explication:       q.explication,
        difficulte:        q.difficulte,
        actif:             false,
        moderation_statut: 'EN_ATTENTE',
        genere_at:         new Date(),
        expire_at:         expireAt,
      } as any,
    });
  }

  // ---------------------------------------------------------------------------
  // NOTIFICATION MODÉRATEURS 05h15
  // ---------------------------------------------------------------------------
  private async notifierModerateurs(nbQuestions: number): Promise<void> {
    await this.sleep(15 * 60 * 1000);
    const moderateurs: Record<string, string> = {
      SANTE:   process.env.MODERATEUR_SANTE_TEL   ?? '',
      CULTURE: process.env.MODERATEUR_CULTURE_TEL ?? '',
      CITOYEN: process.env.MODERATEUR_CITOYEN_TEL ?? '',
      EDU:     process.env.MODERATEUR_EDU_TEL     ?? '',
    };
    for (const [groupe, tel] of Object.entries(moderateurs)) {
      if (tel) {
        await this.telecom.sendModerationAlert(tel, groupe, Math.ceil(nbQuestions / 4));
        this.logger.log('[QUIZ-GEN] Alerte moderateur ' + groupe + ' → ' + tel);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // MOCK — DEV sans clé IA
  // ---------------------------------------------------------------------------
  private mockQuestion(serviceCode: string, agentName: string, sourceCsp = ''): QuizQuestion {
    return {
      serviceCode, agentName,
      question:    'Question test ' + serviceCode + (sourceCsp ? ' [CSP:' + sourceCsp + ']' : '') + ' — mode DEV',
      optionA:     'Reponse A correcte',
      optionB:     'Reponse B incorrecte',
      optionC:     'Reponse C incorrecte',
      bonneRep:    'A',
      explication: 'Explication ' + serviceCode + ' — mode developpement',
      difficulte:  1,
      cqciScore:   0.80,
      source_csp:  sourceCsp,
    };
  }

  // ---------------------------------------------------------------------------
  // GÉNÉRATION MANUELLE — Pour tests
  // ---------------------------------------------------------------------------
  async genererMaintenantPourService(serviceCode: string): Promise<QuizQuestion | null> {
    this.logger.log('[QUIZ-GEN] Generation manuelle pour ' + serviceCode);
    const question = await this.genererQuestion(serviceCode);
    if (question && question.cqciScore >= 0.75) {
      await this.stockerQuestion(question);
      return question;
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}