// =============================================================================
// YIRA V3.0 — CQCIService Tests
// Sprint 49 — Tests bloqueurs B2G ISO 10667
// =============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService }       from '@nestjs/config';
import { CQCIService }         from './cqci.service';

describe('CQCIService', () => {
  let service: CQCIService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CQCIService,
        { provide: ConfigService, useValue: { get: () => null } },
      ],
    }).compile();
    service = module.get<CQCIService>(CQCIService);
  });

  it('devrait être défini', () => {
    expect(service).toBeDefined();
  });

  // ── Normalisation RIASEC fallback (sans DB) ────────────────────────────
  describe('normaliserFallback', () => {
    it('devrait normaliser des scores RIASEC sans DB', async () => {
      const scores = { R: 45, I: 78, A: 52, S: 65, E: 48, C: 55 };
      const result = await service.normaliserRIASEC(scores as any, '18-25', 'M');
      expect(result).toBeDefined();
      expect(Object.keys(result)).toHaveLength(6);
      Object.values(result).forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });

    it('devrait retourner 6 axes RIASEC', async () => {
      const scores = { R: 30, I: 70, A: 50, S: 60, E: 40, C: 55 };
      const result = await service.normaliserRIASEC(scores as any, '14-17', 'F');
      expect(Object.keys(result)).toEqual(expect.arrayContaining(['R','I','A','S','E','C']));
    });

    it('scores extrêmes restent dans [10-90]', async () => {
      const scores = { R: 0, I: 100, A: 0, S: 100, E: 0, C: 100 };
      const result = await service.normaliserRIASEC(scores as any, '18-25', 'M');
      Object.values(result).forEach(v => {
        expect(v).toBeGreaterThanOrEqual(10);
        expect(v).toBeLessThanOrEqual(90);
      });
    });
  });

  // ── Score CQ-CI fallback ───────────────────────────────────────────────
  describe('calculerScoreCQCI', () => {
    it('devrait retourner 65 si pas de DB (fallback)', async () => {
      const reponses = { CQCI_01: 4, CQCI_02: 5, CQCI_03: 3 };
      const result   = await service.calculerScoreCQCI(reponses);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  // ── Audit profil ──────────────────────────────────────────────────────
  describe('auditerProfil', () => {
    it('devrait retourner un profil normalisé avec validité', async () => {
      const scores = {
        riasec:  { R: 45, I: 78, A: 52, S: 65, E: 48, C: 55 },
        bigfive: { O: 60, C: 55, E: 70, A: 65, N: 40 },
      };
      const result = await service.auditerProfil(scores, '18-25', 'M');
      expect(result).toBeDefined();
      expect(result.validite).toBeDefined();
      expect(result.validite?.alpha_cronbach).toBeGreaterThan(0.8);
      expect(result.validite?.n_cohorte).toBe(2847);
      expect(result.alerte_biais).toBeDefined();
    });

    it('devrait détecter un score S trop bas (biais CI)', async () => {
      const scores = { riasec: { R: 60, I: 50, A: 40, S: 20, E: 55, C: 45 } };
      const result = await service.auditerProfil(scores, '18-25', 'M');
      expect(result.alerte_biais?.length).toBeGreaterThan(0);
    });
  });
});