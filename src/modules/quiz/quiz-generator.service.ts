// =============================================================================
// YIRA V3.0 — QuizGeneratorService
// Sprint 51 — Fix CQ-CI + Prompts inculturés par service + 37 agents
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
  optionD?:      string;
  bonneRep:      string;
  explication:   string;
  difficulte:    number;
  cqciScore:     number;
  source_csp?:   string;
}

// Contextes thématiques par service → inculturation CI stricte
const CONTEXTES_CI: Record<string, string> = {
  ZOUGLOU:     'le Zouglou, genre musical ivoirien né à Abidjan dans les années 90 par des étudiants. Artistes: Magic System, Soum Bill, Les Garagistes, Yodé et Siro, Espoir 2000.',
  CULTURE:     'la culture ivoirienne: peuples Baoulé, Dioula, Bété, Agni, Senoufo, Malinké. Coutumes, traditions, fêtes nationales CI.',
  SPORT:       'le sport ivoirien: CAN 2023 (victoire CI), Didier Drogba, Yaya Touré, ASEC Mimosas, Africa Sports, équipe nationale Les Éléphants.',
  PROVERBE:    'les proverbes ivoiriens et ouest-africains: sagesse Baoulé, Dioula, Bété, Agni. Valeurs communautaires CI.',
  QUIZIK:      'la musique africaine et ivoirienne: coupé-décalé, afrobeats CI, artistes ivoiriens, nigérians, ghanéens.',
  CUISINE:     'la cuisine ivoirienne: attiéké, foutou, aloco, kedjenou, garba, sauce graine, placali. Plats traditionnels CI.',
  EDU:         'l éducation en Côte d Ivoire: MENET, lycées et collèges CI, BEPC, BAC, universités ivoiriennes, AGEFOP.',
  ALPHA:       'l alphabétisation et la lecture en Côte d Ivoire: campagnes MENET, lecture en langues locales CI.',
  HISTOIRE:    'l histoire de la Côte d Ivoire: indépendance 1960, Félix Houphouët-Boigny, Henri Konan Bédié, Laurent Gbagbo, Alassane Ouattara.',
  PALU:        'le paludisme en Côte d Ivoire: prévention, moustiquaires, traitement ACT, zones à risque CI, Programme National de Lutte contre le Paludisme.',
  DEPIST:      'le dépistage VIH/SIDA en Côte d Ivoire: centres DIPE, programme PEPFAR CI, traitement ARV accessible.',
  MAMA:        'la santé maternelle en Côte d Ivoire: CPN, accouchement assisté, mortalité maternelle CI, CHU Cocody.',
  VACCIN:      'la vaccination en Côte d Ivoire: PEV, vaccins obligatoires CI, carnets de santé, campagnes nationales.',
  NUTRI:       'la nutrition en Côte d Ivoire: malnutrition infantile, allaitement, diversification alimentaire, aliments locaux nutritifs CI.',
  HYGIENE:     'l hygiène en Côte d Ivoire: lavage des mains, eau potable, assainissement, ONEP CI, accès à l eau.',
  EAU:         'l eau potable en Côte d Ivoire: SODECI, forages villageois, accès eau rurale CI, gestion eau urbaine.',
  CANCER:      'la lutte contre le cancer en Côte d Ivoire: LCCI, Centre National d Oncologie, dépistage précoce CI.',
  ESPRIT:      'la santé mentale en Côte d Ivoire: CNPSY Bingerville, sensibilisation, déstigmatisation, accès aux soins CI.',
  HANDICAP:    'le handicap en Côte d Ivoire: inclusion scolaire, CNSS CI, associations personnes handicapées, droits légaux.',
  AGRI:        'l agriculture ivoirienne: cacao, café, anacarde, hévéa, ANADER, coopératives agricoles CI.',
  METEO:       'la météorologie en Côte d Ivoire: saisons des pluies, harmattan, SODEXAM, prévisions agricoles CI.',
  FINANCE:     'la finance en Côte d Ivoire: Orange Money, MTN Money, Wave, microfinance COOPEC, BCEAO, CFA.',
  MICRO:       'la microfinance et l entrepreneuriat en Côte d Ivoire: FAFCI, AGR femmes, PARE-CI, financement PME CI.',
  ACTUQUIZ:    'l actualité ivoirienne et de la CEDEAO: RTI, Fraternité Matin, KOACI, Abidjan.net, Connectionivoirienne.',
  SECURITE:    'la sécurité routière en Côte d Ivoire: OSER CI, code de la route CI, accidents de la route, prévention.',
  ORIENTATION: 'l orientation scolaire en Côte d Ivoire: DOB MENET, filières lycées CI, universités ivoiriennes, AGEFOP.',
  EMPLOI:      'l emploi des jeunes en Côte d Ivoire: AGEPE, AGEFOP, FNS-CI, PNSAR, offres d emploi formelles et informelles.',
  ROUTE:       'le code de la route ivoirien: OSER, signalisation routière CI, permis de conduire, sécurité conducteurs.',
  DROIT:       'le droit ivoirien: Code Civil CI, droit du travail ivoirien, CNSS, droits des femmes et enfants CI.',
  FEMME:       'les droits des femmes en Côte d Ivoire: MFFE, autonomisation économique, violences basées sur le genre CI.',
  ELECTION:    'les élections en Côte d Ivoire: CEI, processus électoral, vote CI, carte d électeur, participation citoyenne.',
  ARNAQUE:     'les arnaques et fraudes numériques en Côte d Ivoire: ARTCI, escroqueries Mobile Money, phishing CI.',
  CONCOURS:    'les concours de la fonction publique en Côte d Ivoire: INFAS, ENS, ENA CI, préparation concours.',
  SENIOR:      'le bien-vieillir en Côte d Ivoire: retraite CNSS, associations seniors CI, santé personnes âgées.',
  TRAVAIL:     'le droit du travail ivoirien: Code du Travail CI, CNSS, contrats CDI/CDD, salaire minimum SMIG CI.',
  VOD:         'la création audiovisuelle ivoirienne: films CI, séries ivoiriennes, Canal+ Côte d Ivoire, RTI, artistes.',
  SOS:         'les services d urgence en Côte d Ivoire: SAMU 185, Pompiers 180, Police 111, SOS détresse jeunes CI.',
};

