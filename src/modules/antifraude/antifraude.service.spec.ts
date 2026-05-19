// =============================================================================
// YIRA V3.0 — AntifraudeService Tests
// Sprint 50 — Trust Index + Triangle de Vérité
// =============================================================================
describe('AntifraudeService — Trust Index', () => {

  // ── Formule Trust Index CDC L3 §6.3 ──────────────────────────────────
  // Trust Index = (0.4 × Cohérence Interne) + (0.4 × Cohérence Inter-Sources) + (0.2 × Cohérence Comportementale)
  const calculerTrustIndex = (
    coherenceInterne:      number,
    coherenceInterSources: number,
    coherenceComportementale: number,
  ): number => {
    return (0.4 * coherenceInterne) +
           (0.4 * coherenceInterSources) +
           (0.2 * coherenceComportementale);
  };

  describe('Formule Trust Index CDC L3 §6.3', () => {
    it('profil parfait → Trust Index = 1.0', () => {
      const ti = calculerTrustIndex(1.0, 1.0, 1.0);
      expect(ti).toBe(1.0);
    });

    it('profil nul → Trust Index = 0.0', () => {
      const ti = calculerTrustIndex(0, 0, 0);
      expect(ti).toBe(0);
    });

    it('Trust Index entre 0 et 1', () => {
      const ti = calculerTrustIndex(0.7, 0.8, 0.6);
      expect(ti).toBeGreaterThanOrEqual(0);
      expect(ti).toBeLessThanOrEqual(1);
    });

    it('pondération correcte : CI=0.4, IS=0.4, CB=0.2', () => {
      const ti = calculerTrustIndex(1.0, 0.0, 0.0);
      expect(ti).toBeCloseTo(0.4);
    });

    it('Trust Index < 0.6 → déclenche YIRA-RESCUE', () => {
      const ti = calculerTrustIndex(0.5, 0.4, 0.6);
      expect(ti).toBeLessThan(0.6);
    });

    it('Trust Index >= 0.8 → profil certifiable', () => {
      const ti = calculerTrustIndex(0.9, 0.85, 0.8);
      expect(ti).toBeGreaterThanOrEqual(0.8);
    });
  });

  // ── Seuils décisionnels SCG CDC L3 §6.2 ──────────────────────────────
  describe('Seuils décisionnels SCG', () => {
    const interpreterSCG = (scg: number): string => {
      if (scg >= 80) return 'TRES_COHERENT';
      if (scg >= 60) return 'COHERENT';
      if (scg >= 40) return 'MODEREMENT_COHERENT';
      return 'PEU_COHERENT';
    };

    it('SCG >= 80 → TRES_COHERENT (certifiable)', () => {
      expect(interpreterSCG(85)).toBe('TRES_COHERENT');
    });

    it('SCG 60-79 → COHERENT (vigilance)', () => {
      expect(interpreterSCG(70)).toBe('COHERENT');
    });

    it('SCG 40-59 → MODEREMENT_COHERENT (RESCUE)', () => {
      expect(interpreterSCG(50)).toBe('MODEREMENT_COHERENT');
    });

    it('SCG < 40 → PEU_COHERENT (validation humaine)', () => {
      expect(interpreterSCG(35)).toBe('PEU_COHERENT');
    });

    it('SCG = 80 → seuil certifiable exact', () => {
      expect(interpreterSCG(80)).toBe('TRES_COHERENT');
    });

    it('SCG = 60 → seuil COHERENT exact', () => {
      expect(interpreterSCG(60)).toBe('COHERENT');
    });
  });

  // ── Détection fraude VAS ──────────────────────────────────────────────
  describe('Détection fraude VAS', () => {
    const detecterFraude = (nbTransactions: number, montantTotal: number, dureeMinutes: number): boolean => {
      const txParMinute  = nbTransactions / dureeMinutes;
      const montantMoyen = montantTotal / nbTransactions;
      return txParMinute > 10 || montantMoyen > 10000;
    };

    it('transactions normales → pas de fraude', () => {
      expect(detecterFraude(5, 250, 60)).toBe(false);
    });

    it('trop de transactions par minute → fraude', () => {
      expect(detecterFraude(100, 5000, 5)).toBe(true);
    });

    it('montant moyen trop élevé → fraude', () => {
      expect(detecterFraude(2, 25000, 60)).toBe(true);
    });
  });
});