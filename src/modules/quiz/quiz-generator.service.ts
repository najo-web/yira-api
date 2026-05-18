// =============================================================================
// YIRA V3.0 — QuizGeneratorService
// Sprint 34 — Types de questions multiples (L2 §5)
// QCM_3, QCM_4, VRAI_FAUX, CALCUL, COMPLEMENT, SEQUENCE
// Type piloté depuis base_core.yira_config_service.type_question (Zéro Hardcode)
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import { CoreConfigService } from '../../core-config/core-config.service';
import { TelecomService } from '../../modules/telecom/telecom.service';
import { ContentSourceService } from './content-source/content-source.service';
import { PrismaClient as PrismaGame } from '.prisma/client-game';

export type TypeQuestion = 'QCM_3' | 'QCM_4' | 'VRAI_FAUX' | 'CALCUL' | 'COMPLEMENT' | 'SEQUENCE';

export interface QuizQuestion {
  serviceCode:   string;
  agentName:     string;
  typeQuestion:  TypeQuestion;
  question:      string;
  optionA:       string;
  optionB:       string;
  optionC:       string;
  optionD?:      string; // QCM_4 uniquement
  bonneRep:      string; // A/B/C/D ou VRAI/FAUX ou la réponse calculée
  explication:   string;
  difficulte:    number;
  cqciScore:     number;
  source_csp?:   string;
}

@Injectable()
export class QuizGeneratorService {
  private readonly logger   = new Logger(QuizGeneratorService.name);
  private readonly prisma   = new PrismaGame({ datasources: { db: { url: process.env.DATABASE_URL_GAME } } });
  private poolCore!: Pool;
  private readonly tenantId = 'CI';

  private readonly AGENTS: Record<string, string> = {
    ZOUGLOU:  'ZOUGLOU_AGENT',  CULTURE:  'CULTURE_AGENT',
    SPORT:    'SPORT_AGENT',    PROVERBE: 'PROVERBE_AGENT',
    QUIZIK:   'QUIZIK_AGENT',   CUISINE:  'CUISINE_AGENT',
    EDU:      'EDU_AGENT',      ALPHA:    'ALPHA_AGENT',
    HISTOIRE: 'HISTOIRE_AGENT', PALU:     'PALU_AGENT',
    DEPIST:   'DEPIST_AGENT',   MAMA:     'MAMA_AGENT',
    VACCIN:   'VACCIN_AGENT',   NUTRI:    'NUTRI_AGENT',
    HYGIENE:  'HYGIENE_AGENT',  EAU:      'EAU_AGENT',
    CANCER:   'CANCER_AGENT',   ESPRIT:   'ESPRIT_AGENT',
    HANDICAP: 'HANDICAP_AGENT', AGRI:     'AGRI_AGENT',
    METEO:    'METEO_AGENT',    FINANCE:  'FINANCE_AGENT',
    MICRO:    'MICRO_AGENT',    ACTUQUIZ: 'ACTU_AGENT',
    SECURITE: 'SECURITE_AGENT', ORIENTATION: 'ORIENTATION_AGENT',
    EMPLOI:   'EMPLOI_AGENT',   ROUTE:    'ROUTE_AGENT',
    DROIT:    'DROIT_AGENT',    FEMME:    'FEMME_AGENT',
    ELECTION: 'ELECTION_AGENT', ARNAQUE:  'ARNAQUE_AGENT',
    CONCOURS: 'CONCOURS_AGENT', SENIOR:   'SENIOR_AGENT',
    TRAVAIL:  'TRAVAIL_AGENT',  VOD:      'VOD_AGENT',
    SOS:      'SOS_AGENT',
  };

  constructor(
    private coreConfig:    CoreConfigService,
    private telecom:       TelecomService,
    private config:        ConfigService,
    private contentSource: ContentSourceService,
  ) {
    const url = config.get('DATABASE_URL_CORE');
    if (url) this.poolCore = new Pool({ connectionString: url });
  }

  // ---------------------------------------------------------------------------
  // CRON 05h00 — Génération quotidienne
  // ---------------------------------------------------------------------------
  @Cron('0 5 * * *', { timeZone: 'Africa/Abidjan' })
  async genererQuotidien(): Promise<void> {
    this.logger.log('[QUIZ-GEN] Demarrage generation quotidienne — ' + new Date().toISOString());
    let generes = 0;
    let echecs  = 0;

    for (const serviceCode of Object.keys(this.AGENTS)) {
      try {
        const question = await this.genererQuestion(serviceCode);
        if (question && question.cqciScore >= 0.75) {
          await this.stockerQuestion(question);
          generes++;
          this.logger.log('[QUIZ-GEN] OK ' + serviceCode +
            ' | type: ' + question.typeQuestion +
            ' | CQ-CI: ' + question.cqciScore +
            (question.source_csp ? ' | CSP: ' + question.source_csp : ''));
        } else {
          this.logger.warn('[QUIZ-GEN] REJETE ' + serviceCode + ' — CQ-CI: ' + (question?.cqciScore ?? 0));
          echecs++;
        }
      } catch (err: any) {
        this.logger.error('[QUIZ-GEN] ECHEC ' + serviceCode + ' — ' + err.message);
        echecs++;
      }
      await this.sleep(2000);
    }

    this.logger.log('[QUIZ-GEN] Termine — ' + generes + ' generes, ' + echecs + ' echecs');
    await this.notifierModerateurs(generes);
  }