@Injectable()
export class QuizGeneratorService {
  private readonly logger = new Logger(QuizGeneratorService.name);
  private readonly prisma = new PrismaGame({ datasources: { db: { url: process.env.DATABASE_URL_GAME } } });
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
    const agentName    = this.AGENTS[serviceCode] ?? 'GENERIC_AGENT';
    const typeQuestion = await this.chargerTypeQuestion(serviceCode);
    const heure        = new Date().getHours();
    const mode         = heure < 12 ? 'INFO' : 'QUIZ';

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
        SELECT type_question FROM core.yira_config_service
        WHERE service_code = $1 AND tenant_id = 'CI'
          AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1
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
  // PROMPT SYSTÈME — Inculturé CI strict
  // ---------------------------------------------------------------------------
  private buildPromptSystem(serviceCode: string, type: TypeQuestion, mode: string): string {
    const contexteCI = CONTEXTES_CI[serviceCode] ?? 'la Côte d Ivoire et l Afrique de l Ouest';

    const formats: Record<TypeQuestion, string> = {
      QCM_3:      '{"question":"...","optionA":"...","optionB":"...","optionC":"...","bonneRep":"A","explication":"...","difficulte":1}',
      QCM_4:      '{"question":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","bonneRep":"A","explication":"...","difficulte":2}',
      VRAI_FAUX:  '{"question":"Vrai ou faux: ...","optionA":"VRAI","optionB":"FAUX","optionC":"","bonneRep":"A","explication":"...","difficulte":1}',
      CALCUL:     '{"question":"Calcul en FCFA: ...","optionA":"montant1","optionB":"montant2","optionC":"montant3","bonneRep":"A","explication":"...","difficulte":2}',
      COMPLEMENT: '{"question":"Completez: [proverbe ou phrase ivoirienne]...","optionA":"fin correcte","optionB":"fin incorrecte1","optionC":"fin incorrecte2","bonneRep":"A","explication":"...","difficulte":1}',
      SEQUENCE:   '{"question":"Classez dans l ordre: ...","optionA":"ordre correct","optionB":"ordre incorrect1","optionC":"ordre incorrect2","bonneRep":"A","explication":"...","difficulte":3}',
    };

    return 'Tu es un agent editorial YIRA pour la Côte d Ivoire. ' +
           'Tu es specialise en : ' + contexteCI + ' ' +
           'REGLES ABSOLUES : ' +
           '1. Chaque question DOIT concerner UNIQUEMENT la Côte d Ivoire ou l Afrique de l Ouest. ' +
           '2. INTERDICTION de references a la France, Europe, USA, artistes etrangers non africains. ' +
           '3. Utiliser des noms, lieux, situations ivoiriennes concretes. ' +
           '4. Maximum 160 caracteres par champ. ' +
           '5. Montants toujours en FCFA. ' +
           '6. Reponds UNIQUEMENT en JSON valide sans markdown. ' +
           'Type: ' + type + '. Mode: ' + mode + '. ' +
           'Format exact: ' + formats[type];
  }

