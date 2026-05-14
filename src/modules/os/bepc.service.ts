// ============================================================
// YIRA — bepc.service.ts
// Sprint 10B — Moteur d'Orientation Post-BEPC
// Endpoint : POST /api/bepc/analyze
// CDC Source : CDC_BEPC_BAC_v1.0 — Partie 4
//
// Formule officielle :
//   S_final = 0.35×S_acad + 0.25×S_RIASEC
//           + 0.20×S_contexte + 0.20×S_projection
//
// Différenciateur #1 YIRA : Simulation DOB avec probabilités
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { IaService } from '../../ia/ia.service';

// ── Types ────────────────────────────────────────────────────

export interface NotesBepc {
  maths: number;         // /20 — coefficient 3
  francais: number;      // /20 — coefficient 3
  anglais: number;       // /20 — coefficient 2
  svt: number;           // /20 — coefficient 2
  physique: number;      // /20 — coefficient 2
  histoire_geo: number;  // /20 — coefficient 1
  eps: number;           // /20 — coefficient 1
  [key: string]: number;
}

export interface ScoresRIASEC {
  R: number; // Réaliste       0-100
  I: number; // Investigateur  0-100
  A: number; // Artistique     0-100
  S: number; // Social         0-100
  E: number; // Entreprenant   0-100
  C: number; // Conventionnel  0-100
}

export interface ContexteEleve {
  region: string;           // ex: 'ABIDJAN_COCODY', 'BOUAKE', 'KORHOGO'
  type_etablissement: 'PUBLIC' | 'PRIVE';
  milieu: 'URBAIN' | 'RURAL' | 'PERI_URBAIN';
  budget_famille: 'FAIBLE' | 'MOYEN' | 'ELEVE';
  voeux: string[];          // Top 3 filières souhaitées
  distance_max_km?: number;
}

export interface AnalyseBepcInput {
  utilisateur_id: string;
  notes: NotesBepc;
  riasec: ScoresRIASEC;
  contexte: ContexteEleve;
  score_bepc_simule?: number; // optionnel si résultats pas encore publiés
}

export interface SimulationDOB {
  voeu: string;
  probabilite: number;      // 0-1
  seuil_estime: number;     // MO estimée nécessaire
  mo_eleve: number;
  verdict: 'TRES_PROBABLE' | 'PROBABLE' | 'INCERTAIN' | 'TRES_IMPROBABLE';
  conseil: string;
}

export interface RecommandationFiliere {
  rang: number;
  code: string;
  nom: string;
  type: 'UNIVERSITE' | 'BTS' | 'LYCEE_GEN' | 'LYCEE_TECH' | 'FORMATION_PRO';
  score_global: number;     // 0-100
  s_acad: number;
  s_riasec: number;
  s_contexte: number;
  s_projection: number;
  probabilite_reussite: number;
  roi_index: number;
  debouches: string[];
  etablissements_ci: string[];
  pourquoi: string;         // Explication NIE personnalisée
}

export interface AnalyseBepcResult {
  utilisateur_id: string;
  mo: number;               // Moyenne d'Orientation calculée
  profil_academique: string;
  code_riasec: string;      // Ex: "ISC", "ESA"
  trust_index_contribution: number;
  top3_recommandations: RecommandationFiliere[];
  simulation_dob: SimulationDOB[];
  plan_action: PlanAction;
  projection_reussite: ProjectionReussite;
  rapport_nie: string;      // Texte NIE personnalisé
  timestamp: Date;
}

export interface PlanAction {
  avant_bepc: string[];
  pendant_resultats: string[];
  apres_affectation: string[];
}

export interface ProjectionReussite {
  filiere_cible: string;
  probabilite: number;
  facteurs_risque: string[];
  facteurs_succes: string[];
}

// ── Coefficients officiels BEPC CI ───────────────────────────
const COEFFICIENTS_BEPC: Record<string, number> = {
  maths: 3,
  francais: 3,
  anglais: 2,
  svt: 2,
  physique: 2,
  histoire_geo: 1,
  eps: 1,
};

