// =============================================================================
// YIRA V3.0 — PsyPService (Psychometric Provider Service)
// Sprint 48 — Orchestrateur multi-providers
// Vendor Independence : Sigmund + YIRA interne + CentraleTest + autres
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { IaService }              from '../../ia/ia.service';
import { CQCIService }            from '../cqci/cqci.service';
import { SigmundAdapter }         from './adapters/sigmund.adapter';
import { YiraAdapter }            from './adapters/yira.adapter';
import { InculturisationService } from './inculturation/inculturation.service';
import {
  PsyPAdapter, CandidatPsyP, QuestionPsyP,
  ReponsePsyP, ScoresBrutsPsyP,
} from './adapters/psyp.adapter';

export interface SessionBilan {
  session_id:  string;
  provider:    string;
  telephone:   string;
  tenant_id:   string;
  questions:   QuestionPsyP[];
  statut:      'OUVERT' | 'EN_COURS' | 'TERMINE' | 'ERREUR';
  created_at:  Date;
}

@Injectable()
export class PsyPService implements OnModuleInit {
  private readonly logger = new Logger(PsyPService.name);
  private pool!:     Pool;
  private poolCore!: Pool;
  private ready = false;
  private adapters: Map<string, PsyPAdapter> = new Map();

  constructor(
    private config:        ConfigService,
    private ia:            IaService,
    private cqci:          CQCIService,
    private inculturation: InculturisationService,
  ) {}

  async onModuleInit() {
    try {
      this.pool     = new Pool({ connectionString: this.config.get('DATABASE_URL_ORIENTATION') });
      this.poolCore = new Pool({ connectionString: this.config.get('DATABASE_URL_CORE') });
      const c       = await this.pool.connect();
      c.release();
      this.ready = true;

      // ── Providers externes ──────────────────────────────────────────────
      const sigmundClientId = this.config.get('SIGMUND_CLIENT_ID')    ?? '8937-6771-8414-4521';
      const sigmundProdCode = this.config.get('SIGMUND_PRODUCT_CODE') ?? '25';
      this.adapters.set('SIGMUND', new SigmundAdapter(sigmundClientId, sigmundProdCode));

      // ── Providers internes YIRA (avec poolCore pour base_core) ──────────
      this.adapters.set('YIRA',           new YiraAdapter(this.pool, 'RIASEC',    'STANDARD', this.poolCore));
      this.adapters.set('YIRA_EXPRESS',   new YiraAdapter(this.pool, 'RIASEC',    'EXPRESS',  this.poolCore));
      this.adapters.set('YIRA_COMPLET',   new YiraAdapter(this.pool, 'COMPLET',   'STANDARD', this.poolCore));
      this.adapters.set('YIRA_BIGFIVE',   new YiraAdapter(this.pool, 'BIGFIVE',   'STANDARD', this.poolCore));
      this.adapters.set('YIRA_VALEURS',   new YiraAdapter(this.pool, 'VALEURS',   'STANDARD', this.poolCore));
      this.adapters.set('YIRA_APTITUDES', new YiraAdapter(this.pool, 'APTITUDES', 'STANDARD', this.poolCore));
      this.adapters.set('YIRA_CQCI',      new YiraAdapter(this.pool, 'CQCI',      'STANDARD', this.poolCore));

      this.logger.log('[PSYP] PsyPService prêt — Providers: ' + Array.from(this.adapters.keys()).join(', '));
    } catch (e: any) {
      this.logger.warn('[PSYP] Erreur init: ' + e.message);
    }
  }

