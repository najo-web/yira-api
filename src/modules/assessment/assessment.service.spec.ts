// =============================================================================
// YIRA V3.0 — AssessmentService Tests
// Sprint 49 — Tests BigFive + Valeurs + SCG
// =============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentService }   from './assessment.service';

describe('AssessmentService', () => {
  let service: AssessmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssessmentService],
    }).compile();
    service = module.get<AssessmentService>(AssessmentService);
  });

  it('devrait être défini', () => {
    expect(service).toBeDefined();
  });

  // ── Big Five ──────────────────────────────────────────────────────────
  describe('calculerBigFive', () => {
    it('devrait retourner 5 dimensions OCEAN', () => {
      const reponses: Record<string, number> = {};
      for (let i = 1; i <= 40; i++) reponses['Q' + i] = 4;
      const result = service.calculerBigFive(reponses, 'URBAIN');
      expect(result).toHaveProperty('O');
      expect(result).toHaveProperty('C');
      expect(result).toHaveProperty('E');
      expect(result).toHaveProperty('A');
      expect(result).toHaveProperty('N');
      expect(result).toHaveProperty('dominant');
    });

    it('scores entre 0 et 100', () => {
      const reponses: Record<string, number> = {};
      for (let i = 1; i <= 40; i++) reponses['Q' + i] = 3;
      const result = service.calculerBigFive(reponses, 'URBAIN');
      ['O','C','E','A','N'].forEach(dim => {
        const val = result[dim as keyof typeof result] as number;
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      });
    });

    it('correctif CI — Rural Extraversion bonus', () => {
      const reponses: Record<string, number> = {};
      for (let i = 1; i <= 40; i++) reponses['Q' + i] = 4;
      const urbain = service.calculerBigFive(reponses, 'URBAIN');
      const rural  = service.calculerBigFive(reponses, 'RURAL');
      expect(rural.E).toBeGreaterThanOrEqual(urbain.E);
    });

    it('dominant doit être une valeur valide', () => {
      const reponses: Record<string, number> = {};
      for (let i = 1; i <= 40; i++) reponses['Q' + i] = i % 6 + 1;
      const result  = service.calculerBigFive(reponses, 'URBAIN');
      const valides = ['O','C','E','A','N',
        'Ouverture','Conscienciosité','Extraversion','Agréabilité','Névrosisme',
        'Openness','Conscientiousness','Agreeableness','Neuroticism'];
      expect(valides).toContain(result.dominant);
    });
  });

  // ── Valeurs ───────────────────────────────────────────────────────────
  describe('calculerValeurs', () => {
    it('devrait retourner 6 valeurs V1-V6 + dominant', () => {
      const reponses: Record<string, number> = {};
      for (let i = 1; i <= 42; i++) reponses['Q' + i] = 4;
      const result = service.calculerValeurs(reponses);
      expect(result).toHaveProperty('V1_autonomie');
      expect(result).toHaveProperty('V2_impact');
      expect(result).toHaveProperty('V3_securite');
      expect(result).toHaveProperty('V4_excellence');
      expect(result).toHaveProperty('V5_lien_social');
      expect(result).toHaveProperty('V6_reconnaissance');
      expect(result).toHaveProperty('dominant');
    });

    it('scores valeurs entre 0 et 100', () => {
      const reponses: Record<string, number> = {};
      for (let i = 1; i <= 42; i++) reponses['Q' + i] = 5;
      const result = service.calculerValeurs(reponses);
      ['V1_autonomie','V2_impact','V3_securite','V4_excellence','V5_lien_social','V6_reconnaissance'].forEach(v => {
        const val = result[v as keyof typeof result] as number;
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      });
    });
  });

  // ── SCG ───────────────────────────────────────────────────────────────
  describe('calculerSCG', () => {
    it('SCG doit être entre 0 et 100', () => {
      const scg = service.calculerSCG('I', 'O', 'V2_impact', 75);
      expect(scg).toBeGreaterThanOrEqual(0);
      expect(scg).toBeLessThanOrEqual(100);
    });

    it('profil cohérent I+O+V2 → SCG élevé', () => {
      const scg = service.calculerSCG('I', 'O', 'V2_impact', 80);
      expect(scg).toBeGreaterThan(40);
    });

    it('SCG est un nombre', () => {
      const scg = service.calculerSCG('R', 'N', 'V5_lien_social', 40);
      expect(typeof scg).toBe('number');
      expect(isNaN(scg)).toBe(false);
    });
  });
});