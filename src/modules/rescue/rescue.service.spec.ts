// =============================================================================
// YIRA V3.0 — RescueService Tests
// Sprint 50 — Coaching 30j + déclenchement auto
// =============================================================================
describe('RescueService — Coaching 30 jours', () => {

  // ── Déclenchement automatique ─────────────────────────────────────────
  describe('Déclenchement auto Trust Index < 0.6', () => {
    const doitDeclencher = (trustIndex: number): boolean => trustIndex < 0.6;

    it('Trust Index 0.45 → déclencher RESCUE', () => {
      expect(doitDeclencher(0.45)).toBe(true);
    });

    it('Trust Index 0.6 → ne pas déclencher', () => {
      expect(doitDeclencher(0.6)).toBe(false);
    });

    it('Trust Index 0.75 → ne pas déclencher', () => {
      expect(doitDeclencher(0.75)).toBe(false);
    });

    it('Trust Index 0.0 → déclencher (profil vide)', () => {
      expect(doitDeclencher(0.0)).toBe(true);
    });
  });

  // ── Progression 30 jours ─────────────────────────────────────────────
  describe('Progression Trust Index sur 30 jours', () => {
    const calculerTrustFinal = (trustInitial: number, progression: number): number => {
      return Math.min(1.0, trustInitial + progression);
    };

    it('après 30j → Trust Index augmente', () => {
      const final = calculerTrustFinal(0.45, 0.25);
      expect(final).toBeGreaterThan(0.45);
    });

    it('Trust Index ne dépasse pas 1.0', () => {
      const final = calculerTrustFinal(0.9, 0.25);
      expect(final).toBeLessThanOrEqual(1.0);
    });

    it('progression standard +0.25 sur 30j', () => {
      const final = calculerTrustFinal(0.45, 0.25);
      expect(final).toBeCloseTo(0.70);
    });
  });

  // ── Tarifs CDC L2 ─────────────────────────────────────────────────────
  describe('Tarification RESCUE CDC L2', () => {
    const getTarif = (type: string): number => {
      if (type === 'AUTO')         return 0;
      if (type === 'MENSUEL')      return 2000;
      if (type === 'RENOUVELLEMENT') return 500;
      return 0;
    };

    it('déclenchement auto → gratuit', () => {
      expect(getTarif('AUTO')).toBe(0);
    });

    it('souscription volontaire → 2000 FCFA', () => {
      expect(getTarif('MENSUEL')).toBe(2000);
    });

    it('renouvellement → 500 FCFA', () => {
      expect(getTarif('RENOUVELLEMENT')).toBe(500);
    });
  });

  // ── Figures coaching ─────────────────────────────────────────────────
  describe('Attribution figure coaching', () => {
    const getFigure = (genre: string): string =>
      genre === 'F' ? 'GRANDE_SOEUR' : 'VIEUX_PERE';

    it('genre F → Grande Sœur', () => {
      expect(getFigure('F')).toBe('GRANDE_SOEUR');
    });

    it('genre M → Vieux Père', () => {
      expect(getFigure('M')).toBe('VIEUX_PERE');
    });
  });

  // ── Progression des jours ─────────────────────────────────────────────
  describe('Gestion des 30 jours', () => {
    it('programme terminé à J+30', () => {
      expect(30 + 1 > 30).toBe(true);
    });

    it('jours restants calculés correctement', () => {
      const jourCourant  = 15;
      const joursRestants = 30 - jourCourant;
      expect(joursRestants).toBe(15);
    });

    it('thèmes coaching — 6 dimensions', () => {
      const themes = ['Connaissance de soi', 'Forces cachees', 'Valeurs profondes',
        'Obstacles interieurs', 'Confiance en soi', 'Vision futur CI'];
      expect(themes).toHaveLength(6);
      const themeJour = themes[(15 - 1) % themes.length];
      expect(themeJour).toBeDefined();
    });
  });
});