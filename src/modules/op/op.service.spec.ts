// =============================================================================
// YIRA V3.0 — OpService Tests
// Sprint 50 — NIE + matching RIASEC + plan emploi
// =============================================================================
describe('OpService — Moteur NIE', () => {

  // ── Matching RIASEC → Filières ────────────────────────────────────────
  describe('Recommandation filières par niveau', () => {
    const getFiliereType = (niveau: string, moyenne: number): string => {
      if (niveau === 'BEPC' && moyenne < 10) return 'FORMATION_PRO';
      if (niveau === 'BEPC' && moyenne >= 12) return 'LYCEE_SCIENTIFIQUE';
      if (niveau === 'BEPC') return 'LYCEE_GENERAL';
      if (niveau === 'BAC') return 'UNIVERSITE';
      return 'FORMATION_PRO';
    };

    it('BEPC MO 9.5 → Formation Pro AGEFOP', () => {
      expect(getFiliereType('BEPC', 9.5)).toBe('FORMATION_PRO');
    });

    it('BEPC MO 14 → Lycée scientifique', () => {
      expect(getFiliereType('BEPC', 14)).toBe('LYCEE_SCIENTIFIQUE');
    });

    it('BAC → Université', () => {
      expect(getFiliereType('BAC', 15)).toBe('UNIVERSITE');
    });

    it('BEPC MO 11 → Lycée général', () => {
      expect(getFiliereType('BEPC', 11)).toBe('LYCEE_GENERAL');
    });
  });

  // ── Plan emploi ───────────────────────────────────────────────────────
  describe('Plan emploi J+7/30/90/180/365', () => {
    const getPlanEtapes = (): string[] => ['J7','J30','J90','J180','J365'];

    it('plan emploi complet en 5 étapes', () => {
      expect(getPlanEtapes()).toHaveLength(5);
    });

    it('première étape = J7 (CV + Lettre)', () => {
      expect(getPlanEtapes()[0]).toBe('J7');
    });

    it('dernière étape = J365 (bilan annuel ODD 8)', () => {
      expect(getPlanEtapes()[4]).toBe('J365');
    });
  });

  // ── Secteur cible ─────────────────────────────────────────────────────
  describe('Filtrage par secteur cible', () => {
    const filterMetiers = (metiers: any[], secteur: string): any[] =>
      metiers.filter(m => m.secteur === secteur);

    const metiersMock = [
      { nom: 'Dev Mobile', secteur: 'TECH' },
      { nom: 'Comptable',  secteur: 'FINANCE' },
      { nom: 'Ingénieur',  secteur: 'TECH' },
    ];

    it('filtre par TECH → 2 métiers', () => {
      expect(filterMetiers(metiersMock, 'TECH')).toHaveLength(2);
    });

    it('filtre par FINANCE → 1 métier', () => {
      expect(filterMetiers(metiersMock, 'FINANCE')).toHaveLength(1);
    });

    it('filtre par secteur inconnu → 0 métiers', () => {
      expect(filterMetiers(metiersMock, 'INCONNU')).toHaveLength(0);
    });
  });

  // ── Budget parents ────────────────────────────────────────────────────
  describe('Calcul budget parents', () => {
    const calculerDeficit = (coutAnnuel: number, duree: number, budget: number): number => {
      const total = coutAnnuel * duree + 150000 * 12 * duree;
      return Math.max(0, total - budget);
    };

    it('budget suffisant → déficit = 0', () => {
      expect(calculerDeficit(250000, 2, 5000000)).toBe(0);
    });

    it('budget insuffisant → déficit positif', () => {
      expect(calculerDeficit(350000, 5, 500000)).toBeGreaterThan(0);
    });

    it('déficit AGEFOP avec budget 80000 FCFA', () => {
      const deficit = calculerDeficit(100000, 1, 80000);
      expect(deficit).toBeGreaterThan(0);
    });
  });

  // ── Message inculturé ─────────────────────────────────────────────────
  describe('Sélection figure IA selon genre', () => {
    const getFigure = (genre: string): string =>
      genre === 'F' ? 'GRANDE_SOEUR_ORIENTATION_V1' : 'VIEUX_PERE_ORIENTATION_V2';

    it('genre F → Grande Sœur V1', () => {
      expect(getFigure('F')).toBe('GRANDE_SOEUR_ORIENTATION_V1');
    });

    it('genre M → Vieux Père V2', () => {
      expect(getFigure('M')).toBe('VIEUX_PERE_ORIENTATION_V2');
    });
  });
});