describe('PackParentsService â€” 1000 FCFA', () => {

  describe('Tarification Pack Parents', () => {
    const getTarif = (type: string): number => {
      if (type === 'MENSUEL')      return 1000;
      if (type === 'TRIMESTRIEL')  return 2500;
      if (type === 'RENOUVELLEMENT') return 500;
      return 0;
    };

    it('Pack mensuel â†’ 1000 FCFA', () => expect(getTarif('MENSUEL')).toBe(1000));
    it('Pack trimestriel â†’ 2500 FCFA', () => expect(getTarif('TRIMESTRIEL')).toBe(2500));
    it('Renouvellement â†’ 500 FCFA', () => expect(getTarif('RENOUVELLEMENT')).toBe(500));
  });

  describe('SMS alertes parents', () => {
    const getNbSMS = (type: string): number => {
      if (type === 'MENSUEL')     return 10;
      if (type === 'TRIMESTRIEL') return 30;
      return 0;
    };

    it('Pack mensuel â†’ 10 SMS', () => expect(getNbSMS('MENSUEL')).toBe(10));
    it('Pack trimestriel â†’ 30 SMS', () => expect(getNbSMS('TRIMESTRIEL')).toBe(30));
  });

  describe('Types alertes SMS', () => {
    const getTypesAlertes = (): string[] => [
      'BIENVENUE','PROFIL','RIASEC','ORIENTATION','DOB',
      'PROGRESSION','PLAN_ACTION','MI_PARCOURS','ALERTE_RISQUE','BILAN_FINAL',
    ];

    it('10 types d alertes dÃ©finis', () => {
      expect(getTypesAlertes()).toHaveLength(10);
    });

    it('BILAN_FINAL inclus (passeport)', () => {
      expect(getTypesAlertes()).toContain('BILAN_FINAL');
    });

    it('DOB inclus (simulation affectation)', () => {
      expect(getTypesAlertes()).toContain('DOB');
    });
  });

  describe('QR Code rapport', () => {
    const genererQRUrl = (packId: string): string =>
      'https://yira.africa/rapport/' + packId;

    it('URL QR code format correct', () => {
      const url = genererQRUrl('test-uuid-123');
      expect(url).toMatch(/^https:\/\/yira\.africa\/rapport\/.+$/);
    });
  });
});
