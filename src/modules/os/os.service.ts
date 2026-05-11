// ============================================================
// YIRA — src/modules/os/os.service.ts  (Sprint 4A)
// Orientation Scolaire — RIASEC + Notes + Rapport NIE
// ============================================================
import { Injectable, Logger, Inject } from '@nestjs/common';
import { IaService }                  from '../../ia/ia.service';
import { PrismaClient }               from '@prisma/client';
import { PRISMA_ORIENTATION }         from '../../database/database.module';

// ── Types ─────────────────────────────────────────────────────

export interface ReponsesRiasec {
  // 30 questions — score 1 à 6 pour chacune
  // R = Réaliste, I = Investigateur, A = Artistique
  // S = Social, E = Entreprenant, C = Conventionnel
  [questionId: string]: number; // ex: { "Q1": 5, "Q2": 3, ... }
}

export interface NotesMatieresCI {
  maths?:        number;
  francais?:     number;
  sciences?:     number;
  anglais?:      number;
  histoire?:     number;
  philosophie?:  number;
  comptabilite?: number;
  eps?:          number;
  svt?:          number;
  physique?:     number;
}

export interface ContexteBeneficiaire {
  prenom:          string;
  age?:            number;
  zone:            'ABIDJAN' | 'AUTRE_URBAIN' | 'RURAL';
  milieu:          'URBAIN' | 'RURAL';
  type_etablissement?: 'PUBLIC' | 'PRIVE' | 'SOUS_EQUIPE';
  niveau:          'COLLEGE' | 'LYCEE' | 'SUPERIEUR';
  country_code:    string;
}

export interface SessionOsInput {
  beneficiaire:   ContexteBeneficiaire;
  reponses_riasec: ReponsesRiasec;
  notes?:         NotesMatieresCI;
  canal:          'APP' | 'WEB' | 'USSD';
}

export interface ProfilRiasec {
  R: number; I: number; A: number;
  S: number; E: number; C: number;
  code_holland: string;  // ex: "IES"
  dominant:     string;  // ex: "Investigateur"
}

export interface ResultatOs {
  session_id:     string;
  profil_riasec:  ProfilRiasec;
  mo_calculee?:   number;
  rapport_nie:    string;
  filieres_recommandees: string[];
  signal_conscience?: string;
  trust_index:    number;
  latency_ms:     number;
}

// ── Mapping questions → dimensions RIASEC ──────────────────
// 30 questions réparties : 5 par dimension
const QUESTIONS_DIMENSIONS: Record<string, string> = {
  Q1:'R', Q2:'R', Q3:'R', Q4:'R', Q5:'R',
  Q6:'I', Q7:'I', Q8:'I', Q9:'I', Q10:'I',
  Q11:'A', Q12:'A', Q13:'A', Q14:'A', Q15:'A',
  Q16:'S', Q17:'S', Q18:'S', Q19:'S', Q20:'S',
  Q21:'E', Q22:'E', Q23:'E', Q24:'E', Q25:'E',
  Q26:'C', Q27:'C', Q28:'C', Q29:'C', Q30:'C',
};

// Coefficients DOB CI (base de données → Sprint 5)
const COEFFS_DOB: Record<string, number> = {
  maths: 3, francais: 3, sciences: 2,
  anglais: 2, histoire: 1, philosophie: 1,
  comptabilite: 2, eps: 1, svt: 2, physique: 2,
};

// Filières CI par profil dominant
const FILIERES_PAR_PROFIL: Record<string, string[]> = {
  R: ['Génie Civil', 'Mécanique Industrielle', 'Électrotechnique', 'Agriculture CI'],
  I: ['Sciences Médicales', 'Informatique', 'Mathématiques', 'Physique-Chimie'],
  A: ['Arts et Design', 'Communication', 'Lettres Modernes', 'Architecture'],
  S: ['Sciences de l\'Éducation', 'Psychologie', 'Travail Social', 'Infirmier'],
  E: ['Commerce International', 'Gestion Entreprise', 'Marketing', 'Droit des Affaires'],
  C: ['Comptabilité-Gestion', 'Banque-Finance', 'Administration', 'Statistiques'],
};