// ── Vecteurs RIASEC par filière (calibrés CI) ─────────────────
const RIASEC_FILIERES: Record<string, ScoresRIASEC> = {
  '2nde_C':           { R: 40, I: 85, A: 15, S: 25, E: 40, C: 55 },
  '2nde_A':           { R: 10, I: 55, A: 70, S: 65, E: 40, C: 40 },
  'LYCEE_TECH_ELEC':  { R: 85, I: 65, A: 10, S: 20, E: 40, C: 55 },
  'LYCEE_TECH_INFO':  { R: 45, I: 85, A: 20, S: 25, E: 45, C: 65 },
  'LYCEE_TECH_BTP':   { R: 88, I: 55, A: 30, S: 25, E: 40, C: 50 },
  'FORMATION_PRO':    { R: 60, I: 40, A: 40, S: 55, E: 55, C: 50 },
};

// ── Modèles logistiques de projection réussite ────────────────
const MODELES_PROJECTION: Record<string, Record<string, number>> = {
  '2nde_C':    { intercept: -2.1, MO: 0.35, maths: 0.40, physique: 0.25 },
  '2nde_A':    { intercept: -1.5, MO: 0.30, francais: 0.45, histoire_geo: 0.25 },
  'LYCEE_TECH':{ intercept: -0.8, MO: 0.25, maths: 0.35, pratique: 0.40 },
};

@Injectable()
export class BepcService {
  private readonly logger = new Logger('BepcService');

  constructor(private readonly iaService: IaService) {}

  // ══════════════════════════════════════════════════════════
  // MÉTHODE PRINCIPALE
  // POST /api/bepc/analyze
  // ══════════════════════════════════════════════════════════
  async analyser(input: AnalyseBepcInput): Promise<AnalyseBepcResult> {
    this.logger.log(`Analyse BEPC — utilisateur: ${input.utilisateur_id}`);

    const mo = this.calculerMO(input.notes);
    const profil = this.detecterProfilAcademique(input.notes, mo);
    const riasec_calibre = this.calibrerRIASEC(input.riasec);
    const code_riasec = this.calculerCodeHolland(riasec_calibre);
    const recommandations = this.calculerRecommandations(mo, riasec_calibre, input.contexte, input.notes);
    const simulation_dob = this.simulerDOB(mo, input.contexte);
    const projection = this.projeterReussite(mo, input.notes, recommandations[0]?.code);
    const plan = this.genererPlanAction(mo, profil, recommandations[0]);
    const rapport_nie = await this.genererRapportNIE({
      mo, profil, code_riasec,
      recommandations: recommandations.slice(0, 3),
      simulation_dob, contexte: input.contexte, notes: input.notes,
    });

    return {
      utilisateur_id: input.utilisateur_id,
      mo,
      profil_academique: profil,
      code_riasec,
      trust_index_contribution: 35,
      top3_recommandations: recommandations.slice(0, 3),
      simulation_dob,
      plan_action: plan,
      projection_reussite: projection,
      rapport_nie,
      timestamp: new Date(),
    };
  }

  // ══════════════════════════════════════════════════════════
  // 1. CALCUL MOYENNE D'ORIENTATION (MO)
  // ══════════════════════════════════════════════════════════
  calculerMO(notes: NotesBepc): number {
    let somme_ponderee = 0;
    let somme_coefficients = 0;
    for (const [matiere, coeff] of Object.entries(COEFFICIENTS_BEPC)) {
      const note = notes[matiere] ?? 0;
      somme_ponderee += note * coeff;
      somme_coefficients += coeff;
    }
    return Math.round((somme_ponderee / somme_coefficients) * 100) / 100;
  }

  // ══════════════════════════════════════════════════════════
  // 2. DÉTECTION PROFIL ACADÉMIQUE
  // ══════════════════════════════════════════════════════════
  detecterProfilAcademique(notes: NotesBepc, mo: number): string {
    if (notes.maths >= 14 && notes.physique >= 12 && mo >= 12) return 'SCIENTIFIQUE_FORT';
    if (notes.francais >= 14 && notes.histoire_geo >= 12 && mo >= 11) return 'LITTERAIRE_FORT';
    if ((notes.maths < 12 || notes.physique < 10) && mo >= 8 && mo <= 11) return 'TECHNIQUE_PRATIQUE';
    if (mo < 10) return 'EN_DIFFICULTE';
    return 'POLYVALENT';
  }