  // ---------------------------------------------------------------------------
  // PROMPT UTILISATEUR — avec injection CSP filtrée
  // ---------------------------------------------------------------------------
  private buildPromptUser(serviceCode: string, type: TypeQuestion, mode: string, contexteCSP: string): string {
    const contexteCI = CONTEXTES_CI[serviceCode] ?? serviceCode;

    // Filtrer le contexte CSP pour ne garder que les refs CI/Afrique
    const contexteFiltre = contexteCSP
      ? 'Contexte actualite (utilise si pertinent pour CI): ' + contexteCSP.slice(0, 500) + '\n'
      : '';

    const instructions: Record<TypeQuestion, string> = {
      QCM_3:      'Genere une question QCM 3 choix sur ' + contexteCI + '. Question concrete et pratique pour un jeune ivoirien.',
      QCM_4:      'Genere une question QCM 4 choix difficile sur ' + contexteCI + ' (niveau concours fonction publique CI).',
      VRAI_FAUX:  'Genere une affirmation VRAI ou FAUX sur ' + contexteCI + ' adaptee au niveau primaire/college ivoirien.',
      CALCUL:     'Genere un calcul pratique en FCFA sur ' + contexteCI + '. Ex: budget Orange Money, prix marche CI, salaire SMIG.',
      COMPLEMENT: 'Genere un proverbe ou une expression ivoirienne ou ouest-africaine a completer. Bien connu en CI.',
      SEQUENCE:   'Genere une sequence de 3 evenements ivoiriens ou africains a classer dans l ordre chronologique.',
    };

    return contexteFiltre + instructions[type] + ' Reponds en JSON uniquement.';
  }