@Injectable()
export class OsService {
  private readonly logger = new Logger(OsService.name);

  constructor(
    private iaService: IaService,
    @Inject(PRISMA_ORIENTATION) private prisma: PrismaClient,
  ) {}

  // ── Point d'entrée principal ──────────────────────────────
  async genererRapportOs(input: SessionOsInput): Promise<ResultatOs> {
    const start      = Date.now();
    const session_id = `OS_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    this.logger.log(`[OsService] Session ${session_id} — ${input.beneficiaire.prenom}`);

    // 1. Calculer le profil RIASEC
    const profil_riasec = this.calculerProfilRiasec(
      input.reponses_riasec,
      input.beneficiaire
    );

    // 2. Calculer la MO si notes fournies
    const mo_calculee = input.notes
      ? this.calculerMO(input.notes)
      : undefined;

    // 3. Recommander les filières
    const filieres_recommandees = this.recommanderFilieres(
      profil_riasec,
      mo_calculee,
      input.beneficiaire
    );

    // 4. Détecter le Signal Conscience
    const signal_conscience = this.detecterSignalConscience(
      profil_riasec,
      mo_calculee,
      input.beneficiaire
    );

    // 5. Calculer le Trust Index
    const trust_index = this.calculerTrustIndex(input);

    // 6. Générer le rapport NIE via IA
    const iaResult = await this.iaService.generate({
      module:   'YIRAOS',
      usage:    'NIE_RAPPORT',
      pays:     input.beneficiaire.country_code,
      canal:    input.canal,
      variables: {
        prenom:              input.beneficiaire.prenom,
        profil_riasec:       profil_riasec.code_holland,
        dominant:            profil_riasec.dominant,
        zone:                input.beneficiaire.zone,
        milieu:              input.beneficiaire.milieu,
        mo:                  mo_calculee ?? 'non fournie',
        filieres:            filieres_recommandees.join(', '),
        signal_conscience:   signal_conscience,
        trust_index:         trust_index,
      },
    });

    return {
      session_id,
      profil_riasec,
      mo_calculee,
      rapport_nie:           iaResult.text ?? 'Rapport en cours de génération',
      filieres_recommandees,
      signal_conscience,
      trust_index,
      latency_ms:            Date.now() - start,
    };
  }

  // ── 1. Calcul profil RIASEC ───────────────────────────────
  private calculerProfilRiasec(
    reponses: ReponsesRiasec,
    contexte: ContexteBeneficiaire
  ): ProfilRiasec {
    // Sommer les scores par dimension
    const scores: Record<string, number> = { R:0, I:0, A:0, S:0, E:0, C:0 };
    const counts:  Record<string, number> = { R:0, I:0, A:0, S:0, E:0, C:0 };

    for (const [qId, score] of Object.entries(reponses)) {
      const dim = QUESTIONS_DIMENSIONS[qId];
      if (dim) {
        scores[dim] += score;
        counts[dim]++;
      }
    }

    // Normaliser sur 100
    const normalises: Record<string, number> = {};
    for (const dim of ['R','I','A','S','E','C']) {
      const maxScore = (counts[dim] || 5) * 6;
      normalises[dim] = Math.round((scores[dim] / maxScore) * 100);
    }

    // Corrections contextuelles CI (inculturation NIE)
    if (contexte.milieu === 'RURAL') {
      normalises['S'] = Math.min(100, normalises['S'] + 15);
      normalises['R'] = Math.min(100, normalises['R'] + 10);
    }
    if (contexte.type_etablissement === 'SOUS_EQUIPE') {
      // Potentiel caché — correction +12
      const maxDim = Object.entries(normalises).sort((a,b) => b[1]-a[1])[0][0];
      normalises[maxDim] = Math.min(100, normalises[maxDim] + 12);
    }
    // Agréabilité CI — Social plus fort culturellement
    normalises['S'] = Math.min(100, Math.round(normalises['S'] * 1.15));

    // Code Holland (3 dimensions dominantes)
    const sorted = Object.entries(normalises)
      .sort((a, b) => b[1] - a[1]);
    const code_holland = sorted.slice(0, 3).map(([d]) => d).join('');
    const dominantMap: Record<string, string> = {
      R:'Réaliste', I:'Investigateur', A:'Artistique',
      S:'Social', E:'Entreprenant', C:'Conventionnel',
    };

    return {
      R: normalises['R'], I: normalises['I'], A: normalises['A'],
      S: normalises['S'], E: normalises['E'], C: normalises['C'],
      code_holland,
      dominant: dominantMap[sorted[0][0]],
    };
  }

  // ── 2. Calcul MO (Moyenne d'Orientation CI) ───────────────
  private calculerMO(notes: NotesMatieresCI): number {
    let total    = 0;
    let coeffSum = 0;
    for (const [matiere, coeff] of Object.entries(COEFFS_DOB)) {
      const note = (notes as any)[matiere];
      if (note !== undefined && note !== null) {
        total    += note * coeff;
        coeffSum += coeff;
      }
    }
    return coeffSum > 0 ? Math.round((total / coeffSum) * 100) / 100 : 0;
  }

  // ── 3. Recommandation filières ────────────────────────────
  private recommanderFilieres(
    profil: ProfilRiasec,
    mo?: number,
    contexte?: ContexteBeneficiaire
  ): string[] {
    const dims = profil.code_holland.split('');
    const filieres = new Set<string>();

    // Filières des 3 dimensions dominantes
    for (const dim of dims) {
      for (const f of (FILIERES_PAR_PROFIL[dim] ?? []).slice(0, 2)) {
        filieres.add(f);
      }
    }

    // Filtrer selon MO si disponible
    let result = Array.from(filieres).slice(0, 5);
    if (mo && mo < 10) {
      result = result.filter(f =>
        !f.includes('Médecine') && !f.includes('Mathématiques')
      );
    }

    return result;
  }

  // ── 4. Signal Conscience ──────────────────────────────────
  private detecterSignalConscience(
    profil: ProfilRiasec,
    mo?: number,
    contexte?: ContexteBeneficiaire
  ): string {
    const aptitudeMax = Math.max(profil.R, profil.I, profil.A, profil.S, profil.E, profil.C);

    // Potentiel caché : aptitudes élevées + contexte défavorable + notes faibles
    if (
      aptitudeMax > 70 &&
      contexte?.milieu === 'RURAL' &&
      mo !== undefined && mo < 12
    ) {
      return 'POTENTIEL_CACHE';
    }

    // Effort compensatoire : aptitudes moyennes mais notes bonnes
    if (aptitudeMax < 55 && mo !== undefined && mo > 14) {
      return 'EFFORT_COMPENSATOIRE';
    }

    // Obstacle environnemental
    if (contexte?.type_etablissement === 'SOUS_EQUIPE' && mo !== undefined && mo < 11) {
      return 'OBSTACLE_ENV';
    }

    return 'COHERENT';
  }

  // ── 5. Trust Index simplifié ──────────────────────────────
  private calculerTrustIndex(input: SessionOsInput): number {
    let score = 0;
    // RIASEC complet (30 questions)
    score += Object.keys(input.reponses_riasec).length >= 30 ? 40 : 20;
    // Notes fournies
    score += input.notes ? 20 : 0;
    // Contexte complet
    score += input.beneficiaire.zone ? 10 : 0;
    score += input.beneficiaire.milieu ? 10 : 0;
    // Bonus cohérence canal
    score += input.canal === 'APP' || input.canal === 'WEB' ? 20 : 10;
    return Math.min(100, score);
  }
}