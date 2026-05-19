// =============================================================================
// YIRA V3.0 — AgentManagerService
// Sprint 51 — Orchestration 24 agents IA éditoriaux (L3 §7.1)
// Quintuplé : prompt + sources + fréquence + format + validation
// Piloté depuis base_game.yira_game_agent (Zero Hardcode)
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

// ── Types L3 §7.1 ─────────────────────────────────────────────────────────────
export interface AgentConfig {
  code:           string;          // ex: ZOUGLOU_AGENT
  nom:            string;          // nom lisible
  categorie:      AgentCategorie;
  prompt_systeme: string;          // prompt IA stocké en base
  sources_csp:    string[];        // URLs scraping autorisées
  frequence:      AgentFrequence;  // QUOTIDIEN, HEBDO, BIHEBDO
  format_sortie:  AgentFormat;     // JSON_QCM, JSON_COACHING, JSON_RAPPORT
  regles_validation: string[];     // règles CQ-CI + contenu
  actif:          boolean;
  tenant_id:      string;
  version:        number;
}

export type AgentCategorie =
  | 'VAS_EDITORIAL'    // 24 agents génération questions VAS
  | 'COACHING'         // Vieux Père, Grande Sœur, Officiel, Sportif
  | 'RAPPORT'          // Génération Passeports + rapports
  | 'ANTIFRAUDE'       // Validation patterns suspects
  | 'CV_LETTRE';       // Génération CV et lettres

export type AgentFrequence  = 'QUOTIDIEN' | 'HEBDOMADAIRE' | 'BIHEBDOMADAIRE' | 'A_DEMANDE';
export type AgentFormat     = 'JSON_QCM' | 'JSON_COACHING' | 'JSON_RAPPORT' | 'JSON_CV' | 'TEXT';

export interface AgentExecution {
  agent_code:    string;
  statut:        'EN_ATTENTE' | 'EN_COURS' | 'SUCCES' | 'ECHEC' | 'REJETE_CQCI';
  debut:         Date;
  fin?:          Date;
  duree_ms?:     number;
  cqci_score?:   number;
  erreur?:       string;
  tenant_id:     string;
}

export interface AgentStats {
  agent_code:      string;
  total_executions: number;
  succes:          number;
  echecs:          number;
  taux_succes:     number;
  cqci_moyen:      number;
  derniere_exec:   string;
}

