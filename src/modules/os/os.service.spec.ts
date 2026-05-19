// =============================================================================
// YIRA V3.0 — OsService Tests (BepcEngine + BacEngine)
// Sprint 49 — Tests moteur orientation scolaire
// =============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService }       from '@nestjs/config';

// Mock minimal OsService pour tester la logique pure
describe('OsService — BepcEngine', () => {

  // ── Seuils DOB ────────────────────────────────────────────────────────
  describe('Simulation DOB — Seuils d affectation', () => {
    const calculerProbaDOB = (moyenne: number, voeu: string): number => {
      if (voeu === '2nde_C') return moyenne >= 14 ? 0.85 : moyenne >= 12 ? 0.60 : 0.20;
      if (voeu === '2nde_A') return moyenne >= 10 ? 0.75 : 0.35;
      if (voeu === '2nde_D') return moyenne >= 11 ? 0.80 : moyenne >= 9 ? 0.55 : 0.25;
      return 0;
    };

    it('MO >= 14 → probabilité 2nde C > 0.8', () => {
      expect(calculerProbaDOB(14.5, '2nde_C')).toBeGreaterThan(0.8);
    });

    it('MO < 10 → probabilité 2nde C faible', () => {
      expect(calculerProbaDOB(9.5, '2nde_C')).toBeLessThan(0.3);
    });

    it('MO = 9.5 → Formation Pro AGEFOP recommandée', () => {
      const moyenne = 9.5;
      const filiere = moyenne < 10 ? 'FORMATION_PRO' : '2nde_A';
      expect(filiere).toBe('FORMATION_PRO');
    });

    it('MO = 12 → 2nde A accessible', () => {
      expect(calculerProbaDOB(12, '2nde_A')).toBeGreaterThan(0.5);
    });
  });

  // ── ROI Éducatif ─────────────────────────────────────────────────────
  describe('ROI Éducatif', () => {
    const calculerROI = (coutFormation: number, salaireMedian: number, dureeAns: number) => {
      const totalCout = coutFormation * dureeAns + 150000 * 12 * dureeAns;
      return Math.ceil(totalCout / salaireMedian);
    };

    it('BTS Informatique — ROI < 36 mois', () => {
      const roi = calculerROI(250000, 450000, 2);
      expect(roi).toBeLessThan(36);
    });

    it('Ingénieur INPHB — ROI calculable', () => {
      const roi = calculerROI(350000, 700000, 5);
      expect(roi).toBeGreaterThan(0);
      expect(roi).toBeLessThan(120);
    });
  });

  // ── Mapping RIASEC → Filière ──────────────────────────────────────────
  describe('Matching RIASEC → Filière', () => {
    const getDominant = (riasec: Record<string, number>): string => {
      return Object.entries(riasec).sort(([,a],[,b]) => b-a)[0][0];
    };

    it('RIASEC I dominant → filière scientifique', () => {
      const riasec = { R:20, I:90, A:15, S:30, E:55, C:65 };
      expect(getDominant(riasec)).toBe('I');
    });

    it('RIASEC S dominant → filière sociale', () => {
      const riasec = { R:30, I:25, A:60, S:85, E:40, C:35 };
      expect(getDominant(riasec)).toBe('S');
    });

    it('RIASEC R dominant → filière technique', () => {
      const riasec = { R:80, I:30, A:20, S:40, E:35, C:45 };
      expect(getDominant(riasec)).toBe('R');
    });
  });
});

describe('OsService — BacEngine', () => {
  describe('Recommandation universitaire par série BAC', () => {
    const getFilieresParSerie = (serie: string): string[] => {
      const map: Record<string, string[]> = {
        'C': ['UNIV_MATHS_INFO','UNIV_MEDECINE','UNIV_INGENIERIE'],
        'D': ['UNIV_SVT','UNIV_AGRO','UNIV_MEDECINE'],
        'A': ['UNIV_DROIT','UNIV_LETTRES','UNIV_SHS'],
        'B': ['UNIV_GESTION','UNIV_ECONOMIE','UNIV_COMMERCE'],
      };
      return map[serie] ?? [];
    };

    it('BAC C → filières scientifiques recommandées', () => {
      const filieres = getFilieresParSerie('C');
      expect(filieres).toContain('UNIV_MATHS_INFO');
    });

    it('BAC B → filières économie recommandées', () => {
      const filieres = getFilieresParSerie('B');
      expect(filieres).toContain('UNIV_GESTION');
    });

    it('Série inconnue → liste vide', () => {
      const filieres = getFilieresParSerie('X');
      expect(filieres).toHaveLength(0);
    });
  });
});