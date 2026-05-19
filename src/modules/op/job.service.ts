// =============================================================================
// YIRA V3.0 — JobService (YIRA-OP)
// Sprint 42 — Matching offres emploi + Coaching entretien IA
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { IaService } from '../../ia/ia.service';

export interface ProfilCandidature {
  telephone:      string;
  tenant_id?:     string;
  niveau:         string;
  riasec_codes?:  string[];
  secteur_cible?: string;
  region?:        string;
  salaire_min?:   number;
  genre?:         'M' | 'F';
}

@Injectable()
export class JobService implements OnModuleInit {
  private readonly logger = new Logger(JobService.name);
  private pool!: Pool;
  private ready = false;

  constructor(
    private config: ConfigService,
    private ia:     IaService,
  ) {}

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_ORIENTATION') });
      const c    = await this.pool.connect();
      c.release();
      this.ready = true;
      this.logger.log('[JOB] JobService connecte a base_orientation');
    } catch (e: any) {
      this.logger.warn('[JOB] Erreur init: ' + e.message);
    }
  }

  async matcherOffres(profil: ProfilCandidature): Promise<any[]> {
    const tenantId = profil.tenant_id ?? 'CI';
    if (!this.ready) return this.offresMock(profil);
    try {
      const riasecCodes   = profil.riasec_codes ?? ['I', 'S'];
      const params: any[] = [tenantId, riasecCodes];
      let where = 'WHERE o.tenant_id = $1 AND o.statut = \'ACTIVE\'';
      if (profil.secteur_cible) { params.push(profil.secteur_cible); where += ' AND o.secteur = $' + params.length; }
      if (profil.region)        { params.push(profil.region);        where += ' AND o.region = $' + params.length; }
      params.push(profil.niveau);
      const niveauIdx = params.length;

      const res = await this.pool.query(`
        SELECT o.*,
          (CASE WHEN o.riasec_codes && $2 THEN 40 ELSE 0 END +
           CASE WHEN o.niveau_requis = $${niveauIdx} THEN 30 WHEN o.niveau_requis = 'BEPC' THEN 20 ELSE 10 END +
           30) as score_matching
        FROM yira_offre_emploi o ${where}
        ORDER BY score_matching DESC, o.created_at DESC LIMIT 10
      `, params);
      this.logger.log('[JOB] ' + res.rows.length + ' offres pour ' + profil.telephone);
      return res.rows;
    } catch (e: any) {
      this.logger.warn('[JOB] Erreur matching: ' + e.message);
      return this.offresMock(profil);
    }
  }

  async postuler(telephone: string, offreId: string, cvHash: string, tenantId = 'CI'): Promise<any> {
    try {
      const offre = await this.pool.query('SELECT * FROM yira_offre_emploi WHERE id=$1 AND tenant_id=$2 AND statut=$3', [offreId, tenantId, 'ACTIVE']);
      if (offre.rows.length === 0) return { success: false, message: 'Offre non trouvee ou expiree' };
      const existing = await this.pool.query('SELECT id FROM yira_candidature WHERE telephone=$1 AND offre_id=$2 AND tenant_id=$3', [telephone, offreId, tenantId]);
      if (existing.rows.length > 0) return { success: false, message: 'Candidature deja envoyee' };
      const res = await this.pool.query(
        'INSERT INTO yira_candidature (tenant_id, telephone, offre_id, statut, cv_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id, statut, created_at',
        [tenantId, telephone, offreId, 'ENVOYEE', cvHash]
      );
      await this.pool.query(
        'INSERT INTO yira_suivi_emploi (tenant_id, telephone, candidature_id, etape, statut) VALUES ($1,$2,$3,$4,$5)',
        [tenantId, telephone, res.rows[0].id, 'J0', 'EN_COURS']
      );
      this.logger.log('[JOB] Candidature: ' + telephone + ' → ' + offre.rows[0].titre);
      return { success: true, candidature_id: res.rows[0].id, offre: offre.rows[0].titre, entreprise: offre.rows[0].entreprise, message: 'Candidature envoyee ! Vous serez contacte sous 72h.' };
    } catch (e: any) {
      this.logger.error('[JOB] Erreur candidature: ' + e.message);
      return { success: false, message: 'Erreur: ' + e.message };
    }
  }

  async demarrerCoachingEntretien(telephone: string, metierCible: string, secteur: string, genre: 'M' | 'F' = 'M', tenantId = 'CI'): Promise<any> {
    const figure = genre === 'F' ? 'Grande Soeur' : 'Vieux Pere';
    const prompt = 'Tu es le coach entretien YIRA CI. Genere 5 questions pour le poste de ' + metierCible + ' secteur ' + secteur + '. ' +
      'Format JSON: {"questions":[{"id":1,"question":"...","conseil_figure":"...","critere":"..."}]} ' +
      'Conseils donnes par le ' + figure + ' (bienveillant, ancre CI). ' +
      'Questions: 1 motivation, 1 competence, 1 difficulte, 1 equipe, 1 futur.';
    try {
      const result = await this.ia.generate({ module: 'YIRA_OP', usage: 'COACHING_ENTRETIEN', pays: tenantId, canal: 'APP', variables: {}, customPrompt: prompt });
      const clean  = (result.text ?? '').replace(/```json|```/g, '').trim();
      let questions;
      try { questions = JSON.parse(clean).questions; } catch { questions = this.questionsMock(metierCible, secteur, figure); }
      const session = await this.pool.query(
        'INSERT INTO yira_coaching_entretien (tenant_id, telephone, metier_cible, secteur, nb_questions, statut, session_data) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [tenantId, telephone, metierCible, secteur, questions.length, 'EN_COURS', JSON.stringify({ questions, reponses: [] })]
      );
      this.logger.log('[JOB] Coaching demarre: ' + telephone + ' → ' + metierCible);
      return { success: true, session_id: session.rows[0].id, metier: metierCible, secteur, figure, questions, message: 'Simulez un vrai entretien ! Repondez a chaque question.' };
    } catch (e: any) {
      this.logger.error('[JOB] Erreur coaching: ' + e.message);
      return { success: false, message: 'Erreur: ' + e.message };
    }
  }

  async evaluerReponseEntretien(sessionId: string, questionId: number, reponse: string, genre: 'M' | 'F' = 'M', tenantId = 'CI'): Promise<any> {
    try {
      const session = await this.pool.query('SELECT * FROM yira_coaching_entretien WHERE id=$1 AND tenant_id=$2', [sessionId, tenantId]);
      if (session.rows.length === 0) return { success: false, message: 'Session non trouvee' };
      const data      = session.rows[0].session_data;
      const questions = data.questions ?? [];
      const question  = questions.find((q: any) => q.id === questionId);
      if (!question) return { success: false, message: 'Question non trouvee' };
      const figure = genre === 'F' ? 'Grande Soeur' : 'Vieux Pere';
      const prompt = 'Tu es le ' + figure + ' coach YIRA CI. Question: "' + question.question + '" Critere: ' + question.critere + '. Reponse: "' + reponse + '". Score 0-20, feedback bienveillant CI max 100 mots. JSON: {"score":15,"feedback":"...","point_fort":"...","a_ameliorer":"..."}';
      const result = await this.ia.generate({ module: 'YIRA_OP', usage: 'EVAL_ENTRETIEN', pays: tenantId, canal: 'APP', variables: {}, customPrompt: prompt });
      const clean  = (result.text ?? '').replace(/```json|```/g, '').trim();
      let evaluation;
      try { evaluation = JSON.parse(clean); } catch { evaluation = { score: 14, feedback: 'Bonne reponse ! Continue.', point_fort: 'Clarte', a_ameliorer: 'Exemples concrets CI' }; }
      const reponses = data.reponses ?? [];
      reponses.push({ question_id: questionId, reponse, score: evaluation.score });
      await this.pool.query('UPDATE yira_coaching_entretien SET session_data=$1, updated_at=NOW() WHERE id=$2', [JSON.stringify({ questions, reponses }), sessionId]);
      let scoreFinal: number | null = null;
      if (reponses.length >= questions.length) {
        scoreFinal = Math.round(reponses.reduce((a: number, r: any) => a + r.score, 0) / reponses.length);
        await this.pool.query('UPDATE yira_coaching_entretien SET score_final=$1, statut=$2, updated_at=NOW() WHERE id=$3', [scoreFinal, 'TERMINE', sessionId]);
        this.logger.log('[JOB] Coaching termine — score: ' + scoreFinal + '/20');
      }
      return { success: true, question_id: questionId, evaluation, score_final: scoreFinal, questions_restantes: questions.length - reponses.length, message: scoreFinal !== null ? 'Score: ' + scoreFinal + '/20 ' + (scoreFinal >= 14 ? '— Excellent !' : scoreFinal >= 10 ? '— Bon niveau !' : '— YIRA-RESCUE recommande.') : (questions.length - reponses.length) + ' question(s) restante(s)' };
    } catch (e: any) {
      this.logger.error('[JOB] Erreur evaluation: ' + e.message);
      return { success: false, message: 'Erreur: ' + e.message };
    }
  }

  async mettreAJourSuivi(telephone: string, candidatureId: string, etape: 'J30' | 'J90' | 'J180' | 'J365', note: string, emploiObtenu: boolean, salaireObtenu?: number, tenantId = 'CI'): Promise<any> {
    try {
      const colNote = 'note_' + etape.toLowerCase();
      await this.pool.query(
        'UPDATE yira_suivi_emploi SET ' + colNote + '=$1, etape=$2, emploi_obtenu=$3, salaire_obtenu=$4, updated_at=NOW() WHERE telephone=$5 AND candidature_id=$6 AND tenant_id=$7',
        [note, etape, emploiObtenu, salaireObtenu ?? null, telephone, candidatureId, tenantId]
      );
      this.logger.log('[JOB] Suivi ' + etape + ': ' + telephone);
      return { success: true, etape, emploi_obtenu: emploiObtenu };
    } catch (e: any) {
      this.logger.error('[JOB] Erreur suivi: ' + e.message);
      return { success: false, message: 'Erreur: ' + e.message };
    }
  }

  async statistiquesCohorte(tenantId = 'CI'): Promise<any> {
    if (!this.ready) return { total: 0, taux_insertion: 0 };
    try {
      const res = await this.pool.query(
        'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE emploi_obtenu=true) as emplois, ROUND(AVG(salaire_obtenu) FILTER (WHERE salaire_obtenu IS NOT NULL)) as salaire_moyen FROM yira_suivi_emploi WHERE tenant_id=$1',
        [tenantId]
      );
      const row   = res.rows[0];
      const total = parseInt(row.total);
      const emplois = parseInt(row.emplois);
      const taux  = total > 0 ? Math.round(emplois / total * 100) : 0;
      return { total_candidatures: total, emplois_obtenus: emplois, taux_insertion: taux, salaire_moyen: parseInt(row.salaire_moyen ?? 0), kpi_odd8: taux + '% taux insertion (cible ODD 8.6)' };
    } catch (e: any) {
      this.logger.warn('[JOB] Erreur stats: ' + e.message);
      return { total: 0, taux_insertion: 0 };
    }
  }

  private offresMock(profil: ProfilCandidature): any[] {
    return [
      { id: '1', titre: 'Developpeur Mobile Junior', entreprise: 'Orange CI', secteur: 'TECH',   region: 'ABIDJAN', type_contrat: 'CDI', salaire_min: 300000, salaire_max: 500000, score_matching: 80 },
      { id: '2', titre: 'Agent Commercial Wave',     entreprise: 'Wave CI',   secteur: 'FINANCE', region: 'ABIDJAN', type_contrat: 'CDI', salaire_min: 180000, salaire_max: 300000, score_matching: 65 },
    ];
  }

  private questionsMock(metier: string, secteur: string, figure: string): any[] {
    return [
      { id: 1, question: 'Pourquoi avez-vous choisi ' + metier + ' ?',             conseil_figure: figure + ': Soyez sincere, ancrez dans votre vecu CI.', critere: 'Motivation' },
      { id: 2, question: 'Citez une competence cle pour ' + secteur + '.',          conseil_figure: figure + ': Exemple concret observe a Abidjan.',         critere: 'Competence' },
      { id: 3, question: 'Decrivez une situation difficile surmontee.',              conseil_figure: figure + ': Methode STAR — Situation, Tache, Action, Resultat.', critere: 'Resilience' },
      { id: 4, question: 'Comment travaillez-vous en equipe ?',                     conseil_figure: figure + ': Mentionnez l esprit communautaire ivoirien.', critere: 'Equipe' },
      { id: 5, question: 'Ou vous voyez-vous dans 3 ans dans le secteur ' + secteur + ' ?', conseil_figure: figure + ': Ambitieux mais realiste par rapport au marche CI.', critere: 'Projet' },
    ];
  }

  isReady(): boolean { return this.ready; }
}