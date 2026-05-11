// ============================================================
// YIRA — src/modules/assessment/assessment.service.ts
// Sprint 4B — Big Five + Valeurs + Aptitudes
// ============================================================
import { Injectable, Logger } from '@nestjs/common';

// ── Types ─────────────────────────────────────────────────────

export interface ReponsesBigFive {
  [questionId: string]: number; // Q1-Q40, score 1-6
}

export interface ReponsesValeurs {
  [questionId: string]: number; // Q1-Q42, score 1-6
}

export interface ReponsesAptitudes {
  [questionId: string]: number; // Q1-Q40, score 0 ou 1 (bonne/mauvaise réponse)
}

export interface ProfilBigFive {
  O: number; // Ouverture
  C: number; // Conscienciosité
  E: number; // Extraversion
  A: number; // Agréabilité (×1.5 CI)
  N: number; // Névrosisme (inversé = Stabilité)
  dominant: string;
}

export interface ProfilValeurs {
  V1_autonomie:     number;
  V2_impact:        number;
  V3_securite:      number;
  V4_excellence:    number;
  V5_lien_social:   number;
  V6_reconnaissance: number;
  dominant: string;
}

export interface ProfilAptitudes {
  A1_verbal:    number;
  A2_numerique: number;
  A3_logique:   number;
  A4_spatial:   number;
  A5_creativite: number;
  score_global: number;
}

export interface ProfilComplet {
  big_five?:  ProfilBigFive;
  valeurs?:   ProfilValeurs;
  aptitudes?: ProfilAptitudes;
  scg:        number; // Score de Cohérence Globale 0-100
}

// ── Items inversés Big Five (APA) ─────────────────────────────
// Ces items ont leur score inversé : score_reel = 7 - score_donne
const ITEMS_INVERSES_BF = new Set([
  'Q2','Q4','Q6','Q8','Q10',  // N inversés
  'Q12','Q14','Q16',           // A inversés
  'Q18','Q20',                 // C inversés
]);

// Mapping questions Big Five → dimensions OCEAN
const BF_DIMENSIONS: Record<string, string> = {
  Q1:'O',  Q2:'O',  Q3:'O',  Q4:'O',  Q5:'O',  Q6:'O',  Q7:'O',  Q8:'O',
  Q9:'C',  Q10:'C', Q11:'C', Q12:'C', Q13:'C', Q14:'C', Q15:'C', Q16:'C',
  Q17:'E', Q18:'E', Q19:'E', Q20:'E', Q21:'E', Q22:'E', Q23:'E', Q24:'E',
  Q25:'A', Q26:'A', Q27:'A', Q28:'A', Q29:'A', Q30:'A', Q31:'A', Q32:'A',
  Q33:'N', Q34:'N', Q35:'N', Q36:'N', Q37:'N', Q38:'N', Q39:'N', Q40:'N',
};