  async demarrerBilan(candidat: CandidatPsyP, provider = 'YIRA'): Promise<SessionBilan> {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error('Provider PsyP non disponible: ' + provider);
    this.logger.log('[PSYP] Démarrage bilan ' + provider + ' pour ' + candidat.telephone);

    const session = await adapter.ouvrirSession(candidat);

    if (provider === 'SIGMUND') {
      const sig = adapter as SigmundAdapter;
      await sig.enregistrerNom(session.session_id, candidat.prenom, candidat.nom);
      await sig.enregistrerSignaletiques(session.session_id, candidat);
    }

    const questionsOriginales  = await adapter.chargerQuestions(session.session_id);
    const questionsInculturees = await this.inculturation.inculturerQuestions(
      questionsOriginales, provider, candidat.tenant_id
    );
    await this.sauvegarderSession(session.session_id, provider, candidat, 'EN_COURS');

    return {
      session_id: session.session_id,
      provider,
      telephone:  candidat.telephone,
      tenant_id:  candidat.tenant_id,
      questions:  questionsInculturees,
      statut:     'EN_COURS',
      created_at: session.created_at,
    };
  }

  async soumettreReponses(
    sessionId:  string,
    telephone:  string,
    reponses:   ReponsePsyP[],
    provider =  'YIRA',
    trancheAge = '18-25',
    genre:      'M' | 'F' = 'M',
    tenantId =  'CI',
  ): Promise<any> {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error('Provider non disponible: ' + provider);
    this.logger.log('[PSYP] Soumission ' + reponses.length + ' réponses — session: ' + sessionId);

    await adapter.enregistrerReponses(sessionId, reponses);
    const scoresBruts      = await adapter.recupererScores(sessionId);
    const scoresNormalises = await this.normaliserScoresCI(scoresBruts, trancheAge, genre);
    const scg              = this.calculerSCG(scoresNormalises);
    const coaching         = await this.genererCoachingIA(scoresBruts, scoresNormalises, genre, tenantId);
    const rapportId        = await this.sauvegarderResultats(
      sessionId, telephone, provider, scoresBruts, scoresNormalises, scg, tenantId
    );

    let rapportPdfUrl: string | null = null;
    if (adapter.genererRapportPDF) {
      try { rapportPdfUrl = await adapter.genererRapportPDF(sessionId); }
      catch (e: any) { this.logger.warn('[PSYP] PDF non généré: ' + e.message); }
    }

    return {
      success:           true,
      rapport_id:        rapportId,
      provider,
      session_id:        sessionId,
      scores_bruts:      scoresBruts.scores,
      scores_normalises: scoresNormalises,
      scg,
      interpretation:    this.interpreterSCG(scg),
      coaching_ia:       coaching,
      rapport_pdf_url:   rapportPdfUrl,
      certification:     'YIRA-V3-CI-2026',
      message:           'Bilan ' + provider + ' certifié YIRA — Cohorte CI N=2847 (UFHB+CIRES)',
    };
  }

  private async normaliserScoresCI(
    scores:     ScoresBrutsPsyP,
    trancheAge: string,
    genre:      'M' | 'F',
  ): Promise<Record<string, number>> {
    const normalises: Record<string, number> = {};
    const riasecMap: Record<string, string> = {
      'R':'R','REALISTE':'R','REALISTIC':'R',
      'I':'I','INVESTIGATEUR':'I','INVESTIGATIVE':'I',
      'A':'A','ARTISTIQUE':'A','ARTISTIC':'A',
      'S':'S','SOCIAL':'S',
      'E':'E','ENTREPRENANT':'E','ENTERPRISING':'E',
      'C':'C','CONVENTIONNEL':'C','CONVENTIONAL':'C',
    };
    const riasecScores: Record<string, number> = {};
    for (const [critere, score] of Object.entries(scores.scores)) {
      const axe = riasecMap[critere.toUpperCase()];
      if (axe) riasecScores[axe] = score;
    }
    if (Object.keys(riasecScores).length >= 6) {
      const riasecNorm = await this.cqci.normaliserRIASEC(riasecScores as any, trancheAge, genre);
      Object.assign(normalises, riasecNorm);
    }
    for (const [k, v] of Object.entries(scores.scores)) {
      if (!normalises[k]) normalises[k] = v;
    }
    return normalises;
  }

