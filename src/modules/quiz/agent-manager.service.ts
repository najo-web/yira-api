// =============================================================================
// YIRA V3.0 — AgentManagerService
// Sprint 51 — Orchestration 31 agents IA éditoriaux (L3 §7.1)
// Quintuplé : prompt + sources + fréquence + format + validation
// Piloté depuis base_game.yira_game_agent (Zero Hardcode)
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export interface AgentConfig {
  code:              string;
  nom:               string;
  categorie:         AgentCategorie;
  prompt_systeme:    string;
  sources_csp:       string[];
  frequence:         AgentFrequence;
  format_sortie:     AgentFormat;
  regles_validation: string[];
  actif:             boolean;
  tenant_id:         string;
  version:           number;
}

export type AgentCategorie  = 'VAS_EDITORIAL' | 'COACHING' | 'RAPPORT' | 'ANTIFRAUDE' | 'CV_LETTRE';
export type AgentFrequence  = 'QUOTIDIEN' | 'HEBDOMADAIRE' | 'BIHEBDOMADAIRE' | 'A_DEMANDE';
export type AgentFormat     = 'JSON_QCM' | 'JSON_COACHING' | 'JSON_RAPPORT' | 'JSON_CV' | 'TEXT';

export interface AgentExecution {
  agent_code:  string;
  statut:      'EN_ATTENTE' | 'EN_COURS' | 'SUCCES' | 'ECHEC' | 'REJETE_CQCI';
  debut:       Date;
  fin?:        Date;
  duree_ms?:   number;
  cqci_score?: number;
  erreur?:     string;
  tenant_id:   string;
}

export interface AgentStats {
  agent_code:        string;
  total_executions:  number;
  succes:            number;
  echecs:            number;
  taux_succes:       number;
  cqci_moyen:        number;
  derniere_exec:     string;
}