// Mapping questions Valeurs → dimensions V1-V6
const VALEURS_DIMENSIONS: Record<string, string> = {
  Q1:'V1',  Q2:'V1',  Q3:'V1',  Q4:'V1',  Q5:'V1',  Q6:'V1',  Q7:'V1',
  Q8:'V2',  Q9:'V2',  Q10:'V2', Q11:'V2', Q12:'V2', Q13:'V2', Q14:'V2',
  Q15:'V3', Q16:'V3', Q17:'V3', Q18:'V3', Q19:'V3', Q20:'V3', Q21:'V3',
  Q22:'V4', Q23:'V4', Q24:'V4', Q25:'V4', Q26:'V4', Q27:'V4', Q28:'V4',
  Q29:'V5', Q30:'V5', Q31:'V5', Q32:'V5', Q33:'V5', Q34:'V5', Q35:'V5',
  Q36:'V6', Q37:'V6', Q38:'V6', Q39:'V6', Q40:'V6', Q41:'V6', Q42:'V6',
};

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  // ── Big Five OCEAN ────────────────────────────────────────
  calculerBigFive(reponses: ReponsesBigFive, milieu: string): ProfilBigFive {
    const scores: Record<string, number[]> = { O:[], C:[], E:[], A:[], N:[] };

    for (const [qId, score] of Object.entries(reponses)) {
      const dim = BF_DIMENSIONS[qId];
      if (!dim) continue;
      // Appliquer l'inversion si nécessaire
      const scoreReel = ITEMS_INVERSES_BF.has(qId) ? 7 - score : score;
      scores[dim].push(scoreReel);
    }

    // Normaliser sur 100
    const normalises: Record<string, number> = {};
    for (const dim of ['O','C','E','A','N']) {
      const arr = scores[dim];
      if (arr.length === 0) { normalises[dim] = 50; continue; }
      const moy     = arr.reduce((a,b) => a+b, 0) / arr.length;
      normalises[dim] = Math.round(((moy - 1) / 5) * 100);
    }

    // Inculturation CI — Agréabilité culturellement plus forte ×1.15
    normalises['A'] = Math.min(100, Math.round(normalises['A'] * 1.15));

    // Correction rurale — Extraversion sociale plus élevée
    if (milieu === 'RURAL') {
      normalises['E'] = Math.min(100, normalises['E'] + 8);
    }

    // Névrosisme → Stabilité émotionnelle (inversé pour lecture positive)
    const stabilite = 100 - normalises['N'];

    const dims = [
      ['O', normalises['O']], ['C', normalises['C']],
      ['E', normalises['E']], ['A', normalises['A']],
    ] as [string, number][];
    const dominant = dims.sort((a,b) => b[1]-a[1])[0][0];
    const nomsDims: Record<string, string> = {
      O: 'Ouverture', C: 'Conscienciosité',
      E: 'Extraversion', A: 'Agréabilité',
    };

    return {
      O: normalises['O'],
      C: normalises['C'],
      E: normalises['E'],
      A: normalises['A'],
      N: stabilite, // retourné comme stabilité
      dominant: nomsDims[dominant] ?? 'Ouverture',
    };
  }

  // ── Valeurs & Motivations V1-V6 ───────────────────────────
  calculerValeurs(reponses: ReponsesValeurs): ProfilValeurs {
    const scores: Record<string, number[]> = {
      V1:[], V2:[], V3:[], V4:[], V5:[], V6:[],
    };

    for (const [qId, score] of Object.entries(reponses)) {
      const dim = VALEURS_DIMENSIONS[qId];
      if (dim) scores[dim].push(score);
    }

    const normalises: Record<string, number> = {};
    for (const dim of ['V1','V2','V3','V4','V5','V6']) {
      const arr = scores[dim];
      if (arr.length === 0) { normalises[dim] = 50; continue; }
      const moy = arr.reduce((a,b) => a+b, 0) / arr.length;
      normalises[dim] = Math.round(((moy - 1) / 5) * 100);
    }

    const sorted  = Object.entries(normalises).sort((a,b) => b[1]-a[1]);
    const nomsVal: Record<string, string> = {
      V1:'Autonomie', V2:'Impact Social', V3:'Sécurité',
      V4:'Excellence', V5:'Lien Social', V6:'Reconnaissance',
    };

    return {
      V1_autonomie:      normalises['V1'],
      V2_impact:         normalises['V2'],
      V3_securite:       normalises['V3'],
      V4_excellence:     normalises['V4'],
      V5_lien_social:    normalises['V5'],
      V6_reconnaissance: normalises['V6'],
      dominant: nomsVal[sorted[0][0]] ?? 'Autonomie',
    };
  }

  // ── Aptitudes Cognitives A1-A5 ────────────────────────────
  calculerAptitudes(reponses: ReponsesAptitudes): ProfilAptitudes {
    // 8 questions par dimension (A1-A5 = 40 questions)
    const dims: Record<string, { correct: number; total: number }> = {
      A1:{ correct:0, total:0 }, A2:{ correct:0, total:0 },
      A3:{ correct:0, total:0 }, A4:{ correct:0, total:0 },
      A5:{ correct:0, total:0 },
    };

    const dimMap = (qNum: number): string => {
      if (qNum <= 8)  return 'A1'; // Verbal
      if (qNum <= 16) return 'A2'; // Numérique
      if (qNum <= 24) return 'A3'; // Logique
      if (qNum <= 32) return 'A4'; // Spatial
      return 'A5';                  // Créativité
    };

    for (const [qId, score] of Object.entries(reponses)) {
      const num = parseInt(qId.replace('Q', ''));
      const dim = dimMap(num);
      dims[dim].total++;
      if (score === 1) dims[dim].correct++;
    }

    const scores: Record<string, number> = {};
    for (const [dim, data] of Object.entries(dims)) {
      scores[dim] = data.total > 0
        ? Math.round((data.correct / data.total) * 100)
        : 50;
    }

    const score_global = Math.round(
      (scores['A1'] + scores['A2'] + scores['A3'] +
       scores['A4'] + scores['A5']) / 5
    );

    return {
      A1_verbal:     scores['A1'],
      A2_numerique:  scores['A2'],
      A3_logique:    scores['A3'],
      A4_spatial:    scores['A4'],
      A5_creativite: scores['A5'],
      score_global,
    };
  }

  // ── Score de Cohérence Globale (SCG) ──────────────────────
  // Mesure la convergence entre les 4 instruments
  calculerSCG(
    riasecDominant?: string,
    bigFiveDominant?: string,
    valeursDominant?: string,
    aptitudesGlobal?: number,
  ): number {
    let score = 60; // base

    // Cohérence RIASEC ↔ Big Five
    if (riasecDominant && bigFiveDominant) {
      const coherences: Record<string, string[]> = {
        'I': ['Ouverture', 'Conscienciosité'],
        'E': ['Extraversion', 'Agréabilité'],
        'S': ['Agréabilité', 'Extraversion'],
        'A': ['Ouverture'],
        'R': ['Conscienciosité'],
        'C': ['Conscienciosité'],
      };
      if (coherences[riasecDominant]?.includes(bigFiveDominant)) {
        score += 20;
      }
    }

    // Aptitudes globales
    if (aptitudesGlobal !== undefined) {
      if (aptitudesGlobal > 70) score += 15;
      else if (aptitudesGlobal > 50) score += 8;
    }

    // Valeurs cohérentes
    if (valeursDominant) score += 5;

    return Math.min(100, score);
  }
}