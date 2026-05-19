// =============================================================================
// YIRA V3.0 — ConcoursEngine
// Sprint 51 — Candidats concours fonction publique CI
// Factory Pattern L3 §6.1 — ConcoursEngine
// Vérification âge/diplôme + Ranking + Éligibilité CI
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

// ── Types ────────────────────────────────────────────────────────────────────
export interface CandidatConcours {
  utilisateur_id: string;
  tenant_id:      string;
  nom:            string;
  prenom:         string;
  date_naissance: string; // YYYY-MM-DD
  diplome:        string; // BEPC, BAC, LICENCE, MASTER
  serie?:         string; // BAC A, B, C, D
  annee_diplome?: number;
  filiere?:       string;
  experience_ans?: number;
  genre:          'M' | 'F';
  region_ci?:     string;
}

export interface ConcoursCible {
  code:           string; // ex: INFAS_2026, ENS_2026, ENA_2026
  nom:            string;
  ministere:      string;
  diplome_requis: string[];
  age_min:        number;
  age_max:        number;
  series_requises?: string[];
  nb_postes:      number;
  date_concours:  string;
  lieu_depot:     string;
  frais_dossier:  number; // FCFA
}

export interface ResultatEligibilite {
  eligible:           boolean;
  score_eligibilite:  number; // 0-100
  motifs_exclusion:   string[];
  avantages:          string[];
  concours_code:      string;
  candidat_id:        string;
}

export interface RankingConcours {
  rang_prevu:         number;
  score_global:       number; // 0-100
  points_riasec:      number;
  points_scolaires:   number;
  points_experience:  number;
  points_region:      number; // bonus régions sous-représentées
  recommandations:    string[];
  coaching_message:   string;
}

export interface AnalyseConcoursResult {
  candidat_id:        string;
  concours_code:      string;
  eligibilite:        ResultatEligibilite;
  ranking:            RankingConcours;
  concours_details:   ConcoursCible;
  plan_preparation:   string[];
  delai_depot_jours:  number;
  certification:      string;
}

// ── Catalogue concours CI (piloté par base_core en production) ───────────────
const CONCOURS_CI: Record<string, ConcoursCible> = {
  INFAS_2026: {
    code: 'INFAS_2026', nom: 'INFAS — Institut National de Formation des Agents de Santé',
    ministere: 'Ministère de la Santé CI',
    diplome_requis: ['BEPC', 'BAC'],
    age_min: 17, age_max: 25,
    series_requises: ['D', 'C'],
    nb_postes: 800, date_concours: '2026-09-15',
    lieu_depot: 'INFAS Abidjan + Bouaké + Korhogo',
    frais_dossier: 5000,
  },
  ENS_2026: {
    code: 'ENS_2026', nom: 'ENS — École Normale Supérieure',
    ministere: 'MENET CI',
    diplome_requis: ['BAC', 'LICENCE'],
    age_min: 18, age_max: 30,
    nb_postes: 400, date_concours: '2026-08-20',
    lieu_depot: 'ENS Abidjan',
    frais_dossier: 3000,
  },
  ENA_2026: {
    code: 'ENA_2026', nom: 'ENA — École Nationale d Administration',
    ministere: 'Ministère de la Fonction Publique CI',
    diplome_requis: ['LICENCE', 'MASTER'],
    age_min: 18, age_max: 35,
    nb_postes: 150, date_concours: '2026-10-05',
    lieu_depot: 'ENA Plateau Abidjan',
    frais_dossier: 10000,
  },
  POLICE_2026: {
    code: 'POLICE_2026', nom: 'Concours Inspecteur Police CI',
    ministere: 'Ministère de la Sécurité CI',
    diplome_requis: ['BAC', 'LICENCE'],
    age_min: 18, age_max: 27,
    nb_postes: 300, date_concours: '2026-11-10',
    lieu_depot: 'DGSP Abidjan',
    frais_dossier: 5000,
  },
  DOUANE_2026: {
    code: 'DOUANE_2026', nom: 'Concours Inspecteur des Douanes CI',
    ministere: 'Ministère des Finances CI',
    diplome_requis: ['BAC', 'LICENCE'],
    age_min: 18, age_max: 30,
    nb_postes: 200, date_concours: '2026-09-30',
    lieu_depot: 'DGD Treichville Abidjan',
    frais_dossier: 5000,
  },
  TRESOR_2026: {
    code: 'TRESOR_2026', nom: 'Concours Agent du Trésor CI',
    ministere: 'Direction Générale du Trésor CI',
    diplome_requis: ['BAC', 'LICENCE', 'MASTER'],
    age_min: 18, age_max: 35,
    nb_postes: 120, date_concours: '2026-10-20',
    lieu_depot: 'DGT Plateau Abidjan',
    frais_dossier: 8000,
  },
  AGEFOP_2026: {
    code: 'AGEFOP_2026', nom: 'Concours Formateur AGEFOP',
    ministere: 'METFPA CI',
    diplome_requis: ['LICENCE', 'MASTER'],
    age_min: 22, age_max: 40,
    nb_postes: 80, date_concours: '2026-12-01',
    lieu_depot: 'AGEFOP Abidjan',
    frais_dossier: 3000,
  },
};

