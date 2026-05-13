import { extraireTexteIA } from '../../utils/ia-text.helper';
// ============================================================
// YIRA â€” bac.service.ts
// Sprint 10C â€” Moteur d'Orientation Post-BAC
// Endpoint : POST /api/bac/analyze
// CDC Source : CDC_BEPC_BAC_v1.0 â€” Partie 5
//
// Formule officielle :
//   S_final = 0.40Ã—S_acad + 0.30Ã—S_RIASEC + 0.30Ã—S_mÃ©tier
//
// Modules : profilisation | matching | admission | ROI | carriÃ¨re
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { IaService } from '../../ia/ia.service';
import { ScoresRIASEC } from './bepc.service';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface NotesBac {
  serie: 'A1'|'A2'|'B'|'C'|'D'|'E'|'F1'|'F2'|'F3'|'F4'|'G1'|'G2'|'H1'|'H2'|'H3'|'F7';
  maths?: number;
  francais?: number;
  anglais?: number;
  svt?: number;
  physique?: number;
  histoire_geo?: number;
  philo?: number;
  lv2?: number;
  specialite?: number;  // MatiÃ¨re principale de la sÃ©rie
  mention?: 'PASSABLE'|'ASSEZ_BIEN'|'BIEN'|'TRES_BIEN';
  moyenne_bac?: number;
}

export interface ContexteBac {
  region: string;
  budget_famille: 'FAIBLE'|'MOYEN'|'ELEVE';
  objectif_carriere?: string;  // Texte libre "je veux Ãªtre..."
  secteur_prefere?: string;
  distance_acceptable: 'ABIDJAN_ONLY'|'COTE_DIVOIRE'|'CEDEAO'|'INTERNATIONAL';
  a_deja_travaille: boolean;
  experience_secteur?: string;
}

export interface AnalyseBacInput {
  utilisateur_id: string;
  notes: NotesBac;
  riasec: ScoresRIASEC;
  contexte: ContexteBac;
  profil_bepc?: ScoresRIASEC;  // Si disponible (profil longitudinal)
}

export interface ROIEducatif {
  filiere: string;
  salaire_moy_fcfa: number;
  taux_emploi: number;
  duree_annees: number;
  cout_total_fcfa: number;
  roi_score: number;
  retour_investissement_ans: number;
}

export interface MatchingMetier {
  code: string;
  nom: string;
  salaire_min_fcfa: number;
  salaire_max_fcfa: number;
  demande_marche: 'FORTE'|'MOYENNE'|'FAIBLE';
  croissance_secteur: 'FORTE'|'STABLE'|'DECLIN';
  score_compatibilite: number;
  competences_cles: string[];
}

export interface RecommandationFiliereBac {
  rang: number;
  code: string;
  nom: string;
  type: 'UNIVERSITE_PUBLIQUE'|'GRANDE_ECOLE'|'BTS_PRIVE'|'ECOLE_SPECIALISEE'|'FORMATION_DISTANCE';
  universites: string[];
  score_global: number;
  s_academique: number;
  s_riasec: number;
  s_metier: number;
  probabilite_admission: number;
  roi: ROIEducatif;
  top3_metiers: MatchingMetier[];
  series_eligibles: string[];
  criteres_acces: string;
  pourquoi: string;
}

export interface ProjectionCarriere {
  filiere: string;
  annee_1_3: string;    // Premier emploi
  annee_3_7: string;    // Ã‰volution
  annee_7_15: string;   // MaturitÃ©
  salaire_debutant: number;
  salaire_senior: number;
  employeurs_ci: string[];
}

export interface AnalyseBacResult {
  utilisateur_id: string;
  profil_serie: string;
  code_riasec: string;
  delta_riasec?: string;  // Si profil BEPC disponible
  trust_index_contribution: number;
  top5_filieres: RecommandationFiliereBac[];
  projection_carriere: ProjectionCarriere[];
  roi_comparatif: ROIEducatif[];
  rapport_nie: string;
  timestamp: Date;
}

