// =============================================================================
// YIRA V3.0 — YiraAdapter Tests
// Sprint 52 — Sessions Redis (fallback Map en test)
// =============================================================================
import { YiraAdapter } from './yira.adapter';

describe('YiraAdapter — Calcul scores', () => {
  let adapter: YiraAdapter;
  const mockPool = { query: jest.fn(), connect: jest.fn() } as any;

  beforeEach(() => {
    adapter = new YiraAdapter(mockPool, 'RIASEC', 'STANDARD', mockPool, '');
  });

  afterAll(async () => {
    await new Promise(r => setTimeout(r, 100));
  });

  // ── RIASEC ────────────────────────────────────────────────────────────
  describe('calculerRIASEC (via recupererScores)', () => {
    it('devrait calculer 6 axes RIASEC', async () => {
      const session  = await adapter.ouvrirSession({
        telephone:'+2250708647166', prenom:'Test', nom:'User',
        genre:'M', age_code:2, diplome_code:5, experience_code:1, tenant_id:'CI',
      });
      const reponses = Array.from({ length: 60 }, (_, i) => ({
        question_numero: i + 1,
        reponse_index:   4,
      }));
      await adapter.enregistrerReponses(session.session_id, reponses);
      const scores = await adapter.recupererScores(session.session_id);
      expect(scores.scores).toBeDefined();
      expect(scores.criteres).toHaveLength(6);
      expect(['R','I','A','S','E','C']).toEqual(expect.arrayContaining(scores.criteres));
    });

    it('score = 0 si aucune réponse', async () => {
      const session = await adapter.ouvrirSession({
        telephone:'+2250708647166', prenom:'Test', nom:'User',
        genre:'M', age_code:2, diplome_code:5, experience_code:1, tenant_id:'CI',
      });
      await adapter.enregistrerReponses(session.session_id, []);
      const scores = await adapter.recupererScores(session.session_id);
      Object.values(scores.scores).forEach(v => expect(v).toBe(0));
    });

    it('score max = 100 si toutes réponses à 6', async () => {
      const session  = await adapter.ouvrirSession({
        telephone:'+2250708647166', prenom:'Test', nom:'User',
        genre:'M', age_code:2, diplome_code:5, experience_code:1, tenant_id:'CI',
      });
      const reponses = Array.from({ length: 60 }, (_, i) => ({
        question_numero: i + 1,
        reponse_index:   6,
      }));
      await adapter.enregistrerReponses(session.session_id, reponses);
      const scores = await adapter.recupererScores(session.session_id);
      Object.values(scores.scores).forEach(v => expect(v).toBe(100));
    });
  });

  // ── BigFive ───────────────────────────────────────────────────────────
  describe('calculerBigFive', () => {
    let adapterBF: YiraAdapter;

    beforeEach(() => {
      adapterBF = new YiraAdapter(mockPool, 'BIGFIVE', 'STANDARD', mockPool, '');
    });

    afterAll(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    it('devrait calculer 5 dimensions OCEAN', async () => {
      const session  = await adapterBF.ouvrirSession({
        telephone:'+2250708647166', prenom:'Test', nom:'User',
        genre:'F', age_code:2, diplome_code:5, experience_code:1, tenant_id:'CI',
      });
      const reponses = Array.from({ length: 40 }, (_, i) => ({
        question_numero: i + 1, reponse_index: 4,
      }));
      await adapterBF.enregistrerReponses(session.session_id, reponses);
      const scores = await adapterBF.recupererScores(session.session_id);
      expect(scores.criteres).toEqual(expect.arrayContaining(['O','C','E','A','N']));
    });

    it('Agréabilité CI amplifiée de 15%', async () => {
      const session  = await adapterBF.ouvrirSession({
        telephone:'+2250708647166', prenom:'Test', nom:'User',
        genre:'M', age_code:2, diplome_code:5, experience_code:1, tenant_id:'CI',
      });
      const reponses = Array.from({ length: 40 }, (_, i) => ({
        question_numero: i + 1, reponse_index: 4,
      }));
      await adapterBF.enregistrerReponses(session.session_id, reponses);
      const scores     = await adapterBF.recupererScores(session.session_id);
      const autresDims = ['O','C','E','N'].map(d => scores.scores[d]);
      const moyAutres  = autresDims.reduce((a,b) => a+b, 0) / autresDims.length;
      expect(scores.scores['A']).toBeGreaterThanOrEqual(moyAutres);
    });
  });

  // ── Session ───────────────────────────────────────────────────────────
  describe('gestion session', () => {
    it('ouvrirSession génère un ID YIRA-xxxx', async () => {
      const session = await adapter.ouvrirSession({
        telephone:'+2250708647166', prenom:'Test', nom:'User',
        genre:'M', age_code:2, diplome_code:5, experience_code:1, tenant_id:'CI',
      });
      expect(session.session_id).toMatch(/^YIRA-\d+-[a-z0-9]+$/);
      expect(session.provider).toBe('YIRA');
    });

    it('provider doit être YIRA', async () => {
      const session = await adapter.ouvrirSession({
        telephone:'+2250101987654', prenom:'Adjoua', nom:'Kone',
        genre:'F', age_code:2, diplome_code:6, experience_code:2, tenant_id:'CI',
      });
      expect(session.provider).toBe('YIRA');
      expect(session.candidat.telephone).toBe('+2250101987654');
    });

    it('session stockée en fallback Map si Redis absent', async () => {
      const session = await adapter.ouvrirSession({
        telephone:'+2250708647166', prenom:'Test', nom:'User',
        genre:'M', age_code:2, diplome_code:5, experience_code:1, tenant_id:'CI',
      });
      const info = await adapter.getSessionInfo(session.session_id);
      expect(info.existe).toBe(true);
      expect(info.stockage).toBe('MAP_FALLBACK');
    });
  });
});