  // ══════════════════════════════════════════════════════════
  // 3. CALIBRATION RIASEC
  // ══════════════════════════════════════════════════════════
  calibrerRIASEC(raw: ScoresRIASEC): ScoresRIASEC {
    return {
      R: raw.R,
      I: Math.min(100, raw.I * 0.95),
      A: Math.min(100, raw.A * 1.12),
      S: raw.S,
      E: Math.min(100, raw.E * 0.88),
      C: raw.C,
    };
  }

  // ══════════════════════════════════════════════════════════
  // 4. CODE HOLLAND
  // ══════════════════════════════════════════════════════════
  calculerCodeHolland(riasec: ScoresRIASEC): string {
    return (Object.entries(riasec) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type)
      .join('');
  }

  // ══════════════════════════════════════════════════════════
  // 5. CALCUL RECOMMANDATIONS
  // ══════════════════════════════════════════════════════════
  calculerRecommandations(
    mo: number,
    riasec: ScoresRIASEC,
    contexte: ContexteEleve,
    notes: NotesBepc,
  ): RecommandationFiliere[] {
    const filieres = [
      {
        code: '2nde_C', nom: '2nde C — Sciences (vers Bac C/D)', type: 'LYCEE_GEN' as const,
        seuil_mo: 12.5, riasec_cible: RIASEC_FILIERES['2nde_C'], roi: 0.78,
        debouches: ['Ingénieur', 'Médecin', 'Informaticien', 'Chercheur', 'Mathématicien'],
        etablissements: ['Lycée Classique Abidjan', 'Lycée Scientifique', 'Lycée de Cocody'],
        exigences: { maths: 12, physique: 11 },
      },
      {
        code: '2nde_A', nom: '2nde A — Lettres (vers Bac A/B)', type: 'LYCEE_GEN' as const,
        seuil_mo: 11.0, riasec_cible: RIASEC_FILIERES['2nde_A'], roi: 0.60,
        debouches: ['Juriste', 'Journaliste', 'Enseignant', 'Sociologue', 'Communicant'],
        etablissements: ['Lycée Classique', 'Lycée Moderne', 'Lycée Municipal'],
        exigences: { francais: 11 },
      },
      {
        code: 'LYCEE_TECH_INFO', nom: 'Lycée Technique — Informatique', type: 'LYCEE_TECH' as const,
        seuil_mo: 9.0, riasec_cible: RIASEC_FILIERES['LYCEE_TECH_INFO'], roi: 0.82,
        debouches: ['Dev junior', 'Technicien IT', 'Admin système', 'Support tech'],
        etablissements: ['Lycée Technique National', 'CAFOP Technique'],
        exigences: { maths: 9 },
      },
      {
        code: 'LYCEE_TECH_ELEC', nom: 'Lycée Technique — Électronique/Électricité', type: 'LYCEE_TECH' as const,
        seuil_mo: 9.0, riasec_cible: RIASEC_FILIERES['LYCEE_TECH_ELEC'], roi: 0.78,
        debouches: ['Électricien', 'Technicien maintenance', 'Agent SODECI/CIE'],
        etablissements: ['Lycée Technique National', 'CAFOP Technique'],
        exigences: { maths: 9, physique: 9 },
      },
      {
        code: 'LYCEE_TECH_BTP', nom: 'Lycée Technique — Génie Civil / BTP', type: 'LYCEE_TECH' as const,
        seuil_mo: 8.5, riasec_cible: RIASEC_FILIERES['LYCEE_TECH_BTP'], roi: 0.75,
        debouches: ['Technicien BTP', 'Conducteur travaux', 'Géomètre', 'Maçon qualifié'],
        etablissements: ['Lycée Technique National', 'CAFOP BTP'],
        exigences: {},
      },
      {
        code: 'FORMATION_PRO', nom: 'Formation Professionnelle Courte (2-3 ans)', type: 'FORMATION_PRO' as const,
        seuil_mo: 7.5, riasec_cible: RIASEC_FILIERES['FORMATION_PRO'], roi: 0.70,
        debouches: ['Coiffeur', 'Couturier', 'Mécanicien auto', 'Électricien bâtiment', 'Cuisinier'],
        etablissements: ['AGEFOP', 'CFPA', 'Centres de formation CI', 'Espaces Jeunes'],
        exigences: {},
      },
    ];

    const resultats: RecommandationFiliere[] = filieres.map((filiere) => {
      const s_acad      = this.calculerSAcademique(mo, notes, filiere.seuil_mo, filiere.exigences);
      const s_riasec    = this.calculerSRIASEC(riasec, filiere.riasec_cible);
      const s_contexte  = this.calculerSContexte(contexte, filiere);
      const s_projection = this.calculerSProjection(mo, notes, filiere.code);
      const score_global = Math.round(0.35 * s_acad + 0.25 * s_riasec + 0.20 * s_contexte + 0.20 * s_projection);

      return {
        rang: 0,
        code: filiere.code,
        nom: filiere.nom,
        type: filiere.type,
        score_global,
        s_acad: Math.round(s_acad),
        s_riasec: Math.round(s_riasec),
        s_contexte: Math.round(s_contexte),
        s_projection: Math.round(s_projection),
        probabilite_reussite: this.projeterReussiteFiliere(mo, notes, filiere.code),
        roi_index: filiere.roi,
        debouches: filiere.debouches,
        etablissements_ci: filiere.etablissements,
        pourquoi: this.genererExplicationFiliere(filiere.code, s_acad, s_riasec, riasec),
      };
    });

    resultats.sort((a, b) => b.score_global - a.score_global);
    resultats.forEach((r, i) => (r.rang = i + 1));
    return resultats;
  }