// â”€â”€ DonnÃ©es MESRS â€” FiliÃ¨res par sÃ©rie et critÃ¨res â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SERIES_VERS_FILIERES: Record<string, string[]> = {
  'A1': ['UNIV_LETTRES_MOD','UNIV_ANGLAIS','UNIV_HISTOIRE','UNIV_PHILO','UNIV_SOCIO','UNIV_DROIT'],
  'A2': ['UNIV_LETTRES_MOD','UNIV_HISTOIRE','UNIV_GEOGRAPHIE','UNIV_SOCIO','UNIV_ANTHROPO','UNIV_DROIT'],
  'B':  ['UNIV_ECONOMIE','UNIV_DROIT','UNIV_SOCIO','UNIV_GEOGRAPHIE'],
  'C':  ['UNIV_MATHS_INFO','UNIV_PHYSIQUE_CHIMIE','UNIV_MEDECINE','UNIV_PHARMACIE','UNIV_ECONOMIE','INFOCAD_DAS','INFOCAD_RSI'],
  'D':  ['UNIV_MEDECINE','UNIV_PHARMACIE','UNIV_AGRO','UNIV_PHYSIQUE_CHIMIE','UNIV_MATHS_INFO','INFOCAD_DAS','INFOCAD_RSI'],
  'E':  ['UNIV_MATHS_INFO','INFOCAD_DAS','INFOCAD_RSI','BTS_INFO_DEV','BTS_ELEC','BTS_RESEAUX_INFO'],
  'F1': ['BTS_MAINTENANCE','BTS_ELEC','BTS_SYST_ELEC_INFO','BTS_GENIE_ENERGIE'],
  'F2': ['BTS_ELEC','BTS_SYST_ELEC_INFO','BTS_RESEAUX_INFO','BTS_MAINTENANCE'],
  'F3': ['BTS_GENIE_CIVIL','BTS_MINES','BTS_GENIE_ENERGIE'],
  'F4': ['BTS_AGRO_ALIM','BTS_GENIE_ENERGIE'],
  'G1': ['BTS_ASSISTANAT_DIR','BTS_GESTION_COM','BTS_RH_COM','BTS_FINANCE_COMPTA','UNIV_DROIT'],
  'G2': ['BTS_FINANCE_COMPTA','BTS_FINANCES_ASSUR','BTS_GESTION_COM','UNIV_ECONOMIE'],
  'F7': ['BTS_AGRO','UNIV_AGRO'],
};

// â”€â”€ RÃ©fÃ©rentiel mÃ©tiers CI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const METIERS_CI: Record<string, MatchingMetier> = {
  'DEV_WEB_MOBILE': {
    code: 'DEV_WEB_MOBILE', nom: 'DÃ©veloppeur Web/Mobile CI',
    salaire_min_fcfa: 250000, salaire_max_fcfa: 700000,
    demande_marche: 'FORTE', croissance_secteur: 'FORTE',
    score_compatibilite: 0,
    competences_cles: ['JavaScript', 'React/Vue', 'NestJS', 'Flutter', 'Git'],
  },
  'DATA_ANALYST': {
    code: 'DATA_ANALYST', nom: 'Data Analyst / Data Scientist',
    salaire_min_fcfa: 350000, salaire_max_fcfa: 900000,
    demande_marche: 'FORTE', croissance_secteur: 'FORTE',
    score_compatibilite: 0,
    competences_cles: ['Python', 'SQL', 'Power BI', 'Excel avancÃ©', 'Statistiques'],
  },
  'MEDECIN_GENERALISTE': {
    code: 'MEDECIN_GENERALISTE', nom: 'MÃ©decin GÃ©nÃ©raliste CI',
    salaire_min_fcfa: 450000, salaire_max_fcfa: 1500000,
    demande_marche: 'FORTE', croissance_secteur: 'STABLE',
    score_compatibilite: 0,
    competences_cles: ['Diagnostic clinique', 'Pharmacologie', 'Urgences', 'Relation patient'],
  },
  'JURISTE_ENTREPRISE': {
    code: 'JURISTE_ENTREPRISE', nom: 'Juriste d\'Entreprise CI',
    salaire_min_fcfa: 300000, salaire_max_fcfa: 800000,
    demande_marche: 'MOYENNE', croissance_secteur: 'STABLE',
    score_compatibilite: 0,
    competences_cles: ['Droit OHADA', 'Contrats commerciaux', 'Droit social CI', 'Contentieux'],
  },
  'COMPTABLE': {
    code: 'COMPTABLE', nom: 'Comptable / ContrÃ´leur de Gestion',
    salaire_min_fcfa: 200000, salaire_max_fcfa: 600000,
    demande_marche: 'FORTE', croissance_secteur: 'STABLE',
    score_compatibilite: 0,
    competences_cles: ['SYSCOHADA', 'Excel', 'Logiciels comptables CI', 'FiscalitÃ© CI'],
  },
  'COMMERCIAL_B2B': {
    code: 'COMMERCIAL_B2B', nom: 'Commercial / Business Developer',
    salaire_min_fcfa: 200000, salaire_max_fcfa: 600000,
    demande_marche: 'FORTE', croissance_secteur: 'FORTE',
    score_compatibilite: 0,
    competences_cles: ['Prospection', 'NÃ©gociation', 'CRM', 'Anglais professionnel'],
  },
  'RH_GENERALISTE': {
    code: 'RH_GENERALISTE', nom: 'ChargÃ©(e) des Ressources Humaines',
    salaire_min_fcfa: 200000, salaire_max_fcfa: 500000,
    demande_marche: 'MOYENNE', croissance_secteur: 'STABLE',
    score_compatibilite: 0,
    competences_cles: ['Droit social CI', 'Recrutement', 'Paie CNPS', 'Formation'],
  },
  'AGRONOME': {
    code: 'AGRONOME', nom: 'IngÃ©nieur Agronome / Technicien Agricole',
    salaire_min_fcfa: 200000, salaire_max_fcfa: 500000,
    demande_marche: 'FORTE', croissance_secteur: 'FORTE',
    score_compatibilite: 0,
    competences_cles: ['Cultures tropicales CI', 'Cacao/CafÃ©', 'Agroforesterie', 'Certification'],
  },
  'ENSEIGNANT': {
    code: 'ENSEIGNANT', nom: 'Enseignant / Professeur CI',
    salaire_min_fcfa: 180000, salaire_max_fcfa: 400000,
    demande_marche: 'FORTE', croissance_secteur: 'STABLE',
    score_compatibilite: 0,
    competences_cles: ['PÃ©dagogie', 'Discipline enseignÃ©e', 'Gestion classe', 'CAFOP'],
  },
  'ADMIN_RESEAUX': {
    code: 'ADMIN_RESEAUX', nom: 'Administrateur RÃ©seaux / CybersÃ©curitÃ©',
    salaire_min_fcfa: 300000, salaire_max_fcfa: 700000,
    demande_marche: 'FORTE', croissance_secteur: 'FORTE',
    score_compatibilite: 0,
    competences_cles: ['Cisco', 'Linux', 'Firewall', 'Cloud AWS/Azure', 'SÃ©curitÃ© rÃ©seau'],
  },
};

