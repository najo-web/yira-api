// =============================================================================
// YIRA V3.0 — Sigmund SOAP Adapter
// Sprint 48 — Webservices Sigmund V3.4
// URL : http://www.webservicesigmundtest.sigmundtest.com
// CLIENT_ID : 8937-6771-8414-4521 | PRODUCT_CODE : 25
// =============================================================================
import { Logger } from '@nestjs/common';
import * as xml2js from 'xml2js';
import {
  PsyPAdapter, CandidatPsyP, SessionPsyP,
  QuestionPsyP, ReponsePsyP, ScoresBrutsPsyP,
} from './psyp.adapter';

export class SigmundAdapter implements PsyPAdapter {
  readonly provider = 'SIGMUND';
  private readonly logger = new Logger(SigmundAdapter.name);
  private readonly baseUrl = 'http://www.webservicesigmundtest.sigmundtest.com';
  private readonly clientId: string;
  private readonly productCode: string;

  constructor(clientId: string, productCode = '25') {
    this.clientId    = clientId;
    this.productCode = productCode;
  }

  // ---------------------------------------------------------------------------
  // WS1 — Ouvrir une session de test
  // ---------------------------------------------------------------------------
  async ouvrirSession(candidat: CandidatPsyP): Promise<SessionPsyP> {
    this.logger.log('[SIGMUND] WS1 — Setup test pour ' + candidat.telephone);
    try {
      const url = this.baseUrl +
        '/sigmundtest_1_setup_quick_test(' +
        '"' + this.clientId + '",' +
        '"' + this.productCode + '",' +
        '"fr")';

      const res  = await fetch(url, { method: 'GET' });
      const text = await res.text();
      const data = await this.parseXML(text);

      if (data?.erreur_bool === 'true') {
        throw new Error('Sigmund WS1 erreur: ' + data?.erreur);
      }

      const assessmentId = String(data?.value_integer?.int ?? data?.value_integer ?? '');
      const login        = data?.string?.[0] ?? '';
      const password     = data?.string?.[1] ?? '';

      this.logger.log('[SIGMUND] Session ouverte: assessment_id=' + assessmentId);

      return {
        session_id: assessmentId,
        provider:   'SIGMUND',
        candidat,
        created_at: new Date(),
        login,
        password,
      };
    } catch (e: any) {
      this.logger.error('[SIGMUND] WS1 erreur: ' + e.message);
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // WS2 — Enregistrer nom du candidat
  // ---------------------------------------------------------------------------
  async enregistrerNom(sessionId: string, prenom: string, nom: string): Promise<void> {
    const url = this.baseUrl +
      '/sigmundtest_2_register_name(' +
      '"' + this.clientId + '",' +
      '"' + sessionId + '",' +
      '"' + this.sanitize(prenom) + '",' +
      '"' + this.sanitize(nom) + '")';

    const res  = await fetch(url, { method: 'GET' });
    const text = await res.text();
    const data = await this.parseXML(text);

    if (data?.erreur_bool === 'true') {
      throw new Error('Sigmund WS2 erreur: ' + data?.erreur);
    }
    this.logger.log('[SIGMUND] WS2 — Nom enregistré: ' + prenom + ' ' + nom);
  }

  // ---------------------------------------------------------------------------
  // WS3 — Enregistrer signalétiques (genre, âge, diplôme...)
  // ---------------------------------------------------------------------------
  async enregistrerSignaletiques(sessionId: string, candidat: CandidatPsyP): Promise<void> {
    // Mapping YIRA → Sigmund signalétiques
    const signaux = [
      { no: 1, val: candidat.genre === 'M' ? 1 : 2 },      // Sexe
      { no: 2, val: candidat.age_code },                    // Age
      { no: 3, val: candidat.experience_code },              // Expérience
      { no: 4, val: candidat.diplome_code },                 // Diplôme
      { no: 5, val: candidat.formation_code ?? 4 },          // Formation (Scientifique défaut)
      { no: 6, val: candidat.statut_code ?? 7 },             // Statut (Etudiant défaut)
    ];

    for (const signal of signaux) {
      const url = this.baseUrl +
        '/sigmundtest_3_register_signal_no(' +
        '"' + this.clientId + '",' +
        '"' + sessionId + '",' +
        '"' + signal.no + '",' +
        '"' + signal.val + '")';

      const res  = await fetch(url, { method: 'GET' });
      const text = await res.text();
      await this.parseXML(text);
    }
    this.logger.log('[SIGMUND] WS3 — Signalétiques enregistrées');
  }

  // ---------------------------------------------------------------------------
  // WS4 READ — Charger toutes les questions
  // ---------------------------------------------------------------------------
  async chargerQuestions(sessionId: string): Promise<QuestionPsyP[]> {
    this.logger.log('[SIGMUND] WS4 READ — Chargement questions session: ' + sessionId);
    const url = this.baseUrl +
      '/sigmundtest_4_read_question_1_to_x(' +
      '"' + this.clientId + '",' +
      '"' + sessionId + '")';

    const res  = await fetch(url, { method: 'GET' });
    const text = await res.text();
    const data = await this.parseXML(text);

    if (data?.erreur_bool === 'true') {
      throw new Error('Sigmund WS4 erreur: ' + data?.erreur);
    }

    const questions: QuestionPsyP[] = [];
    const labels = Array.isArray(data?.label_question)
      ? data.label_question
      : [data?.label_question].filter(Boolean);

    const r1s = this.toArray(data?.r1);
    const r2s = this.toArray(data?.r2);
    const r3s = this.toArray(data?.r3);
    const r4s = this.toArray(data?.r4);
    const r5s = this.toArray(data?.r5);
    const r6s = this.toArray(data?.r6);
    const nbReps = this.toArray(data?.value_nb_rep);

    for (let i = 0; i < labels.length; i++) {
      const nbChoix = parseInt(nbReps[i] ?? '4');
      const choix   = [r1s[i], r2s[i], r3s[i], r4s[i], r5s[i], r6s[i]]
        .filter(Boolean)
        .slice(0, nbChoix);

      questions.push({
        numero:           i + 1,
        libelle_original: labels[i] ?? '',
        choix,
        nb_choix:         nbChoix,
      });
    }

    this.logger.log('[SIGMUND] WS4 — ' + questions.length + ' questions chargées');
    return questions;
  }

  // ---------------------------------------------------------------------------
  // WS4 WRITE — Enregistrer les réponses
  // ---------------------------------------------------------------------------
  async enregistrerReponses(sessionId: string, reponses: ReponsePsyP[]): Promise<void> {
    this.logger.log('[SIGMUND] WS4 WRITE — ' + reponses.length + ' réponses');

    // Construire la structure sigmund_reponse
    const repStr = reponses.map(r => r.reponse_index).join(',');
    const url    = this.baseUrl +
      '/sigmundtest_4_write_question_1_to_x(' +
      '"' + this.clientId + '",' +
      '"' + sessionId + '",' +
      '"' + repStr + '")';

    const res  = await fetch(url, { method: 'GET' });
    const text = await res.text();
    const data = await this.parseXML(text);

    if (data?.erreur_bool === 'true') {
      throw new Error('Sigmund WS4W erreur: ' + data?.erreur);
    }
    this.logger.log('[SIGMUND] WS4 WRITE — Réponses enregistrées');
  }

  // ---------------------------------------------------------------------------
  // WS6 — Récupérer les scores bruts
  // ---------------------------------------------------------------------------
  async recupererScores(sessionId: string): Promise<ScoresBrutsPsyP> {
    this.logger.log('[SIGMUND] WS6 — Récupération scores: ' + sessionId);
    const url = this.baseUrl +
      '/sigmundtest_6_assessement2data(' +
      '"' + this.clientId + '",' +
      '"' + this.productCode + '",' +
      '"' + sessionId + '")';

    const res  = await fetch(url, { method: 'GET' });
    const text = await res.text();
    const data = await this.parseXML(text);

    // Parser sigmund_candidat
    const candidat = data?.sigmund_candidat ?? data;
    const scores:      Record<string, number> = {};
    const scoresBruts: Record<string, number> = {};
    const criteres:    string[] = [];

    const scoresArr  = this.toArray(candidat?.scores?.int  ?? candidat?.scores);
    const bruts      = this.toArray(candidat?.scores_brut?.int ?? candidat?.scores_brut);
    const criteresArr = this.toArray(candidat?.critere?.string ?? candidat?.critere);

    criteresArr.forEach((crit: string, i: number) => {
      criteres.push(crit);
      scores[crit]      = parseInt(scoresArr[i] ?? '0');
      scoresBruts[crit] = parseInt(bruts[i] ?? '0');
    });

    this.logger.log('[SIGMUND] WS6 — Scores: ' + Object.keys(scores).join(', '));

    return {
      provider:      'SIGMUND',
      assessment_id: sessionId,
      candidat_nom:  (candidat?.nom ?? '') + ' ' + (candidat?.prenom ?? ''),
      test_nom:      candidat?.test ?? 'Sigmund Test',
      scores,
      scores_bruts:  scoresBruts,
      criteres,
      nb_questions:  parseInt(candidat?.nb_questions ?? '0'),
      duree_minutes: Math.round(parseInt(candidat?.duree ?? '0') / 60),
      raw_data:      candidat,
    };
  }

  // ---------------------------------------------------------------------------
  // WS5 — Générer rapport PDF
  // ---------------------------------------------------------------------------
  async genererRapportPDF(sessionId: string, email?: string): Promise<string> {
    const url = this.baseUrl +
      '/sigmundtest_5_assessement2file_v4(' +
      '"' + this.clientId + '",' +
      '"' + sessionId + '",' +
      '"JOBEGGS","PDF","0","sigmundtest.com",' +
      '"hello@yira.ci",' +
      '"' + (email ?? 'noreply@yira.ci') + '",' +
      '"Résultat YIRA-Sigmund",' +
      '"Votre bilan YIRA est disponible",' +
      '"YIRA_RAPPORT_' + sessionId + '")';

    const res  = await fetch(url, { method: 'GET' });
    const text = await res.text();
    const data = await this.parseXML(text);

    const lien = this.toArray(data?.label_string ?? data?.string)[0] ?? '';
    this.logger.log('[SIGMUND] WS5 — Rapport PDF: ' + lien);
    return lien;
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  private async parseXML(xml: string): Promise<any> {
    try {
      const result = await xml2js.parseStringPromise(xml, {
        explicitArray: false,
        ignoreAttrs:   true,
        trim:          true,
      });
      return result?.sigmund_data2 ?? result?.sigmund_data3 ?? result;
    } catch (e: any) {
      this.logger.warn('[SIGMUND] Parse XML erreur: ' + e.message);
      return {};
    }
  }

  private toArray(val: any): any[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return [val];
  }

  private sanitize(str: string): string {
    return str.replace(/['"]/g, '').trim();
  }

  // Mapping diplôme YIRA → code Sigmund
  static mapDiplomeCI(niveau: string): number {
    const map: Record<string, number> = {
      'SANS_DIPLOME': 1, 'CEP': 2, 'CAP': 3,
      'BEPC': 4, 'BAC': 5, 'BAC_PLUS': 6,
      'MASTER': 8, 'DOCTORAT': 9,
    };
    return map[niveau] ?? 5;
  }

  // Mapping age YIRA → code Sigmund
  static mapAgeCI(age: number): number {
    if (age < 20) return 1;
    if (age <= 25) return 2;
    if (age <= 30) return 3;
    if (age <= 35) return 4;
    if (age <= 40) return 5;
    if (age <= 50) return 6;
    if (age <= 60) return 7;
    return 8;
  }
}