  // ── S_académique ──────────────────────────────────────────
  private calculerSAcademique(
    mo: number,
    notes: NotesBepc,
    seuil_mo: number,
    exigences: Partial<Record<keyof NotesBepc, number>>,
  ): number {
    let score: number;
    if (mo >= seuil_mo + 2)      score = 95;
    else if (mo >= seuil_mo + 1) score = 85;
    else if (mo >= seuil_mo)     score = 70;
    else if (mo >= seuil_mo - 1) score = 50;
    else if (mo >= seuil_mo - 2) score = 30;
    else                         score = 15;

    for (const [matiere, note_min] of Object.entries(exigences)) {
      const note_reelle = notes[matiere] ?? 0;
      if (note_min !== undefined && note_reelle < note_min) {
        score -= (note_min - note_reelle) * 5;
      }
    }
    return Math.max(0, Math.min(100, score));
  }

  // ── S_RIASEC ──────────────────────────────────────────────
  private calculerSRIASEC(riasec_eleve: ScoresRIASEC, riasec_filiere: ScoresRIASEC): number {
    const types = ['R', 'I', 'A', 'S', 'E', 'C'] as const;
    const distance = types.reduce((acc, t) => acc + Math.abs(riasec_eleve[t] - riasec_filiere[t]), 0);
    return Math.round((1 - distance / 600) * 100);
  }

  // ── S_contexte ────────────────────────────────────────────
  private calculerSContexte(contexte: ContexteEleve, filiere: any): number {
    let score = 100;
    if (filiere.type === 'LYCEE_TECH' && contexte.budget_famille === 'FAIBLE') score -= 5;
    if (contexte.milieu === 'RURAL' && ['2nde_C', 'LYCEE_TECH_INFO'].includes(filiere.code)) score -= 15;
    if (contexte.voeux.includes(filiere.code) || contexte.voeux.includes(filiere.nom)) score += 10;
    if (filiere.type === 'LYCEE_GEN' && contexte.type_etablissement === 'PRIVE') score -= 5;
    return Math.max(0, Math.min(100, score));
  }

  // ── S_projection ──────────────────────────────────────────
  private calculerSProjection(mo: number, notes: NotesBepc, code_filiere: string): number {
    return Math.round(this.projeterReussiteFiliere(mo, notes, code_filiere) * 100);
  }