// â”€â”€ RIASEC des mÃ©tiers CI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const METIERS_RIASEC: Record<string, ScoresRIASEC> = {
  'DEV_WEB_MOBILE':      { R: 35, I: 90, A: 30, S: 25, E: 50, C: 65 },
  'DATA_ANALYST':        { R: 25, I: 90, A: 20, S: 30, E: 55, C: 80 },
  'MEDECIN_GENERALISTE': { R: 35, I: 85, A: 20, S: 90, E: 45, C: 55 },
  'JURISTE_ENTREPRISE':  { R: 10, I: 65, A: 25, S: 65, E: 80, C: 70 },
  'COMPTABLE':           { R: 15, I: 60, A: 10, S: 40, E: 65, C: 90 },
  'COMMERCIAL_B2B':      { R: 20, I: 40, A: 25, S: 65, E: 90, C: 55 },
  'RH_GENERALISTE':      { R: 15, I: 50, A: 35, S: 85, E: 65, C: 60 },
  'AGRONOME':            { R: 70, I: 65, A: 30, S: 55, E: 50, C: 45 },
  'ENSEIGNANT':          { R: 20, I: 65, A: 45, S: 85, E: 40, C: 55 },
  'ADMIN_RESEAUX':       { R: 50, I: 88, A: 10, S: 20, E: 45, C: 70 },
};

@Injectable()
export class BacService {
  private readonly logger = new Logger('BacService');

