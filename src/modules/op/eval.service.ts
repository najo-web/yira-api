// =============================================================================
// YIRA V3.0 — EvalEngine (YIRA-EVAL)
// Sprint 51 — Bilan 360° B2G/B2B Cadres supérieurs CI
// Factory Pattern L3 §6.1 — EvalEngine
// Usage : Ministères, entreprises, bailleurs institutionnels
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ProfilCadre {
  utilisateur_id:   string;
  tenant_id:        string;
  nom:              string;
  prenom:           string;
  poste_actuel:     string;
  ministere_ou_entreprise: string;
  anciennete_ans:   number;
  niveau_hierarchique: 'AGENT' | 'CADRE_MOYEN' | 'CADRE_SUP' | 'DIRIGEANT';
  diplome_max:      string;
  domaine_expertise: string[];
  genre:            'M' | 'F';
  age:              number;
  // Scores psychométriques (depuis PasseportService ou PsyPService)
  riasec?:          Record<string, number>;
  bigfive?:         Record<string, number>;
  valeurs?:         Record<string, number>;
  cqci_score?:      number;
}

export interface Evaluation360 {
  auto_evaluation:     number; // 0-100
  evaluation_n_plus_1: number; // 0-100
  evaluation_pairs:    number; // 0-100
  evaluation_n_moins_1: number; // 0-100
  score_360:           number; // moyenne pondérée
}

export interface CompetencesProfil {
  leadership:        number; // 0-100
  communication:     number;
  gestion_projet:    number;
  expertise_metier:  number;
  intelligence_culturelle: number; // CQ-CI
  adaptabilite:      number;
  orientation_resultats: number;
  travail_equipe:    number;
}

export interface BilanEvalResult {
  candidat_id:        string;
  type_bilan:         'B2G' | 'B2B' | 'B2G_BAILLEURS';
  profil_cadre:       ProfilCadre;
  evaluation_360:     Evaluation360;
  competences:        CompetencesProfil;
  score_global_eval:  number; // 0-100
  potentiel_evolution: 'HAUT' | 'MOYEN' | 'A_DEVELOPPER';
  recommandations:    string[];
  plan_dev_individuel: PlanDevIndividuel;
  rapport_institutionnel: RapportInstitutionnel;
  certification:      string;
}

export interface PlanDevIndividuel {
  priorites_court_terme:  string[]; // 3 mois
  priorites_moyen_terme:  string[]; // 1 an
  formations_recommandees: string[];
  coaching_suggere:       string;
  indicateurs_succes:     string[];
}

export interface RapportInstitutionnel {
  resume_executif:    string;
  points_forts:       string[];
  axes_amelioration:  string[];
  adequation_poste:   number; // 0-100
  recommandation_rh:  string;
  conformite_iso:     string; // ISO 10667
  date_rapport:       string;
}