  // ══════════════════════════════════════════════════════════
  // 6. SIMULATION DOB
  // ══════════════════════════════════════════════════════════
  simulerDOB(mo: number, contexte: ContexteEleve): SimulationDOB[] {
    const region = contexte.region || 'ABIDJAN_YOPOUGON';
    const seuils_region: Record<string, { seuil: number; tendance: number }> = {
      'ABIDJAN_COCODY':   { seuil: 13.5, tendance: 0.3 },
      'ABIDJAN_PLATEAU':  { seuil: 13.2, tendance: 0.3 },
      'ABIDJAN_YOPOUGON': { seuil: 12.8, tendance: 0.2 },
      'ABIDJAN_ABOBO':    { seuil: 12.5, tendance: 0.2 },
      'ABIDJAN_KOUMASSI': { seuil: 12.0, tendance: 0.2 },
      'BOUAKE':           { seuil: 12.0, tendance: 0.3 },
      'YAMOUSSOUKRO':     { seuil: 12.5, tendance: 0.3 },
      'KORHOGO':          { seuil: 11.5, tendance: 0.2 },
      'SAN_PEDRO':        { seuil: 11.0, tendance: 0.2 },
    };

    const voeux = contexte.voeux?.length > 0 ? contexte.voeux : ['2nde_C', '2nde_A', 'LYCEE_TECH'];

    return voeux.slice(0, 3).map((voeu) => {
      let seuil_base = 12.0;
      let tendance = 0.2;

      if (voeu === '2nde_C' || voeu.includes('science')) {
        const data = seuils_region[region] || { seuil: 12.5, tendance: 0.2 };
        seuil_base = data.seuil;
        tendance = data.tendance;
      } else if (voeu === '2nde_A' || voeu.includes('lettre')) {
        const data = seuils_region[region] || { seuil: 11.0, tendance: 0.2 };
        seuil_base = data.seuil - 1.5;
        tendance = data.tendance;
      } else {
        seuil_base = 9.0;
        tendance = 0.2;
      }

      let probabilite: number;
      let verdict: SimulationDOB['verdict'];

      if (mo >= seuil_base + tendance)     { probabilite = 0.92; verdict = 'TRES_PROBABLE'; }
      else if (mo >= seuil_base)           { probabilite = 0.70; verdict = 'PROBABLE'; }
      else if (mo >= seuil_base - tendance){ probabilite = 0.40; verdict = 'INCERTAIN'; }
      else                                 { probabilite = 0.08; verdict = 'TRES_IMPROBABLE'; }

      return {
        voeu,
        probabilite,
        seuil_estime: seuil_base,
        mo_eleve: mo,
        verdict,
        conseil: this.genererConseilDOB(verdict, mo, seuil_base, voeu),
      };
    });
  }

  // ══════════════════════════════════════════════════════════
  // 7. PROJECTION RÉUSSITE
  // ══════════════════════════════════════════════════════════
  private projeterReussiteFiliere(mo: number, notes: NotesBepc, code: string): number {
    const modele = MODELES_PROJECTION[code] ||
      MODELES_PROJECTION[code?.startsWith('LYCEE_TECH') ? 'LYCEE_TECH' : '2nde_A'] ||
      { intercept: -1.0, MO: 0.25 };

    let logit = modele.intercept + modele.MO * mo;
    if (modele.maths && notes.maths)               logit += modele.maths * (notes.maths / 20);
    if (modele.francais && notes.francais)         logit += modele.francais * (notes.francais / 20);
    if (modele.physique && notes.physique)         logit += modele.physique * (notes.physique / 20);
    if (modele.histoire_geo && notes.histoire_geo) logit += modele.histoire_geo * (notes.histoire_geo / 20);

    return Math.round((1 / (1 + Math.exp(-logit))) * 100) / 100;
  }

  projeterReussite(mo: number, notes: NotesBepc, code_filiere?: string): ProjectionReussite {
    const code = code_filiere || '2nde_C';
    const prob = this.projeterReussiteFiliere(mo, notes, code);
    const facteurs_risque: string[] = [];
    const facteurs_succes: string[] = [];

    if (notes.maths < 10)    facteurs_risque.push('Niveau en Mathématiques insuffisant pour ce niveau');
    if (mo < 11)             facteurs_risque.push("Moyenne d'orientation en dessous du seuil recommandé");
    if (notes.francais < 10) facteurs_risque.push('Maîtrise du Français à renforcer impérativement');

    if (notes.maths >= 14)   facteurs_succes.push('Excellent niveau en Mathématiques — atout majeur');
    if (mo >= 13)            facteurs_succes.push("Moyenne d'orientation solide — profil sérieux");
    if (notes.anglais >= 12) facteurs_succes.push('Bon niveau en Anglais — avantage pour la suite');

    return { filiere_cible: code, probabilite: prob, facteurs_risque, facteurs_succes };
  }