  constructor(private readonly iaService: IaService) {}

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // MÃ‰THODE PRINCIPALE
  // POST /api/bac/analyze
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  async analyser(input: AnalyseBacInput): Promise<AnalyseBacResult> {
    this.logger.log(`Analyse BAC â€” utilisateur: ${input.utilisateur_id} â€” sÃ©rie: ${input.notes.serie}`);

    // 1. Calibration RIASEC CI
    const riasec_calibre = this.calibrerRIASEC(input.riasec);

    // 2. Code Holland
    const code_riasec = this.calculerCodeHolland(riasec_calibre);

    // 3. Moyenne BAC pondÃ©rÃ©e
    const moyenne_bac = this.calculerMoyenneBAC(input.notes);

    // 4. FiliÃ¨res Ã©ligibles selon sÃ©rie BAC
    const filieres_eligibles = SERIES_VERS_FILIERES[input.notes.serie] || [];

    // 5. Scoring multi-critÃ¨res pour chaque filiÃ¨re
    const recommandations = this.calculerRecommandations(
      moyenne_bac, riasec_calibre, input.contexte, input.notes, filieres_eligibles
    );

    // 6. Projection carriÃ¨re Top 3
    const projections = recommandations.slice(0, 3).map(r =>
      this.projeterCarriere(r.code, r.top3_metiers[0])
    );

    // 7. ROI comparatif
    const roi_comparatif = recommandations.slice(0, 5).map(r => r.roi);

    // 8. Delta RIASEC si profil BEPC disponible
    const delta_riasec = input.profil_bepc
      ? this.calculerDeltaRIASEC(input.profil_bepc, riasec_calibre)
      : undefined;

    // 9. Rapport NIE personnalisÃ© CI
    const rapport_nie = await this.genererRapportNIE({
      code_riasec, moyenne_bac, serie: input.notes.serie,
      recommandations: recommandations.slice(0, 3),
      contexte: input.contexte, delta_riasec
    });

    return {
      utilisateur_id: input.utilisateur_id,
      profil_serie: input.notes.serie,
      code_riasec,
      delta_riasec,
      trust_index_contribution: 35,
      top5_filieres: recommandations.slice(0, 5),
      projection_carriere: projections,
      roi_comparatif,
      rapport_nie,
      timestamp: new Date(),
    };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SCORING MULTI-CRITÃˆRES POST-BAC
  //   S_final = 0.40Ã—S_acad + 0.30Ã—S_RIASEC + 0.30Ã—S_mÃ©tier
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private calculerRecommandations(
    moy: number,
    riasec: ScoresRIASEC,
    contexte: ContexteBac,
    notes: NotesBac,
    filieres_eligibles: string[]
  ): RecommandationFiliereBac[] {

    // RÃ©fÃ©rentiel filiÃ¨res avec donnÃ©es MESRS CI
    const catalogue_filieres = [
      {
        code: 'UNIV_MATHS_INFO', nom: 'MathÃ©matiques-Informatique (UFHB)',
        type: 'UNIVERSITE_PUBLIQUE' as const,
        universites: ['UFHB'],
        series_eligibles: ['C','D','E'],
        criteres: 'Maths â‰¥ 12, D â‰¥ 14, Phys â‰¥ 10',
        duree: 3, cout: 0, salaire: 500000, taux_emploi: 0.88,
        riasec_cible: { R: 30, I: 90, A: 20, S: 30, E: 45, C: 65 },
        metiers: ['DEV_WEB_MOBILE','DATA_ANALYST','ADMIN_RESEAUX'],
      },
      {
        code: 'UNIV_MEDECINE', nom: 'MÃ©decine (UFHB/UNA)',
        type: 'UNIVERSITE_PUBLIQUE' as const,
        universites: ['UFHB','UNA'],
        series_eligibles: ['C','D'],
        criteres: 'Maths â‰¥ 11, Phys â‰¥ 11, SVT â‰¥ 11 â€” Concours EPSS',
        duree: 7, cout: 0, salaire: 800000, taux_emploi: 0.95,
        riasec_cible: { R: 35, I: 85, A: 20, S: 90, E: 45, C: 55 },
        metiers: ['MEDECIN_GENERALISTE'],
      },
      {
        code: 'UNIV_DROIT', nom: 'Sciences Juridiques (UFHB/UAO)',
        type: 'UNIVERSITE_PUBLIQUE' as const,
        universites: ['UFHB','UAO','UJLOG','UPGC'],
        series_eligibles: ['A1','A2','B','C','D','G1'],
        criteres: 'Philo â‰¥ 12, Franc â‰¥ 12, Hist-GÃ©o â‰¥ 12',
        duree: 5, cout: 0, salaire: 400000, taux_emploi: 0.72,
        riasec_cible: { R: 10, I: 65, A: 25, S: 70, E: 80, C: 65 },
        metiers: ['JURISTE_ENTREPRISE'],
      },
      {
        code: 'UNIV_ECONOMIE', nom: 'Sciences Ã‰conomiques (UFHB/UAO)',
        type: 'UNIVERSITE_PUBLIQUE' as const,
        universites: ['UFHB','UAO','UJLOG','UPGC'],
        series_eligibles: ['A1','B','C','D','G2'],
        criteres: 'Maths â‰¥ 11, Franc â‰¥ 11, Ang â‰¥ 11',
        duree: 3, cout: 0, salaire: 450000, taux_emploi: 0.78,
        riasec_cible: { R: 20, I: 75, A: 25, S: 50, E: 70, C: 80 },
        metiers: ['COMPTABLE','DATA_ANALYST','COMMERCIAL_B2B'],
      },
      {
        code: 'UNIV_LETTRES_MOD', nom: 'Lettres Modernes (UFHB/UAO)',
        type: 'UNIVERSITE_PUBLIQUE' as const,
        universites: ['UFHB','UAO','UPGC'],
        series_eligibles: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
        criteres: 'Franc â‰¥ 12, Philo â‰¥ 9, LV2 â‰¥ 9',
        duree: 3, cout: 0, salaire: 190000, taux_emploi: 0.58,
        riasec_cible: { R: 15, I: 55, A: 75, S: 65, E: 40, C: 40 },
        metiers: ['ENSEIGNANT'],
      },
      {
        code: 'INFOCAD_DAS', nom: 'DÃ©veloppement d\'Application et e-Service (INFOCAD)',
        type: 'FORMATION_DISTANCE' as const,
        universites: ['INFOCAD'],
        series_eligibles: ['C','D','E','F1','F2','F3','F4'],
        criteres: 'Maths â‰¥ 11, Phys â‰¥ 10, Franc â‰¥ 10',
        duree: 3, cout: 500000, salaire: 500000, taux_emploi: 0.88,
        riasec_cible: { R: 35, I: 90, A: 30, S: 25, E: 55, C: 65 },
        metiers: ['DEV_WEB_MOBILE','DATA_ANALYST'],
      },
      {
        code: 'INFOCAD_RSI', nom: 'RÃ©seaux et SÃ©curitÃ© Informatique (INFOCAD)',
        type: 'FORMATION_DISTANCE' as const,
        universites: ['INFOCAD'],
        series_eligibles: ['C','D','E','F1','F2','F3'],
        criteres: 'Maths â‰¥ 11, Phys â‰¥ 11, Franc â‰¥ 10',
        duree: 3, cout: 500000, salaire: 550000, taux_emploi: 0.90,
        riasec_cible: { R: 45, I: 88, A: 15, S: 25, E: 50, C: 70 },
        metiers: ['ADMIN_RESEAUX'],
      },
      {
        code: 'BTS_FINANCE_COMPTA', nom: 'BTS Finance ComptabilitÃ© (PrivÃ© CI)',
        type: 'BTS_PRIVE' as const,
        universites: ['PIGIER','IST La Colombe','EPCCI','Et 90+ Ã©coles CI'],
        series_eligibles: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
        criteres: 'BAC obtenu toutes sÃ©ries',
        duree: 2, cout: 500000, salaire: 280000, taux_emploi: 0.78,
        riasec_cible: { R: 15, I: 55, A: 10, S: 40, E: 65, C: 90 },
        metiers: ['COMPTABLE'],
      },
      {
        code: 'BTS_INFO_DEV', nom: 'BTS Informatique DÃ©veloppeur d\'Application',
        type: 'BTS_PRIVE' as const,
        universites: ['ESTIC','HETEC','IST La Colombe','Et 60+ Ã©coles CI'],
        series_eligibles: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
        criteres: 'BAC obtenu â€” prÃ©fÃ©rence sÃ©ries C/D/E/F',
        duree: 2, cout: 550000, salaire: 350000, taux_emploi: 0.85,
        riasec_cible: { R: 40, I: 85, A: 20, S: 25, E: 45, C: 65 },
        metiers: ['DEV_WEB_MOBILE','ADMIN_RESEAUX'],
      },
      {
        code: 'BTS_GESTION_COM', nom: 'BTS Gestion Commerciale (PrivÃ© CI)',
        type: 'BTS_PRIVE' as const,
        universites: ['PIGIER','ESC-Abidjan','Et 90+ Ã©coles CI'],
        series_eligibles: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
        criteres: 'BAC obtenu toutes sÃ©ries',
        duree: 2, cout: 480000, salaire: 260000, taux_emploi: 0.76,
        riasec_cible: { R: 20, I: 40, A: 25, S: 65, E: 85, C: 60 },
        metiers: ['COMMERCIAL_B2B'],
      },
      {
        code: 'UNIV_AGRO', nom: 'Agroforesterie et Environnement (UPGC)',
        type: 'UNIVERSITE_PUBLIQUE' as const,
        universites: ['UPGC'],
        series_eligibles: ['C','D','F7'],
        criteres: 'Ang â‰¥ 10, Maths â‰¥ 11, SVT â‰¥ 11',
        duree: 3, cout: 0, salaire: 280000, taux_emploi: 0.72,
        riasec_cible: { R: 65, I: 65, A: 30, S: 45, E: 40, C: 45 },
        metiers: ['AGRONOME'],
      },
    ];

    const resultats: RecommandationFiliereBac[] = [];

    for (const filiere of catalogue_filieres) {
      // VÃ©rifier Ã©ligibilitÃ© sÃ©rie BAC
      if (!filiere.series_eligibles.includes(notes.serie)) continue;

      // S_acadÃ©mique (40%)
      const s_academique = this.calculerSAcademique(moy, notes, filiere);

      // S_RIASEC (30%)
      const s_riasec = this.calculerSRIASEC(riasec, filiere.riasec_cible);

      // S_mÃ©tier (30%) â€” matching mÃ©tiers
      const metiers_matches = this.matcherMetiers(riasec, filiere.metiers);
      const s_metier = this.calculerSMetier(metiers_matches, filiere);

      // Score global Post-BAC
      const score_global = Math.round(
        0.40 * s_academique +
        0.30 * s_riasec +
        0.30 * s_metier
      );

      // ProbabilitÃ© d'admission
      const prob_admission = this.calculerProbAdmission(moy, notes, filiere);

      // ROI Ã©ducatif
      const roi = this.calculerROI(filiere);

      resultats.push({
        rang: 0,
        code: filiere.code,
        nom: filiere.nom,
        type: filiere.type,
        universites: filiere.universites,
        score_global,
        s_academique: Math.round(s_academique),
        s_riasec: Math.round(s_riasec),
        s_metier: Math.round(s_metier),
        probabilite_admission: prob_admission,
        roi,
        top3_metiers: metiers_matches.slice(0, 3),
        series_eligibles: filiere.series_eligibles,
        criteres_acces: filiere.criteres,
        pourquoi: this.genererExplication(filiere.code, s_academique, s_riasec, riasec),
      });
    }

    resultats.sort((a, b) => b.score_global - a.score_global);
    resultats.forEach((r, i) => r.rang = i + 1);
    return resultats;
  }

  // â”€â”€ S_acadÃ©mique BAC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private calculerSAcademique(moy: number, notes: NotesBac, filiere: any): number {
    let score = 70;

    // Bonus mention
    if (notes.mention === 'TRES_BIEN') score += 20;
    else if (notes.mention === 'BIEN') score += 12;
    else if (notes.mention === 'ASSEZ_BIEN') score += 5;

    // AdÃ©quation sÃ©rie / filiÃ¨re
    const series_fortes = {
      'UNIV_MATHS_INFO': ['C','E'],
      'UNIV_MEDECINE': ['C','D'],
      'UNIV_DROIT': ['A1','A2','B'],
      'UNIV_ECONOMIE': ['B','G2','C'],
      'INFOCAD_DAS': ['C','D','E'],
      'BTS_INFO_DEV': ['C','D','E','F1','F2'],
    };
    const series_opt = series_fortes[filiere.code as string] || [];
    if (series_opt.includes(notes.serie)) score += 10;

    // Note spÃ©cialitÃ© Ã©levÃ©e
    if (notes.specialite && notes.specialite >= 14) score += 5;
    if (notes.moyenne_bac && notes.moyenne_bac >= 13) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  // â”€â”€ S_RIASEC BAC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private calculerSRIASEC(eleve: ScoresRIASEC, filiere: ScoresRIASEC): number {
    const types = ['R','I','A','S','E','C'] as const;
    let distance = 0;
    for (const t of types) distance += Math.abs(eleve[t] - filiere[t]);
    return Math.round((1 - distance / 600) * 100);
  }

