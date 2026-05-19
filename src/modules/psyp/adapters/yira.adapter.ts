// =============================================================================
// YIRA V3.0 — YIRA Internal Adapter
// Sprint 52 — Sessions Redis (production-ready)
// Remplace Map() mémoire par Redis TTL 2h
// =============================================================================
import { Logger } from '@nestjs/common';
import { Pool }   from 'pg';
import Redis      from 'ioredis';
import {
  PsyPAdapter, CandidatPsyP, SessionPsyP,
  QuestionPsyP, ReponsePsyP, ScoresBrutsPsyP,
} from './psyp.adapter';

export type YiraInstrument = 'RIASEC' | 'BIGFIVE' | 'VALEURS' | 'APTITUDES' | 'CQCI' | 'COMPLET';

const SESSION_TTL = 2 * 3600;
const KEY_PREFIX  = 'yira:psyp:session:';

export class YiraAdapter implements PsyPAdapter {
  readonly provider = 'YIRA';
  private readonly logger = new Logger(YiraAdapter.name);
  private redis:    Redis | null = null;
  private fallback: Map<string, any> = new Map();

  constructor(
    private pool:       Pool,
    private instrument: YiraInstrument = 'RIASEC',
    private format:     'EXPRESS' | 'STANDARD' | 'PRO' = 'STANDARD',
    private poolCore?:  Pool,
    redisUrl?:          string,
  ) {
    const url = redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
    try {
      this.redis = new Redis(url, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
      this.redis.on('connect', () => {
        this.logger.log('[YIRA-ADAPTER] Redis connecté: ' + url);
      });
      this.redis.on('error', (e) => {
        this.logger.warn('[YIRA-ADAPTER] Redis erreur — fallback Map: ' + e.message);
      });
    } catch (e: any) {
      this.logger.warn('[YIRA-ADAPTER] Redis non disponible — mode Map: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // SESSION REDIS — get/set
  // ---------------------------------------------------------------------------
  private async setSession(sessionId: string, data: any): Promise<void> {
    const key = KEY_PREFIX + sessionId;
    if (this.redis && this.redis.status === 'ready') {
      try {
        await this.redis.setex(key, SESSION_TTL, JSON.stringify(data));
        return;
      } catch (e: any) {
        this.logger.warn('[YIRA-ADAPTER] Redis setex erreur — fallback: ' + e.message);
      }
    }
    this.fallback.set(sessionId, data);
  }

  private async getSession(sessionId: string): Promise<any | null> {
    const key = KEY_PREFIX + sessionId;
    if (this.redis && this.redis.status === 'ready') {
      try {
        const raw = await this.redis.get(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e: any) {
        this.logger.warn('[YIRA-ADAPTER] Redis get erreur — fallback: ' + e.message);
      }
    }
    return this.fallback.get(sessionId) ?? null;
  }

  private async updateSession(sessionId: string, update: Partial<any>): Promise<void> {
    const existing = await this.getSession(sessionId) ?? {};
    await this.setSession(sessionId, { ...existing, ...update });
  }

  // ---------------------------------------------------------------------------
  // 1. Ouvrir session
  // ---------------------------------------------------------------------------
  async ouvrirSession(candidat: CandidatPsyP): Promise<SessionPsyP> {
    const sessionId   = 'YIRA-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const sessionData = { candidat, instrument: this.instrument, format: this.format };
    await this.setSession(sessionId, sessionData);
    const stockage = (this.redis && this.redis.status === 'ready') ? 'REDIS' : 'MAP';
    this.logger.log('[YIRA-ADAPTER] Session ouverte: ' + sessionId + ' | ' + this.instrument + ' | TTL: 2h | Stockage: ' + stockage);
    return { session_id: sessionId, provider: 'YIRA', candidat, created_at: new Date() };
  }

  // ---------------------------------------------------------------------------
  // 2. Charger questions
  // ---------------------------------------------------------------------------
  async chargerQuestions(sessionId: string): Promise<QuestionPsyP[]> {
    const session    = await this.getSession(sessionId);
    const instrument = session?.instrument ?? this.instrument;
    const format     = session?.format     ?? this.format;
    this.logger.log('[YIRA-ADAPTER] Chargement questions: ' + instrument + ' ' + format);
    switch (instrument) {
      case 'RIASEC':    return this.chargerQuestionsRIASEC(format);
      case 'BIGFIVE':   return this.chargerQuestionsBigFive();
      case 'VALEURS':   return this.chargerQuestionsValeurs();
      case 'APTITUDES': return this.chargerQuestionsAptitudes();
      case 'CQCI':      return this.chargerQuestionsCQCI();
      case 'COMPLET':   return this.chargerQuestionsComplet(format);
      default:          return this.chargerQuestionsRIASEC(format);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Enregistrer réponses
  // ---------------------------------------------------------------------------
  async enregistrerReponses(sessionId: string, reponses: ReponsePsyP[]): Promise<void> {
    await this.updateSession(sessionId, { reponses });
    this.logger.log('[YIRA-ADAPTER] ' + reponses.length + ' réponses stockées: ' + sessionId);
  }

  // ---------------------------------------------------------------------------
  // 4. Calculer scores
  // ---------------------------------------------------------------------------
  async recupererScores(sessionId: string): Promise<ScoresBrutsPsyP> {
    const session    = await this.getSession(sessionId);
    const reponses   = session?.reponses  ?? [];
    const instrument = session?.instrument ?? this.instrument;
    const candidat   = session?.candidat;
    this.logger.log('[YIRA-ADAPTER] Calcul scores: ' + instrument);

    let scores: Record<string, number> = {};
    switch (instrument) {
      case 'RIASEC':    scores = this.calculerRIASEC(reponses);    break;
      case 'BIGFIVE':   scores = this.calculerBigFive(reponses);   break;
      case 'VALEURS':   scores = this.calculerValeurs(reponses);   break;
      case 'APTITUDES': scores = this.calculerAptitudes(reponses); break;
      case 'CQCI':      scores = this.calculerCQCI(reponses);      break;
      case 'COMPLET': {
        scores = {
          ...this.calculerRIASEC(reponses.slice(0, 60)),
          ...this.calculerBigFive(reponses.slice(60, 100)),
          ...this.calculerValeurs(reponses.slice(100, 142)),
        };
        break;
      }
    }

    return {
      provider:      'YIRA',
      assessment_id: sessionId,
      candidat_nom:  (candidat?.prenom ?? '') + ' ' + (candidat?.nom ?? ''),
      test_nom:      'YIRA ' + instrument + ' (calibré CI)',
      scores,
      scores_bruts:  { ...scores },
      criteres:      Object.keys(scores),
      nb_questions:  reponses.length,
      duree_minutes: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // CALCUL SCORES
  // ---------------------------------------------------------------------------
  private calculerRIASEC(reponses: ReponsePsyP[]): Record<string, number> {
    const axes   = ['R','I','A','S','E','C'];
    const scores: Record<string, number> = { R:0, I:0, A:0, S:0, E:0, C:0 };
    const counts: Record<string, number> = { R:0, I:0, A:0, S:0, E:0, C:0 };
    reponses.forEach(r => {
      const axe   = axes[Math.floor((r.question_numero - 1) / 10) % 6];
      scores[axe]+= r.reponse_index;
      counts[axe]++;
    });
    axes.forEach(axe => {
      const max   = counts[axe] * 6;
      scores[axe] = max > 0 ? Math.round((scores[axe] / max) * 100) : 0;
    });
    return scores;
  }

  private calculerBigFive(reponses: ReponsePsyP[]): Record<string, number> {
    const INVERSES = new Set([2,4,6,8,10,12,14,16,22,24,26,28,32,34,36,38]);
    const dims     = ['O','C','E','A','N'];
    const scores: Record<string, number> = { O:0, C:0, E:0, A:0, N:0 };
    const counts: Record<string, number> = { O:0, C:0, E:0, A:0, N:0 };
    reponses.forEach(r => {
      const dim    = dims[Math.floor((r.question_numero - 1) / 8) % 5];
      const score  = INVERSES.has(r.question_numero) ? (7 - r.reponse_index) : r.reponse_index;
      scores[dim] += score;
      counts[dim]++;
    });
    dims.forEach(dim => {
      const max    = counts[dim] * 6;
      scores[dim]  = max > 0 ? Math.round((scores[dim] / max) * 100) : 0;
      if (dim === 'A') scores[dim] = Math.min(100, Math.round(scores[dim] * 1.15));
    });
    return scores;
  }

  private calculerValeurs(reponses: ReponsePsyP[]): Record<string, number> {
    const valeurs = ['V1_AUTONOMIE','V2_IMPACT','V3_SECURITE','V4_EXCELLENCE','V5_LIEN_SOCIAL','V6_RECONNAISSANCE'];
    const scores: Record<string, number> = {};
    const counts: Record<string, number> = {};
    valeurs.forEach(v => { scores[v] = 0; counts[v] = 0; });
    reponses.forEach(r => {
      const v      = valeurs[Math.floor((r.question_numero - 1) / 7) % 6];
      scores[v]   += r.reponse_index;
      counts[v]++;
    });
    valeurs.forEach(v => {
      const max  = counts[v] * 6;
      scores[v]  = max > 0 ? Math.round((scores[v] / max) * 100) : 0;
    });
    return scores;
  }

  private calculerAptitudes(reponses: ReponsePsyP[]): Record<string, number> {
    const apts  = ['A1_VERBAL','A2_NUMERIQUE','A3_LOGIQUE','A4_SPATIAL','A5_CREATIVITE'];
    const scores: Record<string, number> = {};
    const counts: Record<string, number> = {};
    apts.forEach(a => { scores[a] = 0; counts[a] = 0; });
    reponses.forEach(r => {
      const a      = apts[Math.floor((r.question_numero - 1) / 8) % 5];
      scores[a]   += r.reponse_index;
      counts[a]++;
    });
    apts.forEach(a => { scores[a] = counts[a] > 0 ? Math.round((scores[a] / counts[a]) * 100) : 0; });
    scores['SCORE_GLOBAL'] = Math.round(Object.values(scores).reduce((s,v) => s+v, 0) / apts.length);
    return scores;
  }

  private calculerCQCI(reponses: ReponsePsyP[]): Record<string, number> {
    const dims  = ['HIERARCHIE','SOLIDARITE','TRAVAIL','IDENTITE','RESILIENCE'];
    const scores: Record<string, number> = {};
    const counts: Record<string, number> = {};
    dims.forEach(d => { scores[d] = 0; counts[d] = 0; });
    reponses.forEach(r => {
      const d      = dims[Math.floor((r.question_numero - 1) / 3) % 5];
      scores[d]   += r.reponse_index;
      counts[d]++;
    });
    dims.forEach(d => {
      const max  = counts[d] * 6;
      scores[d]  = max > 0 ? Math.round((scores[d] / max) * 100) : 0;
    });
    scores['CQCI_GLOBAL'] = Math.round(Object.values(scores).reduce((s,v) => s+v, 0) / dims.length);
    return scores;
  }

  // ---------------------------------------------------------------------------
  // CHARGEMENT QUESTIONS
  // ---------------------------------------------------------------------------
  private async chargerQuestionsRIASEC(format: string): Promise<QuestionPsyP[]> {
    const db = this.poolCore ?? this.pool;
    try {
      const formatFilter = format === 'EXPRESS'
        ? "AND (format='EXPRESS' OR numero <= 6)"
        : format === 'PRO' ? '' : "AND format IN ('EXPRESS','STANDARD')";
      const res = await db.query(`
        SELECT numero, libelle, libelle_ussd, est_miroir
        FROM core.yira_riasec_questions
        WHERE tenant_id='CI' AND actif=true ${formatFilter}
        ORDER BY axe, numero LIMIT $1
      `, [format === 'EXPRESS' ? 36 : format === 'PRO' ? 90 : 60]);
      if (res.rows.length > 0) {
        return res.rows.map(r => ({
          numero: r.numero, libelle_original: r.libelle, libelle_incult: r.libelle,
          choix: ['Jamais','Rarement','Parfois','Souvent','Très souvent','Toujours'], nb_choix: 6,
        }));
      }
    } catch (e: any) {
      this.logger.warn('[YIRA-ADAPTER] Questions RIASEC depuis mock: ' + e.message);
    }
    return this.questionsMockRIASEC();
  }

  private async chargerQuestionsBigFive(): Promise<QuestionPsyP[]> {
    return Array.from({ length: 40 }, (_, i) => ({
      numero: i+1, libelle_original: 'BigFive Q'+(i+1),
      choix: ['Pas du tout','Pas d accord','Neutre','D accord','Tout à fait','Absolument'], nb_choix: 6,
    }));
  }

  private async chargerQuestionsValeurs(): Promise<QuestionPsyP[]> {
    return Array.from({ length: 42 }, (_, i) => ({
      numero: i+1, libelle_original: 'Valeurs Q'+(i+1),
      choix: ['Pas important','Peu important','Neutre','Important','Très important','Essentiel'], nb_choix: 6,
    }));
  }

  private async chargerQuestionsAptitudes(): Promise<QuestionPsyP[]> {
    return Array.from({ length: 40 }, (_, i) => ({
      numero: i+1, libelle_original: 'Aptitudes Q'+(i+1),
      choix: ['A','B','C','D'], nb_choix: 4,
    }));
  }

  private async chargerQuestionsCQCI(): Promise<QuestionPsyP[]> {
    return Array.from({ length: 15 }, (_, i) => ({
      numero: i+1, libelle_original: 'CQ-CI Q'+(i+1),
      choix: ['Pas du tout','Peu','Modérément','Assez','Beaucoup','Totalement'], nb_choix: 6,
    }));
  }

  private async chargerQuestionsComplet(format: string): Promise<QuestionPsyP[]> {
    const r = await this.chargerQuestionsRIASEC(format);
    const b = await this.chargerQuestionsBigFive();
    const v = await this.chargerQuestionsValeurs();
    return [...r, ...b, ...v];
  }

  private questionsMockRIASEC(): QuestionPsyP[] {
    const axes = ['R','I','A','S','E','C'];
    const qs: QuestionPsyP[] = [];
    axes.forEach((axe, ai) => {
      for (let i = 1; i <= 10; i++) {
        qs.push({
          numero: ai*10+i, libelle_original: 'Question '+axe+'-'+i+' (RIASEC '+axe+')',
          choix: ['Jamais','Rarement','Parfois','Souvent','Très souvent','Toujours'], nb_choix: 6,
        });
      }
    });
    return qs;
  }

  // ---------------------------------------------------------------------------
  // MONITORING
  // ---------------------------------------------------------------------------
  async getSessionInfo(sessionId: string): Promise<any> {
    const key = KEY_PREFIX + sessionId;
    const ttl = (this.redis && this.redis.status === 'ready') ? await this.redis.ttl(key) : -1;
    const data = await this.getSession(sessionId);
    return {
      session_id:   sessionId,
      existe:       !!data,
      ttl_secondes: ttl,
      instrument:   data?.instrument,
      nb_reponses:  data?.reponses?.length ?? 0,
      stockage:     (this.redis && this.redis.status === 'ready') ? 'REDIS' : 'MAP_FALLBACK',
    };
  }

  async nettoyerSession(sessionId: string): Promise<void> {
    const key = KEY_PREFIX + sessionId;
    if (this.redis && this.redis.status === 'ready') await this.redis.del(key).catch(() => {});
    this.fallback.delete(sessionId);
  }
}