  // ---------------------------------------------------------------------------
  // GÉNÉRER UNE QUESTION — avec type depuis base_core
  // ---------------------------------------------------------------------------
  private async genererQuestion(serviceCode: string): Promise<QuizQuestion | null> {
    const agentName   = this.AGENTS[serviceCode] ?? 'GENERIC_AGENT';
    const typeQuestion = await this.chargerTypeQuestion(serviceCode);
    const heure       = new Date().getHours();
    const mode        = heure < 12 ? 'INFO' : 'QUIZ';

    // Scraping CSP
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
      this.logger.warn('[QUIZ-GEN] CSP non disponible: ' + e.message);
    }

    const promptSystem = this.buildPromptSystem(serviceCode, typeQuestion, mode);
    const promptUser   = this.buildPromptUser(serviceCode, typeQuestion, mode, contexteCSP);

    try {
      const apiKey = this.config.get('ANTHROPIC_API_KEY') ?? '';
      if (!apiKey) return this.mockQuestion(serviceCode, agentName, typeQuestion, sourceCsp);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages:   [{ role: 'user', content: promptSystem + '\n\n' + promptUser }],
        }),
      });

      const data = await response.json() as any;
      const text = data?.content?.[0]?.text ?? '';
      const q    = this.parseReponseIA(text, serviceCode, agentName, typeQuestion);
      if (q) q.source_csp = sourceCsp;
      return q;
    } catch (err: any) {
      this.logger.error('[QUIZ-GEN] Erreur IA: ' + err.message);
      return this.mockQuestion(serviceCode, agentName, typeQuestion, sourceCsp);
    }
  }

  // ---------------------------------------------------------------------------
  // CHARGER TYPE QUESTION depuis base_core (Zéro Hardcode)
  // ---------------------------------------------------------------------------
  private async chargerTypeQuestion(serviceCode: string): Promise<TypeQuestion> {
    if (!this.poolCore) return 'QCM_3';
    let client: PoolClient | null = null;
    try {
      client = await this.poolCore.connect();
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant = 'CI'`);
      await client.query(`SET LOCAL app.current_operator_role = 'SUPER_ADMIN'`);
      await client.query(`SET LOCAL app.client_ip = '127.0.0.1'`);

      const res = await client.query(`
        SELECT type_question
        FROM core.yira_config_service
        WHERE service_code = $1 AND tenant_id = 'CI'
          AND status = 'ACTIVE' AND deleted_at IS NULL
        LIMIT 1
      `, [serviceCode]);

      await client.query('COMMIT');
      return (res.rows[0]?.type_question as TypeQuestion) ?? 'QCM_3';
    } catch {
      if (client) await client.query('ROLLBACK').catch(() => {});
      return 'QCM_3';
    } finally {
      if (client) client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // PROMPT SYSTÈME — selon le type de question
  // ---------------------------------------------------------------------------
  private buildPromptSystem(serviceCode: string, type: TypeQuestion, mode: string): string {
    const formats: Record<TypeQuestion, string> = {
      QCM_3:      'Format JSON: {"question":"...","optionA":"...","optionB":"...","optionC":"...","bonneRep":"A","explication":"...","difficulte":1}',
      QCM_4:      'Format JSON: {"question":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","bonneRep":"A","explication":"...","difficulte":2}',
      VRAI_FAUX:  'Format JSON: {"question":"Affirmation a evaluer (VRAI ou FAUX):...","optionA":"VRAI","optionB":"FAUX","optionC":"","bonneRep":"A","explication":"...","difficulte":1}',
      CALCUL:     'Format JSON: {"question":"Calcul rapide:...","optionA":"montant1","optionB":"montant2","optionC":"montant3","bonneRep":"A","explication":"...","difficulte":2}',
      COMPLEMENT: 'Format JSON: {"question":"Completez: [debut de proverbe ou phrase]...","optionA":"fin correcte","optionB":"fin incorrecte 1","optionC":"fin incorrecte 2","bonneRep":"A","explication":"...","difficulte":1}',
      SEQUENCE:   'Format JSON: {"question":"Classez dans l ordre chronologique:","optionA":"ordre correct ex: 1-2-3","optionB":"ordre incorrect 1","optionC":"ordre incorrect 2","bonneRep":"A","explication":"...","difficulte":3}',
    };

    return 'Tu es un agent editorial YIRA specialise en ' + serviceCode + ' pour la Cote dIvoire. ' +
           'Tu generes du contenu educatif adapte au contexte ivoirien. ' +
           'Toujours en francais simple. Maximum 160 caracteres par champ. ' +
           'Type de question: ' + type + '. Mode: ' + mode + '. ' +
           'Reponds UNIQUEMENT en JSON valide. ' + formats[type];
  }

  // ---------------------------------------------------------------------------
  // PROMPT UTILISATEUR — avec injection CSP
  // ---------------------------------------------------------------------------
  private buildPromptUser(serviceCode: string, type: TypeQuestion, mode: string, contexteCSP: string): string {
    const base = contexteCSP ? contexteCSP + '\n' : '';

    const instructions: Record<TypeQuestion, string> = {
      QCM_3:      'Genere une question QCM 3 choix sur ' + serviceCode + ' pour un ivoirien.',
      QCM_4:      'Genere une question QCM 4 choix difficile sur ' + serviceCode + ' (niveau concours fonction publique CI).',
      VRAI_FAUX:  'Genere une affirmation VRAI ou FAUX sur ' + serviceCode + ' adaptee au niveau primaire/college.',
      CALCUL:     'Genere un calcul simple avec des montants en FCFA sur ' + serviceCode + '. Ex: taux interet, budget, profit.',
      COMPLEMENT: 'Genere un proverbe ivoirien ou ouest-africain a completer. La fin doit etre connue.',
      SEQUENCE:   'Genere une sequence de 3 evenements historiques a classer dans l ordre chronologique.',
    };

    return base + instructions[type] +
      (contexteCSP ? ' Base-toi sur les faits ci-dessus.' : '') +
      ' Reponds en JSON uniquement.';
  }

  // ---------------------------------------------------------------------------
  // PARSER RÉPONSE IA
  // ---------------------------------------------------------------------------
  private parseReponseIA(text: string, serviceCode: string, agentName: string, typeQuestion: TypeQuestion): QuizQuestion | null {
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const data  = JSON.parse(clean);
      const cqciScore = this.calculerScoreCQCI(data.question ?? '', serviceCode);

      return {
        serviceCode, agentName, typeQuestion,
        question:    (data.question    ?? '').slice(0, 160),
        optionA:     (data.optionA     ?? '').slice(0, 60),
        optionB:     (data.optionB     ?? '').slice(0, 60),
        optionC:     (data.optionC     ?? '').slice(0, 60),
        optionD:     data.optionD ? (data.optionD ?? '').slice(0, 60) : undefined,
        bonneRep:    data.bonneRep     ?? 'A',
        explication: (data.explication ?? '').slice(0, 160),
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
    const motsCulturels = ['ivoir', 'abidjan', 'ci', 'cote', 'afrique', 'ouest', 'fcfa', 'orange', 'mtn'];
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
  // NOTIFICATION MODÉRATEURS
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
      }
    }
  }

  // ---------------------------------------------------------------------------
  // MOCK — DEV sans clé IA
  // ---------------------------------------------------------------------------
  private mockQuestion(serviceCode: string, agentName: string, typeQuestion: TypeQuestion, sourceCsp = ''): QuizQuestion {
    const mocks: Record<TypeQuestion, Partial<QuizQuestion>> = {
      QCM_3:      { question: 'Question QCM_3 test ' + serviceCode, optionA: 'Bonne reponse', optionB: 'Mauvaise 1', optionC: 'Mauvaise 2', bonneRep: 'A' },
      QCM_4:      { question: 'Question QCM_4 test ' + serviceCode, optionA: 'Bonne reponse', optionB: 'Mauvaise 1', optionC: 'Mauvaise 2', optionD: 'Mauvaise 3', bonneRep: 'A' },
      VRAI_FAUX:  { question: 'Affirmation test ' + serviceCode + ' est vraie?', optionA: 'VRAI', optionB: 'FAUX', optionC: '', bonneRep: 'A' },
      CALCUL:     { question: 'Si 1000 FCFA a 5%/mois pendant 2 mois = ?', optionA: '1100 FCFA', optionB: '1050 FCFA', optionC: '1200 FCFA', bonneRep: 'A' },
      COMPLEMENT: { question: 'Completez: L union fait...', optionA: 'la force', optionB: 'la faiblesse', optionC: 'le bonheur', bonneRep: 'A' },
      SEQUENCE:   { question: 'Classez: A)1960 B)1905 C)1842', optionA: 'C-B-A', optionB: 'A-B-C', optionC: 'B-A-C', bonneRep: 'A' },
    };

    return {
      serviceCode, agentName, typeQuestion,
      ...mocks[typeQuestion],
      explication: 'Explication ' + serviceCode + ' mode DEV',
      difficulte:  1,
      cqciScore:   0.80,
      source_csp:  sourceCsp,
    } as QuizQuestion;
  }

  // ---------------------------------------------------------------------------
  // GÉNÉRATION MANUELLE
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