// ── Catalogue 31 agents (base mémoire → enrichi base_game en prod) ───────────
const AGENTS_CATALOGUE: Record<string, AgentConfig> = {

  // ═══════════════════════════════════════════════════════════
  // AGENTS VAS ÉDITORIAUX — 24 agents quotidiens
  // ═══════════════════════════════════════════════════════════
  ZOUGLOU_AGENT: {
    code: 'ZOUGLOU_AGENT', nom: 'Agent Zouglou CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.rfi.fr/fr/afrique', 'https://abidjan.net', 'https://connectionivoirienne.net'],
    prompt_systeme: 'Agent spécialisé Zouglou ivoirien. Magic System, Soum Bill, Yodé et Siro. Questions uniquement sur artistes et chansons CI.',
    regles_validation: ['cqci_score >= 0.75', 'mention_artiste_CI', 'no_reference_etrangere', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  CULTURE_AGENT: {
    code: 'CULTURE_AGENT', nom: 'Agent Culture CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://fratmat.info', 'https://koaci.com', 'https://www.rfi.fr/fr/afrique'],
    prompt_systeme: 'Agent culture ivoirienne. Peuples Baoulé, Dioula, Bété, Agni. Traditions, fêtes, histoire CI.',
    regles_validation: ['cqci_score >= 0.75', 'contexte_CI', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  SPORT_AGENT: {
    code: 'SPORT_AGENT', nom: 'Agent Sport CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.cafonline.com', 'https://abidjan.net/sport', 'https://www.rfi.fr/fr/sports'],
    prompt_systeme: 'Agent sport ivoirien. CAN, ASEC Mimosas, Africa Sports, Éléphants CI, Drogba, Yaya Touré.',
    regles_validation: ['cqci_score >= 0.75', 'sport_africain', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  PROVERBE_AGENT: {
    code: 'PROVERBE_AGENT', nom: 'Agent Proverbes CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://abidjan.net', 'https://connectionivoirienne.net'],
    prompt_systeme: 'Agent proverbes ivoiriens et ouest-africains. Sagesse Baoulé, Dioula, Bété, Agni, Senoufo. Valeurs communautaires CI.',
    regles_validation: ['cqci_score >= 0.75', 'proverbe_CI_Afrique', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  QUIZIK_AGENT: {
    code: 'QUIZIK_AGENT', nom: 'Agent QuiZik Musique',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://abidjan.net', 'https://connectionivoirienne.net'],
    prompt_systeme: 'Agent musique africaine et ivoirienne. Coupé-décalé, afrobeats CI, artistes ivoiriens et africains.',
    regles_validation: ['cqci_score >= 0.75', 'musique_africaine', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  CUISINE_AGENT: {
    code: 'CUISINE_AGENT', nom: 'Agent Cuisine CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://abidjan.net', 'https://connectionivoirienne.net'],
    prompt_systeme: 'Agent cuisine ivoirienne. Attiéké, foutou, aloco, garba, kedjenou, sauce graine CI.',
    regles_validation: ['cqci_score >= 0.75', 'plats_CI', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  EDU_AGENT: {
    code: 'EDU_AGENT', nom: 'Agent Education CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://fratmat.info'],
    prompt_systeme: 'Agent éducation CI. MENET, lycées CI, BEPC, BAC, universités ivoiriennes, AGEFOP, FDFP.',
    regles_validation: ['cqci_score >= 0.75', 'education_CI', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  ALPHA_AGENT: {
    code: 'ALPHA_AGENT', nom: 'Agent Alphabétisation CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://fratmat.info'],
    prompt_systeme: 'Agent alphabétisation CI. Lecture, écriture, calcul de base. Niveau primaire CI.',
    regles_validation: ['cqci_score >= 0.75', 'niveau_primaire', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  HISTOIRE_AGENT: {
    code: 'HISTOIRE_AGENT', nom: 'Agent Histoire CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.presidence.ci', 'https://fratmat.info'],
    prompt_systeme: 'Agent histoire CI. Indépendance 1960, HKB, présidents CI, CEDEAO, histoire Afrique.',
    regles_validation: ['cqci_score >= 0.75', 'histoire_CI_Afrique', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  PALU_AGENT: {
    code: 'PALU_AGENT', nom: 'Agent Paludisme CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sante.gouv.ci', 'https://www.who.int/fr/africa'],
    prompt_systeme: 'Agent paludisme CI. PNLP, moustiquaires, ACT, prévention, zones endémiques CI.',
    regles_validation: ['cqci_score >= 0.75', 'source_medicale', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  DEPIST_AGENT: {
    code: 'DEPIST_AGENT', nom: 'Agent Dépistage CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sante.gouv.ci', 'https://www.who.int/fr/africa'],
    prompt_systeme: 'Agent dépistage VIH/SIDA CI. Centres DIPE, PEPFAR CI, ARV, test dépistage gratuit CI.',
    regles_validation: ['cqci_score >= 0.75', 'source_medicale', 'no_stigmatisation', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  MAMA_AGENT: {
    code: 'MAMA_AGENT', nom: 'Agent Santé Maternelle CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sante.gouv.ci'],
    prompt_systeme: 'Agent santé maternelle CI. CPN, accouchement assisté, CHU Cocody, mortalité maternelle CI.',
    regles_validation: ['cqci_score >= 0.75', 'source_medicale', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  VACCIN_AGENT: {
    code: 'VACCIN_AGENT', nom: 'Agent Vaccination CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sante.gouv.ci'],
    prompt_systeme: 'Agent vaccination CI. PEV, vaccins obligatoires CI, calendrier vaccinal, campagnes nationales.',
    regles_validation: ['cqci_score >= 0.75', 'source_officielle_sante', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  NUTRI_AGENT: {
    code: 'NUTRI_AGENT', nom: 'Agent Nutrition CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sante.gouv.ci'],
    prompt_systeme: 'Agent nutrition CI. Malnutrition infantile, allaitement, diversification alimentaire, aliments locaux CI nutritifs.',
    regles_validation: ['cqci_score >= 0.75', 'aliments_locaux_CI', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  HYGIENE_AGENT: {
    code: 'HYGIENE_AGENT', nom: 'Agent Hygiène CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sante.gouv.ci'],
    prompt_systeme: 'Agent hygiène CI. Lavage mains, eau potable, assainissement, ONEP CI, toilettes.',
    regles_validation: ['cqci_score >= 0.75', 'hygiene_CI', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  EAU_AGENT: {
    code: 'EAU_AGENT', nom: 'Agent Eau Potable CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sodeci.ci'],
    prompt_systeme: 'Agent eau potable CI. SODECI, forages villageois, accès eau rurale CI, gestion eau.',
    regles_validation: ['cqci_score >= 0.75', 'eau_CI', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  CANCER_AGENT: {
    code: 'CANCER_AGENT', nom: 'Agent Cancer CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sante.gouv.ci'],
    prompt_systeme: 'Agent lutte cancer CI. LCCI, Centre National Oncologie, dépistage précoce CI.',
    regles_validation: ['cqci_score >= 0.75', 'source_medicale', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  ESPRIT_AGENT: {
    code: 'ESPRIT_AGENT', nom: 'Agent Santé Mentale CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sante.gouv.ci'],
    prompt_systeme: 'Agent santé mentale CI. CNPSY Bingerville, sensibilisation, déstigmatisation, accès soins CI.',
    regles_validation: ['cqci_score >= 0.75', 'no_stigmatisation', 'bienveillance', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  HANDICAP_AGENT: {
    code: 'HANDICAP_AGENT', nom: 'Agent Handicap CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.solidarite.gouv.ci'],
    prompt_systeme: 'Agent handicap CI. Inclusion scolaire, CNSS CI, associations handicap, droits légaux CI.',
    regles_validation: ['cqci_score >= 0.75', 'inclusion', 'no_stigmatisation', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  AGRI_AGENT: {
    code: 'AGRI_AGENT', nom: 'Agent Agriculture CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.agriculture.gouv.ci', 'https://www.anader.ci'],
    prompt_systeme: 'Agent agriculture CI. Cacao, café, anacarde, hévéa, ANADER, coopératives CI.',
    regles_validation: ['cqci_score >= 0.75', 'agriculture_CI', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  METEO_AGENT: {
    code: 'METEO_AGENT', nom: 'Agent Météo CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sodexam.com'],
    prompt_systeme: 'Agent météo CI. SODEXAM, saisons des pluies, harmattan, prévisions agricoles CI.',
    regles_validation: ['cqci_score >= 0.75', 'meteo_CI', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  FINANCE_AGENT: {
    code: 'FINANCE_AGENT', nom: 'Agent Finance CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.bceao.int', 'https://www.orange.ci'],
    prompt_systeme: 'Agent finance CI. Orange Money, MTN Money, Wave, COOPEC, BCEAO, taux intérêt FCFA.',
    regles_validation: ['cqci_score >= 0.75', 'montants_FCFA', 'services_CI', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  MICRO_AGENT: {
    code: 'MICRO_AGENT', nom: 'Agent Microfinance CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://abidjan.net'],
    prompt_systeme: 'Agent microfinance CI. FAFCI, AGR femmes, PARE-CI, financement PME CI, COOPEC.',
    regles_validation: ['cqci_score >= 0.75', 'microfinance_CI', 'montants_FCFA', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  ACTUQUIZ_AGENT: {
    code: 'ACTUQUIZ_AGENT', nom: 'Agent ActuQuiz CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://fratmat.info', 'https://koaci.com', 'https://abidjan.net'],
    prompt_systeme: 'Agent actualité ivoirienne et CEDEAO. RTI, Fraternité Matin, KOACI, actualités du jour CI.',
    regles_validation: ['cqci_score >= 0.75', 'actualite_CI', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },

  // ═══════════════════════════════════════════════════════════
  // AGENTS COACHING — 4 agents
  // ═══════════════════════════════════════════════════════════
  VIEUX_PERE_AGENT: {
    code: 'VIEUX_PERE_AGENT', nom: 'Agent Vieux Père',
    categorie: 'COACHING', frequence: 'A_DEMANDE', format_sortie: 'JSON_COACHING',
    sources_csp: [],
    prompt_systeme: 'Tu es le Vieux Père YIRA. Sage, bienveillant, ancré dans les valeurs communautaires ivoiriennes. Tu parles à des jeunes hommes CI. Toujours encourageant, jamais condescendant.',
    regles_validation: ['ton_bienveillant', 'references_CI', 'max_200_mots', 'no_jugement'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  GRANDE_SOEUR_AGENT: {
    code: 'GRANDE_SOEUR_AGENT', nom: 'Agent Grande Sœur',
    categorie: 'COACHING', frequence: 'A_DEMANDE', format_sortie: 'JSON_COACHING',
    sources_csp: [],
    prompt_systeme: 'Tu es la Grande Sœur YIRA. Chaleureuse, empathique, adaptée aux jeunes femmes CI. Tu encourages l autonomie et l ambition féminine ivoirienne.',
    regles_validation: ['ton_chaleureux', 'references_femmes_CI', 'max_200_mots', 'no_jugement'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  CONSEILLER_OFFICIEL_AGENT: {
    code: 'CONSEILLER_OFFICIEL_AGENT', nom: 'Agent Conseiller Officiel',
    categorie: 'COACHING', frequence: 'A_DEMANDE', format_sortie: 'JSON_COACHING',
    sources_csp: [],
    prompt_systeme: 'Tu es le Conseiller Officiel YIRA B2G. Ton ton est formel, institutionnel, adapté aux ministères et bailleurs. Tu cites les textes officiels CI et les normes internationales.',
    regles_validation: ['ton_formel', 'references_officielles_CI', 'max_300_mots', 'conformite_ISO'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  COACH_SPORTIF_AGENT: {
    code: 'COACH_SPORTIF_AGENT', nom: 'Agent Coach Sportif',
    categorie: 'COACHING', frequence: 'A_DEMANDE', format_sortie: 'JSON_COACHING',
    sources_csp: [],
    prompt_systeme: 'Tu es le Coach Sportif YIRA-CONCOURS. Intense, motivant, comme un entraîneur CI. Tu prépares les candidats aux concours de la fonction publique.',
    regles_validation: ['ton_motivant', 'references_sport_CI', 'max_150_mots'],
    actif: true, tenant_id: 'CI', version: 3,
  },

  // ═══════════════════════════════════════════════════════════
  // AGENT RAPPORT — 1 agent
  // ═══════════════════════════════════════════════════════════
  RAPPORT_AGENT: {
    code: 'RAPPORT_AGENT', nom: 'Agent Génération Rapports',
    categorie: 'RAPPORT', frequence: 'A_DEMANDE', format_sortie: 'JSON_RAPPORT',
    sources_csp: [],
    prompt_systeme: 'Tu génères des Passeports de Compétences YIRA. Style institutionnel, précis, certifiable. Rapports conformes ISO 10667 adaptés au contexte CI.',
    regles_validation: ['format_institutionnel', 'conformite_ISO_10667', 'certification_YIRA'],
    actif: true, tenant_id: 'CI', version: 3,
  },

  // ═══════════════════════════════════════════════════════════
  // AGENT ANTIFRAUDE — 1 agent
  // ═══════════════════════════════════════════════════════════
  ANTIFRAUDE_AGENT: {
    code: 'ANTIFRAUDE_AGENT', nom: 'Agent Validation Antifraude',
    categorie: 'ANTIFRAUDE', frequence: 'A_DEMANDE', format_sortie: 'JSON_RAPPORT',
    sources_csp: [],
    prompt_systeme: 'Tu analyses les patterns suspects dans les évaluations YIRA. Tu détectes incohérences, réponses automatiques, fraudes VAS. Avis binaire VALIDE/SUSPECT avec justification.',
    regles_validation: ['analyse_patterns', 'justification_obligatoire', 'taux_faux_positifs_max_5pct'],
    actif: true, tenant_id: 'CI', version: 3,
  },

  // ═══════════════════════════════════════════════════════════
  // AGENT CV & LETTRE — 1 agent
  // ═══════════════════════════════════════════════════════════
  CV_LETTRE_AGENT: {
    code: 'CV_LETTRE_AGENT', nom: 'Agent CV & Lettre CI',
    categorie: 'CV_LETTRE', frequence: 'A_DEMANDE', format_sortie: 'JSON_CV',
    sources_csp: [],
    prompt_systeme: 'Tu génères des CV et lettres de motivation inculturés CI. Format standard ivoirien, références locales, ton adapté au marché CI. Mentions AGEFOP, CNSS, entreprises CI si pertinent.',
    regles_validation: ['format_CV_CI', 'references_marche_CI', 'ton_professionnel', 'max_500_mots'],
    actif: true, tenant_id: 'CI', version: 3,
  },
};

@Injectable()
export class AgentManagerService implements OnModuleInit {
  private readonly logger = new Logger(AgentManagerService.name);
  private pool!:      Pool;
  private ready =     false;
  private agents:     Map<string, AgentConfig>        = new Map();
  private executions: Map<string, AgentExecution[]>   = new Map();

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_GAME') });
      const c    = await this.pool.connect();
      c.release();
      this.ready = true;
      await this.chargerAgents();
      this.logger.log('[AGENT-MGR] AgentManager prêt — ' + this.agents.size + ' agents chargés');
    } catch (e: any) {
      Object.values(AGENTS_CATALOGUE).forEach(a => this.agents.set(a.code, a));
      this.logger.warn('[AGENT-MGR] Mode local — ' + this.agents.size + ' agents depuis catalogue');
    }
  }

  private async chargerAgents(): Promise<void> {
    try {
      const res = await this.pool.query(`
        SELECT code, nom, categorie, prompt_systeme, sources_csp,
               frequence, format_sortie, regles_validation, actif, version
        FROM yira_game_agent WHERE tenant_id = 'CI' AND actif = true
      `);
      if (res.rows.length > 0) {
        res.rows.forEach(row => this.agents.set(row.code, { ...row, sources_csp: row.sources_csp ?? [], regles_validation: row.regles_validation ?? [], tenant_id: 'CI' }));
        this.logger.log('[AGENT-MGR] ' + res.rows.length + ' agents depuis base_game');
      } else {
        Object.values(AGENTS_CATALOGUE).forEach(a => this.agents.set(a.code, a));
        this.logger.log('[AGENT-MGR] Catalogue local — ' + this.agents.size + ' agents');
      }
    } catch {
      Object.values(AGENTS_CATALOGUE).forEach(a => this.agents.set(a.code, a));
    }
  }

  getAgent(code: string): AgentConfig | null {
    return this.agents.get(code) ?? null;
  }

  listerAgents(categorie?: AgentCategorie): AgentConfig[] {
    const tous = Array.from(this.agents.values());
    return categorie ? tous.filter(a => a.categorie === categorie) : tous;
  }

  enregistrerExecution(agentCode: string, exec: AgentExecution): void {
    const hist = this.executions.get(agentCode) ?? [];
    hist.push(exec);
    if (hist.length > 100) hist.shift();
    this.executions.set(agentCode, hist);
  }

  getStats(agentCode?: string): AgentStats[] {
    const codes = agentCode ? [agentCode] : Array.from(this.agents.keys());
    return codes.map(code => {
      const hist     = this.executions.get(code) ?? [];
      const succes   = hist.filter(e => e.statut === 'SUCCES').length;
      const echecs   = hist.filter(e => e.statut === 'ECHEC').length;
      const cqciVals = hist.filter(e => e.cqci_score).map(e => e.cqci_score!);
      const cqciMoy  = cqciVals.length > 0 ? Math.round(cqciVals.reduce((a,b) => a+b,0) / cqciVals.length * 100) / 100 : 0;
      return {
        agent_code: code, total_executions: hist.length, succes, echecs,
        taux_succes: hist.length > 0 ? Math.round(succes / hist.length * 100) : 0,
        cqci_moyen: cqciMoy,
        derniere_exec: hist.length > 0 ? hist[hist.length-1].debut.toISOString() : 'jamais',
      };
    });
  }

  getDashboard(): any {
    const tous   = this.listerAgents();
    const parCat = tous.reduce((acc, a) => { acc[a.categorie] = (acc[a.categorie] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    return {
      total_agents:     tous.length,
      agents_actifs:    tous.filter(a => a.actif).length,
      par_categorie:    parCat,
      agents_quotidiens: tous.filter(a => a.frequence === 'QUOTIDIEN').length,
      agents_a_demande: tous.filter(a => a.frequence === 'A_DEMANDE').length,
      conformite:       'Zero Hardcode — paramètres pilotés base_game.yira_game_agent',
      tenant_id:        'CI',
      timestamp:        new Date().toISOString(),
    };
  }

  async rechargerAgents(): Promise<number> {
    this.agents.clear();
    await this.chargerAgents();
    return this.agents.size;
  }

  ping(): string {
    return 'AgentManager OK — ' + this.agents.size + ' agents | ' +
      this.listerAgents('VAS_EDITORIAL').length + ' VAS + ' +
      this.listerAgents('COACHING').length + ' Coaching + ' +
      this.listerAgents('RAPPORT').length + ' Rapport';
  }
}