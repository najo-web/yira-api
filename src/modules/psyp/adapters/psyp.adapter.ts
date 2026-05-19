// =============================================================================
// YIRA V3.0 — PsyP Adapter Interface (Contrat commun)
// Sprint 48 — Vendor Independence L3 §5
// Tout provider psychométrique DOIT implémenter cette interface
// =============================================================================

export interface CandidatPsyP {
  telephone:   string;
  prenom:      string;
  nom:         string;
  genre:       'M' | 'F';
  age_code:    number; // 1=<20, 2=20-25, 3=26-30, 4=31-35...
  diplome_code: number; // 1=Aucun, 2=CEP, 3=CAP, 4=BEPC, 5=BAC...
  experience_code: number; // 1=0an, 2=1an, 3=2-3ans...
  formation_code?: number; // 1=Littéraire, 4=Scientifique...
  statut_code?:    number; // 7=Etudiant...
  tenant_id:   string;
}

export interface SessionPsyP {
  session_id:    string; // assessment_id Sigmund
  provider:      string; // 'SIGMUND' | 'CENTRALTEST'...
  candidat:      CandidatPsyP;
  created_at:    Date;
  login?:        string; // si accès web provider
  password?:     string;
}

export interface QuestionPsyP {
  numero:         number;
  libelle_original: string; // texte original du provider
  libelle_incult?:  string; // texte inculturé CI par IA
  choix:          string[]; // r1 à r6
  nb_choix:       number;
}

export interface ReponsePsyP {
  question_numero: number;
  reponse_index:   number; // index du choix sélectionné
}

export interface ScoresBrutsPsyP {
  provider:       string;
  assessment_id:  string;
  candidat_nom:   string;
  test_nom:       string;
  scores:         Record<string, number>; // ex: { RIASEC_R: 75, RIASEC_I: 60... }
  scores_bruts:   Record<string, number>;
  criteres:       string[];
  nb_questions:   number;
  duree_minutes:  number;
  raw_data?:      any; // données brutes pour audit
}

export interface PsyPAdapter {
  readonly provider: string;

  ouvrirSession(candidat: CandidatPsyP): Promise<SessionPsyP>;
  chargerQuestions(sessionId: string): Promise<QuestionPsyP[]>;
  enregistrerReponses(sessionId: string, reponses: ReponsePsyP[]): Promise<void>;
  recupererScores(sessionId: string): Promise<ScoresBrutsPsyP>;
  genererRapportPDF?(sessionId: string, email?: string): Promise<string>;
}