  private calculerSCG(normalises: Record<string, number>): number {
    const vals = Object.values(normalises);
    if (vals.length === 0) return 50;
    const moyenne   = vals.reduce((a,b) => a+b, 0) / vals.length;
    const variance  = vals.reduce((a,b) => a + Math.pow(b-moyenne,2), 0) / vals.length;
    const coherence = Math.max(0, 100 - variance);
    return Math.round(coherence * 0.8 + moyenne * 0.2);
  }

  private interpreterSCG(scg: number): string {
    if (scg >= 80) return 'TRES_COHERENT — Recommandation directe certifiable';
    if (scg >= 60) return 'COHERENT — Recommandation avec vigilance';
    if (scg >= 40) return 'MODEREMENT_COHERENT — YIRA-RESCUE suggéré';
    return 'PEU_COHERENT — Validation humaine recommandée';
  }

  private async genererCoachingIA(
    bruts:      ScoresBrutsPsyP,
    normalises: Record<string, number>,
    genre:      'M' | 'F',
    tenantId:   string,
  ): Promise<string> {
    const figure  = genre === 'F' ? 'Grande Sœur' : 'Vieux Père';
    const topAxes = Object.entries(normalises).sort(([,a],[,b]) => b-a).slice(0,3).map(([k]) => k).join(', ');
    const prompt  =
      'Tu es le ' + figure + ' YIRA CI. Bilan ' + bruts.test_nom + ' terminé. ' +
      'Axes dominants cohorte CI : ' + topAxes + '. ' +
      'Message coaching bienveillant (max 200 mots), débouchés concrets CI. ' +
      'Ton ' + (genre === 'F' ? 'chaleureux' : 'sage et bienveillant') + '.';
    try {
      const result = await this.ia.generate({
        module:'YIRA_PSYP', usage:'COACHING_POST_BILAN',
        pays:tenantId, canal:'APP', variables:{}, customPrompt:prompt,
      });
      return result.text ?? 'Ton profil révèle de belles forces. YIRA t\'accompagne!';
    } catch (e: any) {
      return 'Ton profil YIRA est unique. Consulte ton Passeport de Compétences pour tes meilleures opportunités en CI.';
    }
  }

  private async sauvegarderSession(
    sessionId: string, provider: string, candidat: CandidatPsyP, statut: string,
  ): Promise<void> {
    if (!this.ready) return;
    try {
      await this.pool.query(
        'INSERT INTO yira_psyp_session (id,tenant_id,telephone,provider,assessment_id,statut,created_at) VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,NOW()) ON CONFLICT DO NOTHING',
        [candidat.tenant_id, candidat.telephone, provider, sessionId, statut]
      );
    } catch (e: any) { this.logger.warn('[PSYP] Session non sauvegardée: ' + e.message); }
  }

  private async sauvegarderResultats(
    sessionId: string, telephone: string, provider: string,
    bruts: ScoresBrutsPsyP, normalises: Record<string, number>,
    scg: number, tenantId: string,
  ): Promise<string> {
    if (!this.ready) return 'local-' + sessionId;
    try {
      const res = await this.pool.query(
        'INSERT INTO yira_psyp_resultat (id,tenant_id,telephone,provider,assessment_id,scores_bruts,scores_normalises,scg,certification,created_at) VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING id',
        [tenantId, telephone, provider, sessionId, JSON.stringify(bruts.scores), JSON.stringify(normalises), scg, 'YIRA-V3-CI-2026']
      );
      return res.rows[0]?.id ?? sessionId;
    } catch (e: any) {
      this.logger.warn('[PSYP] Résultats non sauvegardés: ' + e.message);
      return sessionId;
    }
  }

  getProviders(): string[] { return Array.from(this.adapters.keys()); }

  async ping(): Promise<any> {
    return {
      status:    'PSYP OK',
      providers: this.getProviders(),
      ready:     this.ready,
      timestamp: new Date().toISOString(),
    };
  }
}