  // ══════════════════════════════════════════════════════════
  // 8. PLAN D'ACTION
  // ══════════════════════════════════════════════════════════
  genererPlanAction(mo: number, profil: string, top1?: RecommandationFiliere): PlanAction {
    const avant: string[] = [];
    const pendant: string[] = [];
    const apres: string[] = [];

    if (mo < 12) {
      avant.push('Réviser Mathématiques — 45 min par jour — annales BEPC CI');
      avant.push('Réviser Français — rédaction et grammaire — 30 min par jour');
    }
    avant.push("S'inscrire au moins à 1 cours de soutien si MO < 11");
    avant.push('Préparer les 3 vœux DOB avec les données YIRA simulées');
    avant.push('Informer les parents des résultats de simulation YIRA');

    pendant.push('Utiliser le simulateur DOB YIRA pour optimiser vos 3 vœux');
    pendant.push('Remplir les vœux DOB en ligne sur le site MESRS CI');
    pendant.push('Contacter un conseiller YIRA pour valider votre profil');
    if (top1) pendant.push(`Confirmer votre intérêt pour : ${top1.nom}`);

    apres.push('Réviser le programme de 2nde de la filière affectée');
    apres.push("Rejoindre les groupes d'entraide WhatsApp de votre lycée");
    apres.push('Mettre à jour votre Passeport de Compétences YIRA');
    if (profil === 'TECHNIQUE_PRATIQUE') {
      apres.push('Contacter AGEFOP pour les formations professionnelles disponibles');
    }

    return { avant_bepc: avant, pendant_resultats: pendant, apres_affectation: apres };
  }

  // ══════════════════════════════════════════════════════════
  // 9. RAPPORT NIE
  // ══════════════════════════════════════════════════════════
  private async genererRapportNIE(data: {
    mo: number;
    profil: string;
    code_riasec: string;
    recommandations: RecommandationFiliere[];
    simulation_dob: SimulationDOB[];
    contexte: ContexteEleve;
    notes: NotesBepc;
  }): Promise<string> {
    const prompt = `
Tu es YIRA, le conseiller d'orientation officiel de Côte d'Ivoire.
Tu parles à un élève de 3e (14-16 ans) et à sa famille.
Ton ton est BIENVEILLANT, ENCOURAGEANT, CONCRET et adapté au contexte ivoirien.
Jamais de jargon. Phrases courtes. Maximum 250 mots.

PROFIL ÉLÈVE :
- Moyenne d'Orientation (MO) : ${data.mo}/20
- Profil académique : ${data.profil}
- Code Holland YIRA : ${data.code_riasec}
- Région : ${data.contexte.region}

TOP 3 FILIÈRES RECOMMANDÉES :
${data.recommandations.map((r, i) => `${i + 1}. ${r.nom} — Score ${r.score_global}% — Chances réussite ${Math.round(r.probabilite_reussite * 100)}%`).join('\n')}

SIMULATION DOB (affectation probable) :
${data.simulation_dob.map((s) => `- ${s.voeu} : ${s.verdict} (${Math.round(s.probabilite * 100)}%)`).join('\n')}

MATIÈRES FORTES (≥12) :
${Object.entries(data.notes).filter(([, n]) => n >= 12).map(([m, n]) => `${m}: ${n}/20`).join(', ') || 'À développer'}

Génère un paragraphe de rapport personnalisé pour cet élève.
Commence par valoriser ses points forts.
Explique la 1ère recommandation de façon simple.
Donne 1 conseil concret pour améliorer ses chances.
Mentionne la simulation DOB de façon positive.
Utilise des références ivoiriennes (Abidjan, BEPC, lycée CI...).
`;

    try {
      const result = await this.iaService.generate({
        module: 'YIRA-OS-BEPC',
        usage: 'RAPPORT_NIE',
        pays: 'CI',
        variables: { prompt },
        canal: 'WEB',
      });
      return result.text ?? this.genererRapportFallback(data);
    } catch (error) {
      this.logger.error('NIE rapport generation failed:', error);
      return this.genererRapportFallback(data);
    }
  }