@Injectable()
export class EvalService {
  private readonly logger = new Logger(EvalService.name);
  private pool!: Pool;
  private ready = false;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_ORIENTATION') });
      const c    = await this.pool.connect();
      c.release();
      this.ready = true;
      this.logger.log('[EVAL] EvalEngine connecté — Bilan 360° B2G/B2B opérationnel');
    } catch (e: any) {
      this.logger.warn('[EVAL] Init erreur: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // BILAN 360° — Point d'entrée principal
  // ---------------------------------------------------------------------------
  async realiserBilan360(
    profil:    ProfilCadre,
    eval360:   Evaluation360,
    typeBilan: 'B2G' | 'B2B' | 'B2G_BAILLEURS' = 'B2G',
  ): Promise<BilanEvalResult> {
    this.logger.log('[EVAL] Bilan 360° ' + typeBilan + ' pour ' + profil.utilisateur_id);

    // 1. Calculer score 360 pondéré
    const score360 = this.calculerScore360(eval360);

    // 2. Évaluer les compétences
    const competences = this.evaluerCompetences(profil, eval360);

    // 3. Score global
    const scoreGlobal = this.calculerScoreGlobal(score360, competences, profil);

    // 4. Potentiel d'évolution
    const potentiel = this.evaluerPotentiel(scoreGlobal, profil);

    // 5. Plan de développement individuel
    const planDev = this.genererPlanDev(competences, profil, potentiel);

    // 6. Rapport institutionnel
    const rapport = this.genererRapportInstitutionnel(profil, competences, scoreGlobal, potentiel, typeBilan);

    // 7. Recommandations
    const recommandations = this.genererRecommandations(competences, profil, potentiel);

    const result: BilanEvalResult = {
      candidat_id:          profil.utilisateur_id,
      type_bilan:           typeBilan,
      profil_cadre:         profil,
      evaluation_360:       { ...eval360, score_360: score360 },
      competences,
      score_global_eval:    scoreGlobal,
      potentiel_evolution:  potentiel,
      recommandations,
      plan_dev_individuel:  planDev,
      rapport_institutionnel: rapport,
      certification:        'YIRA-EVAL-ISO10667-CI-2026',
    };

    await this.sauvegarderBilan(result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // SCORE 360 PONDÉRÉ
  // Pondération L3 : N+1=40%, Pairs=30%, Auto=20%, N-1=10%
  // ---------------------------------------------------------------------------
  private calculerScore360(eval360: Evaluation360): number {
    const score = (
      eval360.evaluation_n_plus_1  * 0.40 +
      eval360.evaluation_pairs     * 0.30 +
      eval360.auto_evaluation      * 0.20 +
      eval360.evaluation_n_moins_1 * 0.10
    );
    return Math.round(score);
  }

  // ---------------------------------------------------------------------------
  // ÉVALUATION COMPÉTENCES
  // ---------------------------------------------------------------------------
  private evaluerCompetences(profil: ProfilCadre, eval360: Evaluation360): CompetencesProfil {
    // Leadership — basé sur niveau hiérarchique + BigFive E + RIASEC E
    const baseLeadership = {
      AGENT: 40, CADRE_MOYEN: 55, CADRE_SUP: 70, DIRIGEANT: 85,
    }[profil.niveau_hierarchique];
    const bonusLeadership = profil.bigfive?.E ? Math.round(profil.bigfive.E * 0.2) : 0;
    const leadership = Math.min(100, baseLeadership + bonusLeadership);

    // Communication — BigFive E + A + RIASEC S
    const communication = Math.min(100, Math.round(
      (profil.bigfive?.E ?? 60) * 0.4 +
      (profil.bigfive?.A ?? 60) * 0.3 +
      (profil.riasec?.S  ?? 50) * 0.3
    ));

    // Gestion de projet — RIASEC C + E + BigFive C
    const gestionProjet = Math.min(100, Math.round(
      (profil.riasec?.C  ?? 50) * 0.4 +
      (profil.riasec?.E  ?? 50) * 0.3 +
      (profil.bigfive?.C ?? 60) * 0.3
    ));

    // Expertise métier — ancienneté + diplôme
    const niveauxPoints: Record<string, number> = {
      BEPC: 30, BAC: 40, LICENCE: 55, MASTER: 70, DOCTORAT: 85,
    };
    const baseExpertise   = niveauxPoints[profil.diplome_max] ?? 50;
    const bonusAnciennete = Math.min(20, profil.anciennete_ans * 2);
    const expertiseMetier = Math.min(100, baseExpertise + bonusAnciennete);

    // Intelligence culturelle CI — CQ-CI score
    const intelligenceCulturelle = Math.min(100, Math.round((profil.cqci_score ?? 65) * 100));

    // Adaptabilité — BigFive O + N inversé
    const adaptabilite = Math.min(100, Math.round(
      (profil.bigfive?.O ?? 60) * 0.6 +
      (100 - (profil.bigfive?.N ?? 40)) * 0.4
    ));

    // Orientation résultats — RIASEC C + E + BigFive C
    const orientationResultats = Math.min(100, Math.round(
      (profil.riasec?.C  ?? 50) * 0.35 +
      (profil.riasec?.E  ?? 50) * 0.35 +
      (profil.bigfive?.C ?? 60) * 0.30
    ));

    // Travail en équipe — RIASEC S + BigFive A
    const travailEquipe = Math.min(100, Math.round(
      (profil.riasec?.S  ?? 50) * 0.5 +
      (profil.bigfive?.A ?? 60) * 0.5
    ));

    return {
      leadership, communication, gestion_projet: gestionProjet,
      expertise_metier: expertiseMetier, intelligence_culturelle: intelligenceCulturelle,
      adaptabilite, orientation_resultats: orientationResultats, travail_equipe: travailEquipe,
    };
  }

  // ---------------------------------------------------------------------------
  // SCORE GLOBAL EVAL
  // ---------------------------------------------------------------------------
  private calculerScoreGlobal(score360: number, comp: CompetencesProfil, profil: ProfilCadre): number {
    const scoreComp = (
      comp.leadership              * 0.20 +
      comp.communication           * 0.15 +
      comp.gestion_projet          * 0.15 +
      comp.expertise_metier        * 0.20 +
      comp.intelligence_culturelle * 0.10 +
      comp.adaptabilite            * 0.10 +
      comp.orientation_resultats   * 0.05 +
      comp.travail_equipe          * 0.05
    );
    // 60% compétences + 40% 360
    return Math.round(scoreComp * 0.6 + score360 * 0.4);
  }

  // ---------------------------------------------------------------------------
  // POTENTIEL D'ÉVOLUTION
  // ---------------------------------------------------------------------------
  private evaluerPotentiel(scoreGlobal: number, profil: ProfilCadre): 'HAUT' | 'MOYEN' | 'A_DEVELOPPER' {
    if (scoreGlobal >= 75) return 'HAUT';
    if (scoreGlobal >= 55) return 'MOYEN';
    return 'A_DEVELOPPER';
  }

  // ---------------------------------------------------------------------------
  // PLAN DE DÉVELOPPEMENT INDIVIDUEL
  // ---------------------------------------------------------------------------
  private genererPlanDev(
    comp:      CompetencesProfil,
    profil:    ProfilCadre,
    potentiel: string,
  ): PlanDevIndividuel {
    const prioritesCourt:  string[] = [];
    const prioritesMoyen:  string[] = [];
    const formations:      string[] = [];
    const indicateurs:     string[] = [];

    // Identifier les compétences faibles (< 60)
    if (comp.leadership < 60) {
      prioritesCourt.push('Renforcer le leadership : prendre en charge un projet d équipe CI');
      formations.push('Formation Leadership CGECI — Abidjan');
    }
    if (comp.communication < 60) {
      prioritesCourt.push('Communication institutionnelle : prise de parole en public');
      formations.push('Atelier communication FDFP CI');
    }
    if (comp.intelligence_culturelle < 70) {
      prioritesCourt.push('Intelligence culturelle CI : immersion terrain zones rurales');
      formations.push('Programme CQ-CI YIRA — certification étalonnage UFHB/CIRES');
    }
    if (comp.gestion_projet < 65) {
      prioritesMoyen.push('Certification gestion de projet : Prince2 ou PMP adapté CI');
      formations.push('Formation gestion projets BAD/BM — financement éligible');
    }
    if (comp.expertise_metier < 70) {
      prioritesMoyen.push('Montée en compétences métier : formation spécialisée AGEFOP');
    }

    prioritesMoyen.push('Développement réseau professionnel CGECI + associations sectorielles CI');
    formations.push('MOOC gestion publique ENAM Afrique');

    indicateurs.push('Score 360 > 75 dans 6 mois');
    indicateurs.push('Certification compétence validée FDFP');
    indicateurs.push('Prise en charge d un projet transversal dans ' + profil.ministere_ou_entreprise);

    const figure   = profil.genre === 'F' ? 'Grande Sœur' : 'Vieux Père';
    const coaching = 'Je t accompagne ' + profil.prenom + '. ' +
      (potentiel === 'HAUT'
        ? 'Ton potentiel est excellent — vise la direction !'
        : potentiel === 'MOYEN'
        ? 'Avec méthode, tu peux atteindre le niveau suivant.'
        : 'Chaque progrès compte. YIRA est là pour t aider pas à pas.');

    return {
      priorites_court_terme:   prioritesCourt.slice(0, 3),
      priorites_moyen_terme:   prioritesMoyen.slice(0, 3),
      formations_recommandees: formations.slice(0, 4),
      coaching_suggere:        coaching,
      indicateurs_succes:      indicateurs,
    };
  }

  // ---------------------------------------------------------------------------
  // RAPPORT INSTITUTIONNEL (ISO 10667)
  // ---------------------------------------------------------------------------
  private genererRapportInstitutionnel(
    profil:    ProfilCadre,
    comp:      CompetencesProfil,
    score:     number,
    potentiel: string,
    type:      string,
  ): RapportInstitutionnel {
    const pointsForts: string[] = [];
    const axesAmelio:  string[] = [];

    // Top 3 compétences
    const compEntries = Object.entries(comp).sort(([,a],[,b]) => (b as number)-(a as number));
    compEntries.slice(0, 3).forEach(([k, v]) => {
      pointsForts.push(k.replace(/_/g,' ') + ' : ' + v + '/100');
    });
    compEntries.slice(-3).forEach(([k, v]) => {
      axesAmelio.push(k.replace(/_/g,' ') + ' : ' + v + '/100 — à développer');
    });

    const adequationPoste = Math.round(
      score * 0.7 + (profil.anciennete_ans >= 5 ? 20 : profil.anciennete_ans * 4)
    );

    const recommandationRH =
      potentiel === 'HAUT'        ? 'Candidat recommandé pour promotion N+1 ou mission stratégique' :
      potentiel === 'MOYEN'       ? 'Maintien au poste avec plan de développement 12 mois' :
      'Accompagnement renforcé recommandé — plan coaching 6 mois';

    const resume =
      profil.prenom + ' ' + profil.nom + ', ' + profil.poste_actuel +
      ' (' + profil.anciennete_ans + ' ans d ancienneté), ' +
      profil.ministere_ou_entreprise + '. ' +
      'Score global YIRA-EVAL : ' + score + '/100. ' +
      'Potentiel : ' + potentiel + '. ' +
      (type === 'B2G_BAILLEURS'
        ? 'Évaluation conforme aux exigences BAD/BM pour projets financés.'
        : 'Bilan conforme ISO 10667.');

    return {
      resume_executif:    resume,
      points_forts:       pointsForts,
      axes_amelioration:  axesAmelio,
      adequation_poste:   Math.min(100, adequationPoste),
      recommandation_rh:  recommandationRH,
      conformite_iso:     'ISO 10667:2020 — Évaluation psychométrique milieu organisationnel CI',
      date_rapport:       new Date().toISOString().split('T')[0],
    };
  }

  // ---------------------------------------------------------------------------
  // RECOMMANDATIONS
  // ---------------------------------------------------------------------------
  private genererRecommandations(comp: CompetencesProfil, profil: ProfilCadre, potentiel: string): string[] {
    const recs: string[] = [];
    if (potentiel === 'HAUT')          recs.push('Candidature aux programmes de leadership BAD/AFD CI');
    if (comp.intelligence_culturelle < 75) recs.push('Renforcer CQ-CI : enjeu clé pour postes B2G avec bailleurs');
    if (profil.anciennete_ans < 3)     recs.push('Développer réseau sectoriel CI : CGECI, syndicats, associations');
    if (comp.expertise_metier < 70)    recs.push('Formation continue AGEFOP ou FDFP dans ' + profil.domaine_expertise[0]);
    recs.push('Activer YIRA-PASSEPORT pour certification officielle du profil');
    recs.push('Consulter le tableau de bord YIRA-COMMAND pour suivi des KPIs');
    return recs.slice(0, 5);
  }

  // ---------------------------------------------------------------------------
  // SAUVEGARDE
  // ---------------------------------------------------------------------------
  private async sauvegarderBilan(result: BilanEvalResult): Promise<void> {
    if (!this.ready) return;
    try {
      await this.pool.query(`
        INSERT INTO yira_eval_bilan
          (id, tenant_id, candidat_id, type_bilan, score_global,
           potentiel_evolution, certification, created_at)
        VALUES (gen_random_uuid()::text, 'CI', $1, $2, $3, $4, $5, NOW())
        ON CONFLICT DO NOTHING
      `, [
        result.candidat_id, result.type_bilan,
        result.score_global_eval, result.potentiel_evolution,
        result.certification,
      ]);
    } catch (e: any) {
      this.logger.warn('[EVAL] Sauvegarde non critique: ' + e.message);
    }
  }

  ping(): string { return 'EvalEngine OK — Bilan 360° B2G/B2B ISO 10667 CI'; }
}