// ── Catalogue agents (base en mémoire — enrichi depuis base_game en prod) ─────
const AGENTS_CATALOGUE: Record<string, AgentConfig> = {
  // ── Agents VAS éditoriaux (24) ─────────────────────────────────────────────
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
  SANTE_AGENT: {
    code: 'SANTE_AGENT', nom: 'Agent Santé CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.sante.gouv.ci', 'https://www.who.int/fr/africa', 'https://www.inhp.ci'],
    prompt_systeme: 'Agent santé publique CI. INHP, Ministère Santé CI, maladies tropicales, prévention.',
    regles_validation: ['cqci_score >= 0.75', 'source_sante_officielle', 'no_automédication', 'max_160_chars'],
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
  EMPLOI_AGENT: {
    code: 'EMPLOI_AGENT', nom: 'Agent Emploi CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.agepe.ci', 'https://www.emploi.gouv.ci', 'https://abidjan.net/emploi'],
    prompt_systeme: 'Agent emploi jeunes CI. AGEPE, AGEFOP, FNS-CI, offres emploi, SMIG, contrats CI.',
    regles_validation: ['cqci_score >= 0.75', 'contexte_emploi_CI', 'montants_FCFA', 'max_160_chars'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  FINANCE_AGENT: {
    code: 'FINANCE_AGENT', nom: 'Agent Finance CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://www.bceao.int', 'https://www.orange.ci', 'https://wave.com/fr'],
    prompt_systeme: 'Agent finance CI. Orange Money, MTN Money, Wave, COOPEC, BCEAO, taux intérêt FCFA.',
    regles_validation: ['cqci_score >= 0.75', 'montants_FCFA', 'services_CI', 'max_160_chars'],
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
  CUISINE_AGENT: {
    code: 'CUISINE_AGENT', nom: 'Agent Cuisine CI',
    categorie: 'VAS_EDITORIAL', frequence: 'QUOTIDIEN', format_sortie: 'JSON_QCM',
    sources_csp: ['https://abidjan.net', 'https://connectionivoirienne.net'],
    prompt_systeme: 'Agent cuisine ivoirienne. Attiéké, foutou, aloco, garba, kedjenou, sauce graine CI.',
    regles_validation: ['cqci_score >= 0.75', 'plats_CI', 'max_160_chars'],
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
  // ── Agents Coaching (4) ────────────────────────────────────────────────────
  VIEUX_PERE_AGENT: {
    code: 'VIEUX_PERE_AGENT', nom: 'Agent Vieux Père',
    categorie: 'COACHING', frequence: 'A_DEMANDE', format_sortie: 'JSON_COACHING',
    sources_csp: [],
    prompt_systeme: 'Tu es le Vieux Père YIRA. Ton coaching est sage, bienveillant, ancré dans les valeurs communautaires ivoiriennes. Tu parles à des jeunes hommes CI. Toujours encourageant, jamais condescendant.',
    regles_validation: ['ton_bienveillant', 'references_CI', 'max_200_mots', 'no_jugement'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  GRANDE_SOEUR_AGENT: {
    code: 'GRANDE_SOEUR_AGENT', nom: 'Agent Grande Sœur',
    categorie: 'COACHING', frequence: 'A_DEMANDE', format_sortie: 'JSON_COACHING',
    sources_csp: [],
    prompt_systeme: 'Tu es la Grande Sœur YIRA. Ton coaching est chaleureux, empathique, adapté aux jeunes femmes CI. Tu comprends les réalités des femmes ivoiriennes. Tu encourages l autonomie et l ambition.',
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
    prompt_systeme: 'Tu es le Coach Sportif YIRA-CONCOURS. Ton coaching est intense, motivant, comme un entraîneur de foot CI. Tu prépares les candidats aux concours de la fonction publique.',
    regles_validation: ['ton_motivant', 'references_sport_CI', 'max_150_mots'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  // ── Agent Rapport (1) ──────────────────────────────────────────────────────
  RAPPORT_AGENT: {
    code: 'RAPPORT_AGENT', nom: 'Agent Génération Rapports',
    categorie: 'RAPPORT', frequence: 'A_DEMANDE', format_sortie: 'JSON_RAPPORT',
    sources_csp: [],
    prompt_systeme: 'Tu génères des Passeports de Compétences YIRA. Ton style est institutionnel, précis, certifiable. Tu produis des rapports conformes ISO 10667 adaptés au contexte CI.',
    regles_validation: ['format_institutionnel', 'conformite_ISO_10667', 'certification_YIRA'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  // ── Agent Antifraude (1) ──────────────────────────────────────────────────
  ANTIFRAUDE_AGENT: {
    code: 'ANTIFRAUDE_AGENT', nom: 'Agent Validation Antifraude',
    categorie: 'ANTIFRAUDE', frequence: 'A_DEMANDE', format_sortie: 'JSON_RAPPORT',
    sources_csp: [],
    prompt_systeme: 'Tu analyses les patterns suspects dans les évaluations YIRA. Tu détectes les incohérences, les réponses automatiques, les fraudes VAS. Tu produis un avis binaire VALIDE/SUSPECT avec justification.',
    regles_validation: ['analyse_patterns', 'justification_obligatoire', 'taux_faux_positifs_max_5pct'],
    actif: true, tenant_id: 'CI', version: 3,
  },
  // ── Agent CV & Lettre (1) ─────────────────────────────────────────────────
  CV_LETTRE_AGENT: {
    code: 'CV_LETTRE_AGENT', nom: 'Agent CV & Lettre CI',
    categorie: 'CV_LETTRE', frequence: 'A_DEMANDE', format_sortie: 'JSON_CV',
    sources_csp: [],
    prompt_systeme: 'Tu génères des CV et lettres de motivation inculturés CI. Format standard ivoirien, références locales, ton adapté au marché CI. Mentions AGEFOP, CNSS, entreprises CI connues si pertinent.',
    regles_validation: ['format_CV_CI', 'references_marche_CI', 'ton_professionnel', 'max_500_mots'],
    actif: true, tenant_id: 'CI', version: 3,
  },
};

@Injectable()
export class AgentManagerService implements OnModuleInit {
  private readonly logger = new Logger(AgentManagerService.name);
  private pool!: Pool;
  private ready  = false;
  private agents: Map<string, AgentConfig>    = new Map();
  private executions: Map<string, AgentExecution[]> = new Map();

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_GAME') });
      const c    = await this.pool.connect();
      c.release();
      this.ready = true;

      // Charger les agents depuis le catalogue
      await this.chargerAgents();
      this.logger.log('[AGENT-MGR] AgentManager prêt — ' + this.agents.size + ' agents chargés');
    } catch (e: any) {
      // Fallback sur catalogue local
      Object.values(AGENTS_CATALOGUE).forEach(a => this.agents.set(a.code, a));
      this.logger.warn('[AGENT-MGR] Mode local — ' + this.agents.size + ' agents depuis catalogue');
    }
  }

  // ---------------------------------------------------------------------------
  // CHARGER AGENTS depuis base_game (Zero Hardcode)
  // ---------------------------------------------------------------------------
  private async chargerAgents(): Promise<void> {
    try {
      const res = await this.pool.query(`
        SELECT code, nom, categorie, prompt_systeme, sources_csp,
               frequence, format_sortie, regles_validation, actif, version
        FROM yira_game_agent
        WHERE tenant_id = 'CI' AND actif = true
      `);

      if (res.rows.length > 0) {
        res.rows.forEach(row => {
          this.agents.set(row.code, {
            ...row,
            sources_csp:       row.sources_csp       ?? [],
            regles_validation: row.regles_validation  ?? [],
            tenant_id:         'CI',
          });
        });
        this.logger.log('[AGENT-MGR] ' + res.rows.length + ' agents chargés depuis base_game');
      } else {
        // Fallback catalogue local
        Object.values(AGENTS_CATALOGUE).forEach(a => this.agents.set(a.code, a));
        this.logger.log('[AGENT-MGR] Catalogue local chargé — ' + this.agents.size + ' agents');
      }
    } catch {
      Object.values(AGENTS_CATALOGUE).forEach(a => this.agents.set(a.code, a));
    }
  }

  // ---------------------------------------------------------------------------
  // OBTENIR UN AGENT
  // ---------------------------------------------------------------------------
  getAgent(code: string): AgentConfig | null {
    return this.agents.get(code) ?? null;
  }

  // ---------------------------------------------------------------------------
  // LISTER AGENTS par catégorie
  // ---------------------------------------------------------------------------
  listerAgents(categorie?: AgentCategorie): AgentConfig[] {
    const tous = Array.from(this.agents.values());
    if (!categorie) return tous;
    return tous.filter(a => a.categorie === categorie);
  }

  // ---------------------------------------------------------------------------
  // ENREGISTRER UNE EXÉCUTION
  // ---------------------------------------------------------------------------
  enregistrerExecution(agentCode: string, exec: AgentExecution): void {
    const hist = this.executions.get(agentCode) ?? [];
    hist.push(exec);
    // Garder seulement les 100 dernières exécutions par agent
    if (hist.length > 100) hist.shift();
    this.executions.set(agentCode, hist);
  }

  // ---------------------------------------------------------------------------
  // STATS PAR AGENT
  // ---------------------------------------------------------------------------
  getStats(agentCode?: string): AgentStats[] {
    const codes = agentCode ? [agentCode] : Array.from(this.agents.keys());
    return codes.map(code => {
      const hist    = this.executions.get(code) ?? [];
      const succes  = hist.filter(e => e.statut === 'SUCCES').length;
      const echecs  = hist.filter(e => e.statut === 'ECHEC').length;
      const cqciVals = hist.filter(e => e.cqci_score).map(e => e.cqci_score!);
      const cqciMoy  = cqciVals.length > 0
        ? Math.round(cqciVals.reduce((a,b) => a+b, 0) / cqciVals.length * 100) / 100
        : 0;
      const derniere = hist.length > 0 ? hist[hist.length-1].debut.toISOString() : 'jamais';

      return {
        agent_code:       code,
        total_executions: hist.length,
        succes, echecs,
        taux_succes:      hist.length > 0 ? Math.round(succes / hist.length * 100) : 0,
        cqci_moyen:       cqciMoy,
        derniere_exec:    derniere,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // DASHBOARD AGENTS — Vue YIRA-COMMAND
  // ---------------------------------------------------------------------------
  getDashboard(): any {
    const tous     = this.listerAgents();
    const actifs   = tous.filter(a => a.actif);
    const parCat   = tous.reduce((acc, a) => {
      acc[a.categorie] = (acc[a.categorie] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_agents:    tous.length,
      agents_actifs:   actifs.length,
      par_categorie:   parCat,
      agents_quotidiens: tous.filter(a => a.frequence === 'QUOTIDIEN').length,
      agents_a_demande: tous.filter(a => a.frequence === 'A_DEMANDE').length,
      conformite:      'Zero Hardcode — paramètres pilotés base_game.yira_game_agent',
      tenant_id:       'CI',
      timestamp:       new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // RECHARGER AGENTS depuis base_game (admin)
  // ---------------------------------------------------------------------------
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