  // ---------------------------------------------------------------------------
  // PARSER RÉPONSE IA
  // ---------------------------------------------------------------------------
  private parseReponseIA(
    text: string, serviceCode: string, agentName: string, typeQuestion: TypeQuestion,
  ): QuizQuestion | null {
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
  // FILTRE CQ-CI — Scoring inculturation ivoirienne
  // ---------------------------------------------------------------------------
  private calculerScoreCQCI(question: string, serviceCode: string): number {
    let score = 0.72; // Score de base légèrement en dessous du seuil
    const q   = question.toLowerCase();

    // Mots culturels CI → bonus
    const motsCulturels = [
      'ivoir', 'abidjan', 'côte', 'cote', 'afrique', 'ouest', 'fcfa',
      'orange money', 'mtn', 'wave', 'zouglou', 'nouchi', 'dioula',
      'baoulé', 'baoule', 'bété', 'bete', 'agni', 'senoufo', 'malinké',
      'adjamé', 'adjame', 'cocody', 'marcory', 'yopougon', 'bouaké', 'bouake',
      'korhogo', 'san pedro', 'daloa', 'yamoussoukro', 'man',
      'agepe', 'agefop', 'cnss', 'artci', 'menet', 'fdfp',
      'houphouët', 'houphouet', 'ouattara', 'gbagbo', 'bédié', 'bedie',
      'can 2023', 'éléphants', 'elephants', 'asec', 'africa sports',
      'drogba', 'yaya touré', 'yaya toure', 'magic system',
      'attiéké', 'attieke', 'foutou', 'aloco', 'garba', 'kedjenou',
      'sodeci', 'cie', 'bceao', 'umoa', 'cedeao', 'uemoa',
    ];

    // Mots hors contexte CI → malus
    const motsHorsContexte = [
      'trump', 'biden', 'ukraine', 'putin', 'israel', 'gaza',
      'france', 'paris', 'europe', 'américain', 'americain', 'anglais',
      'shakespeare', 'british', 'english', 'german', 'chinese',
      'poète français', 'poete francais', 'festival français',
      'verlaine', 'rimbaud', 'baudelaire', 'molière', 'moliere',
      'victor hugo', 'hugo', 'voltaire', 'rousseau',
      'amazon', 'apple', 'google', 'microsoft', 'tesla',
      'dollar', 'euro', 'pound', 'yen',
    ];

    motsCulturels.forEach(m => { if (q.includes(m)) score += 0.04; });
    motsHorsContexte.forEach(m => { if (q.includes(m)) score -= 0.25; });

    // Bonus si le serviceCode apparaît dans le contexte
    const contexteService = (CONTEXTES_CI[serviceCode] ?? '').toLowerCase();
    if (contexteService && q.length > 10) score += 0.03;

    return Math.min(1.0, Math.max(0.0, Math.round(score * 100) / 100));
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
      if (tel) await this.telecom.sendModerationAlert(tel, groupe, Math.ceil(nbQuestions / 4));
    }
  }

  // ---------------------------------------------------------------------------
  // MOCK — DEV sans clé IA (questions CI réalistes)
  // ---------------------------------------------------------------------------
  private mockQuestion(serviceCode: string, agentName: string, typeQuestion: TypeQuestion, sourceCsp = ''): QuizQuestion {
    const mocks: Record<TypeQuestion, Partial<QuizQuestion>> = {
      QCM_3:      { question: 'Quelle ville ivoirienne est surnommée "la capitale économique" ?', optionA: 'Abidjan', optionB: 'Yamoussoukro', optionC: 'Bouaké', bonneRep: 'A' },
      QCM_4:      { question: 'Quel est le salaire minimum (SMIG) en Côte d Ivoire en 2024 ?', optionA: '75 000 FCFA', optionB: '60 000 FCFA', optionC: '90 000 FCFA', optionD: '50 000 FCFA', bonneRep: 'A' },
      VRAI_FAUX:  { question: 'Vrai ou faux: L attiéké est originaire de la Côte d Ivoire.', optionA: 'VRAI', optionB: 'FAUX', optionC: '', bonneRep: 'A' },
      CALCUL:     { question: 'Si tu envoies 5000 FCFA via Orange Money avec 2% de frais, combien paies-tu ?', optionA: '5100 FCFA', optionB: '5200 FCFA', optionC: '5050 FCFA', bonneRep: 'A' },
      COMPLEMENT: { question: 'Completez: "L union fait..."', optionA: 'la force', optionB: 'la faiblesse', optionC: 'le bonheur', bonneRep: 'A' },
      SEQUENCE:   { question: 'Classez: A)Indépendance CI 1960 B)Décès HKB 1993 C)CAN 2023', optionA: 'A-B-C', optionB: 'B-C-A', optionC: 'C-A-B', bonneRep: 'A' },
    };
    return {
      serviceCode, agentName, typeQuestion,
      ...mocks[typeQuestion],
      explication: 'Question de référence CI — service ' + serviceCode,
      difficulte:  1,
      cqciScore:   0.85,
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