@Injectable()
export class ConcoursService {
  private readonly logger = new Logger(ConcoursService.name);
  private pool!: Pool;
  private ready = false;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_ORIENTATION') });
      const c    = await this.pool.connect();
      c.release();
      this.ready = true;
      this.logger.log('[CONCOURS] ConcoursEngine connecté — ' + Object.keys(CONCOURS_CI).length + ' concours CI chargés');
    } catch (e: any) {
      this.logger.warn('[CONCOURS] Init erreur: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // ANALYSER — Point d'entrée principal
  // ---------------------------------------------------------------------------
  async analyser(candidat: CandidatConcours, concours_code: string): Promise<AnalyseConcoursResult> {
    this.logger.log('[CONCOURS] Analyse ' + concours_code + ' pour ' + candidat.utilisateur_id);

    const concours    = await this.chargerConcours(concours_code);
    const eligibilite = this.verifierEligibilite(candidat, concours);
    const ranking     = this.calculerRanking(candidat, concours, eligibilite);
    const plan        = this.genererPlanPreparation(candidat, concours, eligibilite);
    const delai       = this.calculerDelai(concours.date_concours);

    const result: AnalyseConcoursResult = {
      candidat_id:       candidat.utilisateur_id,
      concours_code,
      eligibilite,
      ranking,
      concours_details:  concours,
      plan_preparation:  plan,
      delai_depot_jours: delai,
      certification:     'YIRA-CONCOURS-CI-2026',
    };

    await this.sauvegarderAnalyse(result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // VÉRIFIER ÉLIGIBILITÉ — Âge + Diplôme + Série
  // ---------------------------------------------------------------------------
  private verifierEligibilite(candidat: CandidatConcours, concours: ConcoursCible): ResultatEligibilite {
    const motifs:    string[] = [];
    const avantages: string[] = [];
    let score = 100;

    // Vérification âge
    const age = this.calculerAge(candidat.date_naissance);
    if (age < concours.age_min) {
      motifs.push('Âge insuffisant: ' + age + ' ans (minimum: ' + concours.age_min + ' ans)');
      score -= 50;
    } else if (age > concours.age_max) {
      motifs.push('Âge dépassé: ' + age + ' ans (maximum: ' + concours.age_max + ' ans)');
      score -= 50;
    } else {
      avantages.push('Âge conforme: ' + age + ' ans (' + concours.age_min + '-' + concours.age_max + ' ans)');
    }

    // Vérification diplôme
    const niveauxHierarchie = ['CEP','BEPC','CAP','BAC','LICENCE','MASTER','DOCTORAT'];
    const niveauCandidatIdx = niveauxHierarchie.indexOf(candidat.diplome);
    const niveauxRequisIdx  = concours.diplome_requis.map(d => niveauxHierarchie.indexOf(d));
    const niveauMinRequisIdx = Math.min(...niveauxRequisIdx);

    if (niveauCandidatIdx < niveauMinRequisIdx) {
      motifs.push('Diplôme insuffisant: ' + candidat.diplome + ' (requis: ' + concours.diplome_requis.join('/') + ')');
      score -= 40;
    } else {
      avantages.push('Diplôme conforme: ' + candidat.diplome);
      if (niveauCandidatIdx > niveauMinRequisIdx) {
        avantages.push('Diplôme supérieur au minimum requis — avantage compétitif');
        score += 5;
      }
    }

    // Vérification série BAC si requise
    if (concours.series_requises && candidat.serie) {
      if (!concours.series_requises.includes(candidat.serie)) {
        motifs.push('Série BAC non conforme: ' + candidat.serie + ' (requise: ' + concours.series_requises.join('/') + ')');
        score -= 20;
      } else {
        avantages.push('Série BAC conforme: ' + candidat.serie);
      }
    }

    // Bonus genre (parité CI)
    if (candidat.genre === 'F') {
      avantages.push('Politique parité CI: bonus candidatures féminines');
      score += 3;
    }

    // Bonus région sous-représentée
    const regionsBonus = ['Nord', 'Nord-Est', 'Nord-Ouest', 'Savanes', 'Zanzan', 'Vallée du Bandama'];
    if (candidat.region_ci && regionsBonus.some(r => candidat.region_ci?.includes(r))) {
      avantages.push('Bonus région: candidat zone sous-représentée CI');
      score += 5;
    }

    return {
      eligible:          motifs.length === 0,
      score_eligibilite: Math.min(100, Math.max(0, score)),
      motifs_exclusion:  motifs,
      avantages,
      concours_code:     concours.code,
      candidat_id:       candidat.utilisateur_id,
    };
  }

  // ---------------------------------------------------------------------------
  // CALCULER RANKING — Position estimée dans le concours
  // ---------------------------------------------------------------------------
  private calculerRanking(
    candidat:    CandidatConcours,
    concours:    ConcoursCible,
    eligibilite: ResultatEligibilite,
  ): RankingConcours {
    if (!eligibilite.eligible) {
      return {
        rang_prevu: 0, score_global: 0,
        points_riasec: 0, points_scolaires: 0,
        points_experience: 0, points_region: 0,
        recommandations: ['Corriger les conditions d éligibilité avant de postuler'],
        coaching_message: 'Travaille d abord sur les prérequis manquants.',
      };
    }

    // Points scolaires (40% du score)
    const niveauxPoints: Record<string, number> = {
      BEPC: 20, BAC: 30, LICENCE: 35, MASTER: 40, DOCTORAT: 40,
    };
    const pointsScolaires = niveauxPoints[candidat.diplome] ?? 20;

    // Points expérience (20% du score)
    const pointsExp = Math.min(20, (candidat.experience_ans ?? 0) * 3);

    // Points région (10% du score)
    const regionsBonus = ['Nord', 'Nord-Est', 'Nord-Ouest', 'Savanes', 'Zanzan'];
    const pointsRegion = candidat.region_ci && regionsBonus.some(r => candidat.region_ci?.includes(r)) ? 10 : 5;

    // Points RIASEC estimés (30% du score) — basé sur adéquation profil/concours
    const riasecConcours: Record<string, number> = {
      INFAS_2026:  { S: 90, I: 70, C: 60 } as any,
      ENS_2026:    { S: 85, I: 80, E: 60 } as any,
      ENA_2026:    { C: 90, E: 85, I: 75 } as any,
      POLICE_2026: { R: 80, E: 75, C: 70 } as any,
      DOUANE_2026: { C: 85, E: 80, I: 70 } as any,
      TRESOR_2026: { C: 90, I: 80, E: 70 } as any,
      AGEFOP_2026: { S: 85, I: 75, E: 65 } as any,
    };
    const pointsRiasec = riasecConcours[concours.code] ? 25 : 20; // Sera enrichi avec profil réel

    const scoreGlobal = pointsScolaires + pointsExp + pointsRegion + pointsRiasec;

    // Rang estimé sur nb_postes
    const tauxReussite = scoreGlobal / 100;
    const rangPrevu    = Math.round(concours.nb_postes * (1 - tauxReussite) * 0.3 + 1);

    const recommandations: string[] = [];
    if (pointsScolaires < 35) recommandations.push('Envisager une formation complémentaire pour renforcer le dossier');
    if (pointsExp < 10) recommandations.push('Stage ou bénévolat pour acquérir de l expérience avant le concours');
    recommandations.push('Consulter les annales des 3 dernières années du concours ' + concours.code);
    recommandations.push('S inscrire aux préparations YIRA-CONCOURS (coaching IA 30j)');

    const figure = candidat.genre === 'F' ? 'Grande Sœur' : 'Vieux Père';
    const coaching = 'Ton profil est ' + (eligibilite.eligible ? 'éligible' : 'en cours') +
      ' pour ' + concours.nom + '. ' +
      (scoreGlobal >= 70
        ? 'Avec ' + scoreGlobal + '/100, tu as de bonnes chances. Continue à te préparer!'
        : 'Renforce tes points faibles — YIRA t accompagne pas à pas.');

    return {
      rang_prevu:        Math.max(1, rangPrevu),
      score_global:      Math.min(100, scoreGlobal),
      points_riasec:     pointsRiasec,
      points_scolaires:  pointsScolaires,
      points_experience: pointsExp,
      points_region:     pointsRegion,
      recommandations,
      coaching_message:  coaching,
    };
  }

  // ---------------------------------------------------------------------------
  // PLAN DE PRÉPARATION 30 jours
  // ---------------------------------------------------------------------------
  private genererPlanPreparation(
    candidat:    CandidatConcours,
    concours:    ConcoursCible,
    eligibilite: ResultatEligibilite,
  ): string[] {
    const plan: string[] = [];
    const delai = this.calculerDelai(concours.date_concours);

    if (!eligibilite.eligible) {
      plan.push('J0 — Corriger les conditions d éligibilité: ' + eligibilite.motifs_exclusion.join(', '));
      return plan;
    }

    plan.push('J0-J7 — Constituer le dossier: ' + concours.lieu_depot + ' | Frais: ' + concours.frais_dossier + ' FCFA');
    plan.push('J7-J30 — Réviser les matières clés du concours ' + concours.code);
    plan.push('J30-J60 — Entraînement sur annales 3 dernières années');
    plan.push('J60-J90 — Simulation épreuves + coaching entretien YIRA-OP');

    if (delai < 30) plan.push('⚠️ URGENT: Seulement ' + delai + ' jours — Déposer le dossier cette semaine!');
    if (concours.frais_dossier > 0) plan.push('💰 Frais dossier: ' + concours.frais_dossier + ' FCFA — Prévoir via Orange Money/MTN');

    plan.push('📱 Activer YIRA-CONCOURS (*xyz*33#) pour coaching quotidien');
    return plan;
  }

  // ---------------------------------------------------------------------------
  // LISTE CONCOURS ÉLIGIBLES pour un candidat
  // ---------------------------------------------------------------------------
  async listerConcoursEligibles(candidat: CandidatConcours): Promise<{
    concours_eligible: AnalyseConcoursResult[];
    concours_futur:    ConcoursCible[];
    nb_total:          number;
  }> {
    const eligible: AnalyseConcoursResult[] = [];
    const futur:    ConcoursCible[]         = [];

    for (const code of Object.keys(CONCOURS_CI)) {
      const concours = CONCOURS_CI[code];
      const delai    = this.calculerDelai(concours.date_concours);
      const elig     = this.verifierEligibilite(candidat, concours);

      if (elig.eligible && delai > 0) {
        const result = await this.analyser(candidat, code);
        eligible.push(result);
      } else if (delai < 0) {
        futur.push(concours);
      }
    }

    eligible.sort((a, b) => b.ranking.score_global - a.ranking.score_global);

    this.logger.log('[CONCOURS] ' + eligible.length + ' concours éligibles trouvés pour ' + candidat.utilisateur_id);
    return { concours_eligible: eligible, concours_futur: futur, nb_total: Object.keys(CONCOURS_CI).length };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  private calculerAge(dateNaissance: string): number {
    const naissance = new Date(dateNaissance);
    const now       = new Date();
    let age         = now.getFullYear() - naissance.getFullYear();
    const mois      = now.getMonth() - naissance.getMonth();
    if (mois < 0 || (mois === 0 && now.getDate() < naissance.getDate())) age--;
    return age;
  }

  private calculerDelai(dateConcours: string): number {
    const now     = new Date();
    const concours = new Date(dateConcours);
    return Math.round((concours.getTime() - now.getTime()) / (1000 * 3600 * 24));
  }

  private async chargerConcours(code: string): Promise<ConcoursCible> {
    // En production : charger depuis base_core (Zero Hardcode)
    // Fallback sur catalogue local
    if (CONCOURS_CI[code]) return CONCOURS_CI[code];
    throw new Error('Concours non trouvé: ' + code + '. Concours disponibles: ' + Object.keys(CONCOURS_CI).join(', '));
  }

  private async sauvegarderAnalyse(result: AnalyseConcoursResult): Promise<void> {
    if (!this.ready) return;
    try {
      await this.pool.query(`
        INSERT INTO yira_concours_analyse
          (id, tenant_id, candidat_id, concours_code, eligible,
           score_eligibilite, score_global, rang_prevu, certification, created_at)
        VALUES (gen_random_uuid()::text, 'CI', $1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT DO NOTHING
      `, [
        result.candidat_id, result.concours_code,
        result.eligibilite.eligible,
        result.eligibilite.score_eligibilite,
        result.ranking.score_global,
        result.ranking.rang_prevu,
        result.certification,
      ]);
    } catch (e: any) {
      this.logger.warn('[CONCOURS] Sauvegarde non critique: ' + e.message);
    }
  }

  // API publique
  getConcoursList(): ConcoursCible[] { return Object.values(CONCOURS_CI); }
  ping(): string { return 'ConcoursEngine OK — ' + Object.keys(CONCOURS_CI).length + ' concours CI chargés'; }
}