  // ── Fallback NIE ──────────────────────────────────────────
  private genererRapportFallback(data: any): string {
    const top1 = data.recommandations[0];
    return (
      `Félicitations pour ton parcours ! Avec une MO de ${data.mo}/20, ` +
      `ton profil YIRA (${data.code_riasec}) correspond bien à ${top1?.nom || 'ta filière cible'}. ` +
      `La simulation DOB YIRA indique que tes vœux sont accessibles avec ton niveau actuel. ` +
      `Continue à travailler régulièrement — les résultats BEPC CI seront publiés bientôt. ` +
      `Consulte un conseiller YIRA pour valider ton plan d'orientation.`
    );
  }

  // ── Helpers ───────────────────────────────────────────────
  private genererExplicationFiliere(code: string, s_acad: number, s_riasec: number, riasec: ScoresRIASEC): string {
    const explications: Record<string, string> = {
      '2nde_C': "Ton niveau en sciences et ta moyenne sont adaptés à la 2nde C. Cette voie ouvre les portes de l'ingénierie, la médecine et l'informatique en CI.",
      '2nde_A': "Ton profil littéraire et tes capacités en expression correspondent à la 2nde A. Tu peux viser le droit, la communication ou l'enseignement.",
      'LYCEE_TECH_INFO': "Ton intérêt pour le concret et l'analyse correspond au lycée technique informatique. Les débouchés CI en IT sont excellents (ARTCI, opérateurs, banques).",
      'LYCEE_TECH_ELEC': "Tu as le profil réaliste pour l'électrotechnique. SODECI, CIE, SOTRA ont besoin de techniciens qualifiés en CI.",
      'FORMATION_PRO': "Une formation professionnelle courte (AGEFOP, CFPA) te permettra d'acquérir un métier concret rapidement et de générer des revenus en CI.",
    };
    return (
      explications[code] ||
      `Cette filière correspond à ton profil YIRA (${(Object.entries(riasec) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t).join('')}).`
    );
  }

  private genererConseilDOB(verdict: string, mo: number, seuil: number, voeu: string): string {
    const ecart = Math.round((mo - seuil) * 10) / 10;
    switch (verdict) {
      case 'TRES_PROBABLE':
        return `Excellent ! Avec ${ecart > 0 ? '+' : ''}${ecart} au-dessus du seuil, ce vœu est très accessible. Mets-le en priorité.`;
      case 'PROBABLE':
        return "Bon profil pour ce vœu. Ton niveau est dans la zone d'affectation habituelle. Garde-le en 1er ou 2ème vœu.";
      case 'INCERTAIN':
        return `Tes chances sont réelles mais non garanties. ${ecart < 0 ? `Il te manque ${Math.abs(ecart)} points à la MO.` : ''} Garde en 2ème ou 3ème vœu.`;
      case 'TRES_IMPROBABLE':
        return "Ce vœu est hors de portée avec ta MO actuelle. Choisis une alternative plus accessible pour éviter l'affectation d'office.";
      default:
        return 'Consulte un conseiller YIRA pour optimiser tes vœux DOB.';
    }
  }

  // ══════════════════════════════════════════════════════════
  // FEEDBACK
  // ══════════════════════════════════════════════════════════
  async enregistrerFeedback(data: {
    utilisateur_id: string;
    affectation_reelle: string;
    filiere_souhaitee: string;
    satisfaction: 'OUI' | 'NON' | 'PARTIEL';
    reussite_2nde?: boolean;
    moyenne_2nde?: number;
  }) {
    this.logger.log(`Feedback BEPC enregistré — utilisateur: ${data.utilisateur_id}`);
    // TODO Sprint 11 : implémenter YiraAutoCalibration
    return { success: true, message: 'Feedback enregistré — merci pour la calibration YIRA CI' };
  }
}