  // â”€â”€ Matching mÃ©tiers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private matcherMetiers(riasec: ScoresRIASEC, codes_metiers: string[]): MatchingMetier[] {
    return codes_metiers.map(code => {
      const metier = METIERS_CI[code];
      if (!metier) return null;
      const riasec_metier = METIERS_RIASEC[code];
      const score = this.calculerSRIASEC(riasec, riasec_metier);
      return { ...metier, score_compatibilite: score };
    }).filter(Boolean) as MatchingMetier[];
  }

  // â”€â”€ S_mÃ©tier â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private calculerSMetier(metiers: MatchingMetier[], filiere: any): number {
    if (!metiers.length) return 50;
    const score_fit = metiers.reduce((s, m) => s + m.score_compatibilite, 0) / metiers.length;
    const score_demande = metiers.filter(m => m.demande_marche === 'FORTE').length / metiers.length;
    const score_croissance = metiers.filter(m => m.croissance_secteur === 'FORTE').length / metiers.length;
    return Math.round(score_fit * 0.5 + score_demande * 30 + score_croissance * 20);
  }

  // â”€â”€ ROI Ã©ducatif â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  calculerROI(filiere: any): ROIEducatif {
    const salaire = filiere.salaire || 300000;
    const taux = filiere.taux_emploi || 0.70;
    const duree = filiere.duree || 3;
    const cout = filiere.cout || 0;
    const roi_score = (salaire * taux) / (duree + cout / 100000);
    const retour = cout > 0 ? Math.ceil(cout / (salaire * taux * 12)) : 0;
    return {
      filiere: filiere.code,
      salaire_moy_fcfa: salaire,
      taux_emploi: taux,
      duree_annees: duree,
      cout_total_fcfa: cout * duree,
      roi_score: Math.round(roi_score / 1000) / 100,
      retour_investissement_ans: retour,
    };
  }

  // â”€â”€ ProbabilitÃ© d'admission â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private calculerProbAdmission(moy: number, notes: NotesBac, filiere: any): number {
    let base = 0.65;
    if (moy >= 14) base += 0.20;
    else if (moy >= 12) base += 0.10;
    else if (moy < 10) base -= 0.20;
    if (notes.mention === 'TRES_BIEN') base += 0.15;
    else if (notes.mention === 'BIEN') base += 0.08;
    if (['UNIVERSITE_PUBLIQUE'].includes(filiere.type) && moy < 11) base -= 0.15;
    return Math.max(0.05, Math.min(0.95, Math.round(base * 100) / 100));
  }

  // â”€â”€ Projection carriÃ¨re â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  projeterCarriere(filiere: string, metier?: MatchingMetier): ProjectionCarriere {
    const sal_debut = metier?.salaire_min_fcfa || 200000;
    const sal_senior = metier?.salaire_max_fcfa || 600000;
    const employeurs: Record<string, string[]> = {
      'UNIV_MATHS_INFO': ['MTN CI','Orange CI','ARTCI','Banques CI','Startups Abidjan','NSIA'],
      'UNIV_MEDECINE': ['CHU Abidjan','PISAM','Polycliniques CI','MSF','OMS CI'],
      'UNIV_DROIT': ['Cabinets avocats Abidjan','MFPE CI','Grandes entreprises CI','Notaires'],
      'UNIV_ECONOMIE': ['BCEAO','SIB','SGBCI','NSIA Banque','CGECI','FMI CI'],
      'BTS_INFO_DEV': ['ESN Abidjan','Startups','ARTCI','Banques en ligne','E-commerce CI'],
      'BTS_FINANCE_COMPTA': ['PME CI','Cabinets expertise','Industrie CI','Commerce CI'],
      'INFOCAD_DAS': ['Remote international','Startups CI','Agences web','OpÃ©rateurs tÃ©lÃ©com'],
    };
    return {
      filiere,
      annee_1_3: `Stage + 1er emploi en CI. Salaire dÃ©butant : ${sal_debut.toLocaleString()} FCFA/mois.`,
      annee_3_7: `Consolidation compÃ©tences. PossibilitÃ© de promotion ou mobilitÃ©. Salaire intermÃ©diaire.`,
      annee_7_15: `Expert / Manager. CrÃ©ation entreprise possible. Salaire senior : ${sal_senior.toLocaleString()} FCFA/mois.`,
      salaire_debutant: sal_debut,
      salaire_senior: sal_senior,
      employeurs_ci: employeurs[filiere] || ['Entreprises CI','ONG','Administration publique CI'],
    };
  }

  // â”€â”€ Calibration RIASEC CI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private calibrerRIASEC(raw: ScoresRIASEC): ScoresRIASEC {
    return {
      R: raw.R,
      I: Math.min(100, raw.I * 0.95),
      A: Math.min(100, raw.A * 1.12),
      S: raw.S,
      E: Math.min(100, raw.E * 0.88),
      C: raw.C,
    };
  }

  private calculerCodeHolland(riasec: ScoresRIASEC): string {
    return (Object.entries(riasec) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t)
      .join('');
  }

  private calculerMoyenneBAC(notes: NotesBac): number {
    if (notes.moyenne_bac) return notes.moyenne_bac;
    const valeurs = [notes.maths, notes.francais, notes.anglais, notes.svt,
                     notes.physique, notes.histoire_geo, notes.philo, notes.specialite]
      .filter(Boolean) as number[];
    if (!valeurs.length) return 11;
    return Math.round((valeurs.reduce((a, b) => a + b, 0) / valeurs.length) * 100) / 100;
  }

  private calculerDeltaRIASEC(bepc: ScoresRIASEC, bac: ScoresRIASEC): string {
    const delta = (Object.keys(bepc) as (keyof ScoresRIASEC)[])
      .map(k => `${k}: ${bac[k] - bepc[k] > 0 ? '+' : ''}${Math.round(bac[k] - bepc[k])}`)
      .join(' | ');
    return `Ã‰volution RIASEC 3eâ†’BAC : ${delta}`;
  }

  private genererExplication(code: string, s_acad: number, s_riasec: number, riasec: ScoresRIASEC): string {
    const dom = (Object.entries(riasec) as [string, number][]).sort((a,b)=>b[1]-a[1])[0][0];
    const explications: Record<string, string> = {
      'UNIV_MATHS_INFO': 'Ton profil analytique correspond parfaitement Ã  l\'informatique. Les dÃ©bouchÃ©s CI (MTN, Orange, banques, startups) sont excellents.',
      'UNIV_MEDECINE': 'Ton profil social-investigateur et tes bases scientifiques pointent vers la mÃ©decine. CI manque de mÃ©decins â€” fort impact.',
      'UNIV_DROIT': 'Ton profil entreprenant et analytique correspond au droit. Les juristes d\'entreprise sont trÃ¨s recherchÃ©s en CI (OHADA, CIMA).',
      'UNIV_ECONOMIE': 'Tes aptitudes en analyse et gestion correspondent aux sciences Ã©conomiques. Les Ã©conomistes CI travaillent dans les banques, l\'Ã‰tat, les multinationales.',
      'BTS_INFO_DEV': 'Formation courte et opÃ©rationnelle en 2 ans. Les dÃ©veloppeurs CI sont trÃ¨s demandÃ©s. Salaire dÃ©butant correct dÃ¨s la sortie.',
      'BTS_FINANCE_COMPTA': 'AccÃ¨s facile, dÃ©bouchÃ©s larges. Toutes les entreprises CI ont besoin de comptables. Ã‰volution vers contrÃ´leur de gestion.',
      'INFOCAD_DAS': 'Formation Ã  distance innovante. Tu peux travailler pour des clients internationaux depuis Abidjan. Secteur en forte croissance CI/monde.',
    };
    return explications[code] || `FiliÃ¨re adaptÃ©e Ã  ton profil ${dom} dominant â€” score acadÃ©mique ${Math.round(s_acad)}% et compatibilitÃ© RIASEC ${Math.round(s_riasec)}%.`;
  }

  // â”€â”€ Rapport NIE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async genererRapportNIE(data: {
    code_riasec: string; moyenne_bac: number; serie: string;
    recommandations: RecommandationFiliereBac[];
    contexte: ContexteBac; delta_riasec?: string;
  }): Promise<string> {
    const prompt = `
Tu es YIRA, conseiller d'orientation officiel CI.
Tu parles Ã  un bachelier ivoirien (17-19 ans) et sa famille.
Ton ton : bienveillant, factuel, encourageant, adaptÃ© Ã  la culture ivoirienne.
ZÃ©ro jargon. Maximum 280 mots.

PROFIL BACHELIER :
- SÃ©rie BAC : ${data.serie}
- Moyenne BAC : ${data.moyenne_bac}/20
- Code Holland YIRA : ${data.code_riasec}
- RÃ©gion : ${data.contexte.region}
${data.delta_riasec ? `- ${data.delta_riasec}` : ''}

TOP 3 FILIÃˆRES :
${data.recommandations.map((r,i)=>`${i+1}. ${r.nom}
   Score : ${r.score_global}% | Admission : ${Math.round(r.probabilite_admission*100)}% | ROI : ${r.roi.roi_score}
   MÃ©tiers CI : ${r.top3_metiers.map(m=>m.nom).join(', ')}`).join('\n\n')}

GÃ©nÃ¨re un rapport personnalisÃ© pour ce bachelier.
Commence par fÃ©liciter son BAC (sÃ©rie ${data.serie}).
Explique la 1Ã¨re filiÃ¨re recommandÃ©e simplement avec des exemples CI concrets.
Montre le lien entre son profil (${data.code_riasec}) et les mÃ©tiers recommandÃ©s.
Donne 1 conseil sur le ROI â€” investissement/retour.
Termine avec un mot d'encouragement ancrÃ© dans le contexte ivoirien.
`;

    try {
      return (extraireTexteIA((await this.iaService.generate({ module: 'YIRA-OS-BAC', usage: 'NIE_RAPPORT', pays: 'CI', canal: 'APP', variables: { prompt } })).text));
    } catch (err) {
      return `FÃ©licitations pour ton BAC sÃ©rie ${data.serie} ! Ton profil YIRA (${data.code_riasec}) ouvre de belles perspectives. ` +
        `${data.recommandations[0]?.nom || 'Ta filiÃ¨re cible'} correspond parfaitement Ã  tes aptitudes. ` +
        `Consulte un conseiller YIRA pour finaliser ton orientation.`;
    }
  }
}
