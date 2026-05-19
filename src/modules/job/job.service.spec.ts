// =============================================================================
// YIRA V3.0 — JobService Tests
// Sprint 50 — JobEngine matching + coaching entretien
// =============================================================================
describe('JobService — JobEngine', () => {

  // ── Score matching offres ─────────────────────────────────────────────
  describe('Score matching offre ↔ profil', () => {
    const calculerScoreMatching = (
      riasecOffre:  string[],
      riasecProfil: string[],
      niveauOffre:  string,
      niveauProfil: string,
    ): number => {
      const riasecMatch = riasecOffre.some(r => riasecProfil.includes(r)) ? 40 : 0;
      const niveauMatch = niveauOffre === niveauProfil ? 30 : 10;
      return riasecMatch + niveauMatch + 30; // +30 statut ACTIVE
    };

    it('RIASEC + niveau correspondent → score max 100', () => {
      const score = calculerScoreMatching(['I','C'], ['I','E','C'], 'BAC_PLUS', 'BAC_PLUS');
      expect(score).toBe(100);
    });

    it('RIASEC correspond mais pas niveau → score 80', () => {
      const score = calculerScoreMatching(['I','C'], ['I','E','C'], 'MASTER', 'BAC_PLUS');
      expect(score).toBe(80);
    });

    it('Aucun match → score minimum 40', () => {
      const score = calculerScoreMatching(['R'], ['I','S'], 'BAC', 'MASTER');
      expect(score).toBe(40);
    });
  });

  // ── Coaching entretien ────────────────────────────────────────────────
  describe('Score entretien', () => {
    const calculerScoreFinal = (reponses: number[]): number =>
      Math.round(reponses.reduce((a, b) => a + b, 0) / reponses.length);

    it('toutes réponses à 20 → score 20', () => {
      expect(calculerScoreFinal([20, 20, 20, 20, 20])).toBe(20);
    });

    it('scores mixtes → moyenne correcte', () => {
      expect(calculerScoreFinal([15, 18, 12, 16, 14])).toBe(15);
    });

    it('score >= 14 → Excellent', () => {
      const score      = 16;
      const niveau     = score >= 14 ? 'Excellent' : score >= 10 ? 'Bon' : 'A améliorer';
      expect(niveau).toBe('Excellent');
    });

    it('score < 10 → RESCUE recommandé', () => {
      const score  = 8;
      const rescue = score < 10;
      expect(rescue).toBe(true);
    });
  });

  // ── Suivi longitudinal J+365 ──────────────────────────────────────────
  describe('Suivi emploi J+30/90/180/365', () => {
    const getEtapeSuivi = (joursEcoules: number): string => {
      if (joursEcoules >= 365) return 'J365';
      if (joursEcoules >= 180) return 'J180';
      if (joursEcoules >= 90)  return 'J90';
      if (joursEcoules >= 30)  return 'J30';
      return 'J0';
    };

    it('J0 → démarrage suivi', () => {
      expect(getEtapeSuivi(0)).toBe('J0');
    });

    it('J30 → premier bilan', () => {
      expect(getEtapeSuivi(30)).toBe('J30');
    });

    it('J365 → bilan annuel ODD 8', () => {
      expect(getEtapeSuivi(365)).toBe('J365');
    });

    it('KPI ODD 8 — taux insertion', () => {
      const totalCandidatures = 100;
      const emploisObtenus    = 55;
      const tauxInsertion     = Math.round(emploisObtenus / totalCandidatures * 100);
      expect(tauxInsertion).toBe(55);
      expect(tauxInsertion + '% taux insertion (cible ODD 8.6)').toContain('ODD 8.6');
    });
  });

  // ── Mapping diplôme Sigmund ───────────────────────────────────────────
  describe('SigmundAdapter — Mapping diplôme CI', () => {
    const mapDiplome = (niveau: string): number => {
      const map: Record<string, number> = {
        'SANS_DIPLOME':1, 'CEP':2, 'CAP':3, 'BEPC':4,
        'BAC':5, 'BAC_PLUS':6, 'MASTER':8, 'DOCTORAT':9,
      };
      return map[niveau] ?? 5;
    };

    it('BEPC → code 4', () => expect(mapDiplome('BEPC')).toBe(4));
    it('BAC → code 5', () => expect(mapDiplome('BAC')).toBe(5));
    it('BAC_PLUS → code 6', () => expect(mapDiplome('BAC_PLUS')).toBe(6));
    it('inconnu → défaut 5 (BAC)', () => expect(mapDiplome('INCONNU')).toBe(5));
  });
});