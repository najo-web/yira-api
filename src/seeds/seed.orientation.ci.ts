// ============================================================
// YIRA â€” seed.orientation.ci.ts
// Sprint 10A â€” Seed officiel base_orientation
// DonnÃ©es rÃ©elles MESRS CI (Mai 2026)
// Sources :
//   - bac.mesrs-ci.net (filiÃ¨res universitÃ©s publiques)
//   - PDF MESRS DESPRIV (147 Ã©tablissements BTS privÃ©s)
//   - Images MESRS filiÃ¨res officielles
// RÃˆGLE : Ne jamais modifier les donnÃ©es MESRS directement
//         Ajouter uniquement via seed versionnÃ©
// ============================================================

import { PrismaClient } from '@prisma/client-orientation';

// â”€â”€ Client base_orientation uniquement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_ORIENTATION_URL } },
});

// ============================================================
// 1. SÃ‰RIES BAC CI OFFICIELLES (16 sÃ©ries MESRS)
// ============================================================
const SERIES_BAC_CI = [
  { code: 'A1', nom: 'Lettres, Philosophie et Langues', domaine: 'LETTRES' },
  { code: 'A2', nom: 'Lettres, Sciences Humaines et Sociales', domaine: 'LETTRES' },
  { code: 'B',  nom: 'Ã‰conomie et Sciences Sociales', domaine: 'ECONOMIE' },
  { code: 'C',  nom: 'MathÃ©matiques et Sciences Physiques', domaine: 'SCIENCES' },
  { code: 'D',  nom: 'Sciences de la Vie et de la Terre', domaine: 'SCIENCES' },
  { code: 'E',  nom: 'MathÃ©matiques et Techniques', domaine: 'TECHNIQUE' },
  { code: 'F1', nom: 'Sciences et Techniques Industrielles â€” GÃ©nie MÃ©canique', domaine: 'TECHNIQUE' },
  { code: 'F2', nom: 'Sciences et Techniques Industrielles â€” GÃ©nie Ã‰lectrique', domaine: 'TECHNIQUE' },
  { code: 'F3', nom: 'Sciences et Techniques Industrielles â€” GÃ©nie Civil', domaine: 'TECHNIQUE' },
  { code: 'F4', nom: 'Sciences et Techniques Industrielles â€” GÃ©nie Chimique', domaine: 'TECHNIQUE' },
  { code: 'G1', nom: 'Sciences et Techniques de Gestion â€” Administration', domaine: 'GESTION' },
  { code: 'G2', nom: 'Sciences et Techniques de Gestion â€” ComptabilitÃ©', domaine: 'GESTION' },
  { code: 'H1', nom: 'Sciences et Techniques de la SantÃ© â€” Infirmerie', domaine: 'SANTE' },
  { code: 'H2', nom: 'Sciences et Techniques de la SantÃ© â€” Sage-Femme', domaine: 'SANTE' },
  { code: 'H3', nom: 'Sciences et Techniques de la SantÃ© â€” Aide Soignant', domaine: 'SANTE' },
  { code: 'F7', nom: 'Sciences et Techniques Agricoles', domaine: 'AGRICULTURE' },
];

// ============================================================
// 2. FILIÃˆRES UNIVERSITÃ‰S PUBLIQUES CI
//    Source : MESRS â€” Guide du Bachelier officiel
//    LÃ©gende : X = plusieurs universitÃ©s, â™¦ = une seule universitÃ©
// ============================================================
const FILIERES_UNIVERSITE = [
  // â”€â”€ LETTRES, LANGUES ET ARTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    code: 'UNIV_ALLEMAND',
    nom: 'Allemand',
    domaine: 'LETTRES_LANGUES',
    series_bac: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
    age_max: 23,
    criteres_acces: { All: 12, Franc: 10, Ang: 9 },
    universites: ['UFHB', 'UAO'],
    duree_annees: 3,
    debouches: ['Professeur Allemand', 'Traducteur', 'InterprÃ¨te', 'Diplomate'],
    riasec: { R: 20, I: 60, A: 55, S: 70, E: 40, C: 50 },
    roi_index: 0.55,
    salaire_moy_fcfa: 200000,
    taux_emploi: 0.60,
  },
  {
    code: 'UNIV_ANGLAIS',
    nom: 'Anglais',
    domaine: 'LETTRES_LANGUES',
    series_bac: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
    age_max: 23,
    criteres_acces: { Ang: 12, Franc: 10, LV2: 9 },
    universites: ['UFHB', 'UAO', 'UPGC'],
    duree_annees: 3,
    debouches: ['Professeur Anglais', 'Traducteur', 'InterprÃ¨te CI/Int.', 'Journaliste', 'Agent diplomatique'],
    riasec: { R: 20, I: 55, A: 50, S: 75, E: 45, C: 45 },
    roi_index: 0.60,
    salaire_moy_fcfa: 220000,
    taux_emploi: 0.65,
  },
  {
    code: 'UNIV_LETTRES_MOD',
    nom: 'Lettres Modernes',
    domaine: 'LETTRES_LANGUES',
    series_bac: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
    age_max: 23,
    criteres_acces: { Franc: 12, Philo: 9, LV2: 9 },
    universites: ['UFHB', 'UAO', 'UPGC'],
    duree_annees: 3,
    debouches: ['Professeur Lettres', 'Journaliste', 'Ã‰crivain', 'Communicant'],
    riasec: { R: 15, I: 55, A: 75, S: 65, E: 40, C: 40 },
    roi_index: 0.50,
    salaire_moy_fcfa: 190000,
    taux_emploi: 0.58,
  },
  // â”€â”€ SCIENCES HUMAINES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    code: 'UNIV_HISTOIRE',
    nom: 'Histoire',
    domaine: 'SHS',
    series_bac: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
    age_max: 23,
    criteres_acces: { Philo: 10, Franc: 10, HistGeo: 12 },
    universites: ['UFHB', 'UAO', 'UAO'],
    duree_annees: 3,
    debouches: ['Professeur Histoire', 'Archiviste', 'Chercheur', 'Fonctionnaire culturel'],
    riasec: { R: 20, I: 70, A: 45, S: 60, E: 35, C: 55 },
    roi_index: 0.52,
    salaire_moy_fcfa: 200000,
    taux_emploi: 0.62,
  },
  {
    code: 'UNIV_GEOGRAPHIE',
    nom: 'GÃ©ographie',
    domaine: 'SHS',
    series_bac: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
    age_max: 23,
    criteres_acces: { HistGeo: 12, Franc: 10, Philo: 10, Maths: 9 },
    universites: ['UFHB', 'UAO', 'UJLOG', 'UPGC'],
    duree_annees: 3,
    debouches: ['GÃ©ographe', 'Urbaniste', 'Cartographe', 'Enseignant', 'Consultant amÃ©nagement'],
    riasec: { R: 35, I: 65, A: 30, S: 55, E: 35, C: 50 },
    roi_index: 0.55,
    salaire_moy_fcfa: 210000,
    taux_emploi: 0.63,
  },
  {
    code: 'UNIV_PHILO',
    nom: 'Philosophie',
    domaine: 'SHS',
    series_bac: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
    age_max: 23,
    criteres_acces: { Philo: 12, Franc: 10, HistGeo: 10 },
    universites: ['UFHB', 'UAO'],
    duree_annees: 3,
    debouches: ['Professeur Philo', 'Chercheur', 'Journaliste', 'Ã‰thicien entreprise'],
    riasec: { R: 15, I: 75, A: 50, S: 65, E: 35, C: 40 },
    roi_index: 0.48,
    salaire_moy_fcfa: 190000,
    taux_emploi: 0.55,
  },
  {
    code: 'UNIV_PSYCHOLOGIE',
    nom: 'Psychologie',
    domaine: 'SHS',
    series_bac: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
    age_max: 23,
    criteres_acces: { Franc: 10, Philo: 10, SVT: 10 },
    universites: ['UFHB'],
    duree_annees: 5,
    debouches: ['Psychologue clinicien', 'Psychologue RH', 'Conseiller orientation', 'ThÃ©rapeute'],
    riasec: { R: 15, I: 70, A: 35, S: 85, E: 40, C: 45 },
    roi_index: 0.65,
    salaire_moy_fcfa: 300000,
    taux_emploi: 0.70,
  },
  {
    code: 'UNIV_SOCIO',
    nom: 'Sociologie',
    domaine: 'SHS',
    series_bac: ['A1','A2','B','C','D','E','F1','F2','F3','F4','G1','G2','H1','H2','H3','F7'],
    age_max: 23,
    criteres_acces: { Philo: 10, Franc: 10, HistGeo: 10 },
    universites: ['UFHB', 'UAO', 'UJLOG', 'UPGC'],
    duree_annees: 3,
    debouches: ['Sociologue', 'ChargÃ© d\'Ã©tude', 'Consultant ONG', 'Chercheur social'],
    riasec: { R: 15, I: 70, A: 35, S: 80, E: 40, C: 45 },
    roi_index: 0.55,
    salaire_moy_fcfa: 220000,
    taux_emploi: 0.60,
  },
  // â”€â”€ DROIT Ã‰CONOMIE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    code: 'UNIV_DROIT',
    nom: 'Sciences Juridiques',
    domaine: 'DROIT_ECONOMIE',
    series_bac: ['A1','A2','B','C','D','G1'],
    age_max: 23,
    criteres_acces: { Philo: 12, Franc: 12, HistGeo: 12 },
    universites: ['UFHB', 'UAO', 'UJLOG', 'UPGC'],
    duree_annees: 5,
    debouches: ['Avocat', 'Magistrat', 'Juriste entreprise', 'Notaire', 'Huissier'],
    riasec: { R: 10, I: 65, A: 25, S: 70, E: 80, C: 65 },
    roi_index: 0.70,
    salaire_moy_fcfa: 400000,
    taux_emploi: 0.72,
  },
  {
    code: 'UNIV_ECONOMIE',
    nom: 'Sciences Ã‰conomiques',
    domaine: 'DROIT_ECONOMIE',
    series_bac: ['A1','B','C','D','G2'],
    age_max: 23,
    criteres_acces: { Maths: 11, BAC: 12, C: 12, D: 12, G2: 15, Franc: 11, Ang: 11 },
    universites: ['UFHB', 'UAO', 'UJLOG', 'UPGC'],
    duree_annees: 3,
    debouches: ['Ã‰conomiste', 'Analyste financier', 'Banquier', 'Consultant', 'ContrÃ´leur de gestion'],
    riasec: { R: 20, I: 75, A: 25, S: 50, E: 70, C: 80 },
    roi_index: 0.78,
    salaire_moy_fcfa: 450000,
    taux_emploi: 0.78,
  },
  // â”€â”€ SCIENCES FONDAMENTALES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    code: 'UNIV_MATHS_INFO',
    nom: 'MathÃ©matiques-Informatique',
    domaine: 'SCIENCES_FONDAMENTALES',
    series_bac: ['C', 'D', 'E'],
    age_max: 23,
    criteres_acces: { Maths: 12, D: 14, E: 11, Phys: 10, D14: true, E10: true },
    universites: ['UFHB'],
    duree_annees: 3,
    debouches: ['DÃ©veloppeur', 'Data Scientist', 'MathÃ©maticien', 'Chercheur', 'Enseignant'],
    riasec: { R: 30, I: 90, A: 20, S: 30, E: 45, C: 65 },
    roi_index: 0.85,
    salaire_moy_fcfa: 500000,
    taux_emploi: 0.88,
  },
  {
    code: 'UNIV_PHYSIQUE_CHIMIE',
    nom: 'Physiques-Chimie',
    domaine: 'SCIENCES_FONDAMENTALES',
    series_bac: ['C', 'D', 'E'],
    age_max: 23,
    criteres_acces: { Maths: 11, D: 12, E: 11, Phys: 12, D14: true, E10: true },
    universites: ['UFHB', 'UAO'],
    duree_annees: 3,
    debouches: ['Chercheur', 'IngÃ©nieur chimiste', 'Prof Sciences', 'Laborantin', 'Pharmacien (aprÃ¨s spÃ©)'],
    riasec: { R: 40, I: 85, A: 15, S: 30, E: 35, C: 55 },
    roi_index: 0.68,
    salaire_moy_fcfa: 320000,
    taux_emploi: 0.70,
  },
  // â”€â”€ SANTÃ‰ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    code: 'UNIV_MEDECINE',
    nom: 'MÃ©decine',
    domaine: 'SANTE',
    series_bac: ['C', 'D'],
    age_max: 22,
    criteres_acces: { Maths: 11, Phys: 11, SVT: 11 },
    universites: ['UFHB', 'UNA'],
    duree_annees: 7,
    debouches: ['MÃ©decin gÃ©nÃ©raliste', 'MÃ©decin spÃ©cialiste', 'Chirurgien', 'MÃ©decin chercheur'],
    riasec: { R: 35, I: 85, A: 20, S: 90, E: 45, C: 55 },
    roi_index: 0.90,
    salaire_moy_fcfa: 800000,
    taux_emploi: 0.95,
  },
  {
    code: 'UNIV_PHARMACIE',
    nom: 'Pharmacie',
    domaine: 'SANTE',
    series_bac: ['C', 'D'],
    age_max: 22,
    criteres_acces: { Maths: 11, Phys: 11, SVT: 11 },
    universites: ['UFHB', 'UNA'],
    duree_annees: 6,
    debouches: ['Pharmacien officine', 'Pharmacien industrie', 'Biologiste', 'Chercheur pharmacologie'],
    riasec: { R: 35, I: 80, A: 15, S: 70, E: 50, C: 65 },
    roi_index: 0.88,
    salaire_moy_fcfa: 600000,
    taux_emploi: 0.92,
  },
  // â”€â”€ AGRICULTURE / ENVIRONNEMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    code: 'UNIV_AGRO',
    nom: 'Agroforesterie et Environnement',
    domaine: 'AGRICULTURE_ENVIRO',
    series_bac: ['C', 'D'],
    age_max: 23,
    criteres_acces: { Ang: 10, Maths: 11, Phys: 11, SVT: 11 },
    universites: ['UPGC'],
    duree_annees: 3,
    debouches: ['Agronome', 'Forestier', 'Consultant environnement', 'ChargÃ© projets agricoles'],
    riasec: { R: 65, I: 65, A: 30, S: 45, E: 40, C: 45 },
    roi_index: 0.65,
    salaire_moy_fcfa: 280000,
    taux_emploi: 0.72,
  },
  // â”€â”€ NUMÃ‰RIQUE (INFOCAD) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    code: 'INFOCAD_DAS',
    nom: 'DÃ©veloppement d\'Application et e-Service',
    domaine: 'NUMERIQUE',
    series_bac: ['C','D','E','F1','F2','F3','F4'],
    age_max: 23,
    criteres_acces: { Maths: 11, D: 12, EF: 11, Phys: 10, Franc: 10, Ang: 10 },
    universites: ['INFOCAD'],
    duree_annees: 3,
    debouches: ['DÃ©veloppeur web/mobile', 'Architecte application', 'Entrepreneur numÃ©rique', 'Chef projet dev'],
    riasec: { R: 35, I: 90, A: 30, S: 25, E: 55, C: 65 },
    roi_index: 0.90,
    salaire_moy_fcfa: 500000,
    taux_emploi: 0.88,
  },
  {
    code: 'INFOCAD_RSI',
    nom: 'RÃ©seaux et SÃ©curitÃ© Informatique',
    domaine: 'NUMERIQUE',
    series_bac: ['C','D','E','F1','F2','F3'],
    age_max: 23,
    criteres_acces: { Maths: 11, D: 12, E: 11, Phys: 11, Franc: 10, Ang: 10 },
    universites: ['INFOCAD'],
    duree_annees: 3,
    debouches: ['Admin rÃ©seaux', 'CybersÃ©curitÃ©', 'Chef projet sÃ©curitÃ©', 'Gestionnaire SI'],
    riasec: { R: 45, I: 88, A: 15, S: 25, E: 50, C: 70 },
    roi_index: 0.92,
    salaire_moy_fcfa: 550000,
    taux_emploi: 0.90,
  },
  {
    code: 'INFOCAD_COM',
    nom: 'Communication Digitale',
    domaine: 'NUMERIQUE',
    series_bac: ['A1','A2','D','C','E','G1'],
    age_max: 23,
    criteres_acces: { Franc: 11, Ang: 11 },
    universites: ['INFOCAD'],
    duree_annees: 3,
    debouches: ['Community manager', 'Social media strategist', 'RÃ©dacteur web', 'Content manager', 'e-RÃ©putation'],
    riasec: { R: 15, I: 50, A: 70, S: 65, E: 75, C: 45 },
    roi_index: 0.75,
    salaire_moy_fcfa: 350000,
    taux_emploi: 0.80,
  },
];

// ============================================================
// 3. FILIÃˆRES BTS PRIVÃ‰ES CI (27 filiÃ¨res officielles MESRS)
//    Source : PDF DESPRIV MESRS Mars 2010 + mise Ã  jour 2024
// ============================================================
const FILIERES_BTS = [
  {
    code: 'BTS_FINANCE_COMPTA',
    nom: 'Finance ComptabilitÃ© et Gestion des Entreprises',
    domaine: 'GESTION_FINANCE',
    duree_annees: 2,
    debouches: ['Comptable', 'ContrÃ´leur de gestion', 'Auditeur', 'DAF adjoint', 'Gestionnaire PME'],
    riasec: { R: 15, I: 55, A: 10, S: 40, E: 65, C: 90 },
    roi_index: 0.80,
    salaire_moy_fcfa: 280000,
    taux_emploi: 0.78,
    nb_ecoles_ci: 95,
  },
  {
    code: 'BTS_GESTION_COM',
    nom: 'Gestion Commerciale',
    domaine: 'COMMERCE',
    duree_annees: 2,
    debouches: ['Commercial', 'Responsable vente', 'Chef rayon', 'Account manager', 'Business developer'],
    riasec: { R: 20, I: 40, A: 25, S: 65, E: 85, C: 60 },
    roi_index: 0.78,
    salaire_moy_fcfa: 260000,
    taux_emploi: 0.76,
    nb_ecoles_ci: 92,
  },
  {
    code: 'BTS_INFO_DEV',
    nom: 'Informatique DÃ©veloppeur d\'Application',
    domaine: 'NUMERIQUE',
    duree_annees: 2,
    debouches: ['DÃ©veloppeur junior', 'Technicien informatique', 'Support technique', 'Admin systÃ¨me'],
    riasec: { R: 40, I: 85, A: 20, S: 25, E: 45, C: 65 },
    roi_index: 0.88,
    salaire_moy_fcfa: 350000,
    taux_emploi: 0.85,
    nb_ecoles_ci: 65,
  },
  {
    code: 'BTS_RH_COM',
    nom: 'Ressources Humaines et Communication',
    domaine: 'RH_COMMUNICATION',
    duree_annees: 2,
    debouches: ['Assistant RH', 'ChargÃ© recrutement', 'Communicant', 'Assistant communication', 'ChargÃ© formation'],
    riasec: { R: 15, I: 45, A: 45, S: 80, E: 65, C: 55 },
    roi_index: 0.72,
    salaire_moy_fcfa: 240000,
    taux_emploi: 0.72,
    nb_ecoles_ci: 60,
  },
  {
    code: 'BTS_ASSISTANAT_DIR',
    nom: 'Assistanat de Direction',
    domaine: 'ADMINISTRATION',
    duree_annees: 2,
    debouches: ['Assistante de direction', 'Office manager', 'SecrÃ©taire exÃ©cutif', 'Assistant administratif'],
    riasec: { R: 15, I: 40, A: 20, S: 65, E: 50, C: 85 },
    roi_index: 0.68,
    salaire_moy_fcfa: 220000,
    taux_emploi: 0.70,
    nb_ecoles_ci: 55,
  },
  {
    code: 'BTS_LOGISTIQUE',
    nom: 'Logistique',
    domaine: 'LOGISTIQUE_TRANSPORT',
    duree_annees: 2,
    debouches: ['Logisticien', 'Agent transit', 'Responsable entrepÃ´t', 'Supply chain officer'],
    riasec: { R: 50, I: 55, A: 15, S: 40, E: 60, C: 75 },
    roi_index: 0.75,
    salaire_moy_fcfa: 270000,
    taux_emploi: 0.75,
    nb_ecoles_ci: 48,
  },
  {
    code: 'BTS_TOURISME',
    nom: 'Tourisme et HÃ´tellerie',
    domaine: 'TOURISME_HOTEL',
    duree_annees: 2,
    debouches: ['Agent voyage', 'RÃ©ceptionniste hÃ´tel', 'Guide touristique', 'Manager hÃ´telier'],
    riasec: { R: 25, I: 35, A: 45, S: 80, E: 65, C: 50 },
    roi_index: 0.65,
    salaire_moy_fcfa: 230000,
    taux_emploi: 0.68,
    nb_ecoles_ci: 30,
  },
  {
    code: 'BTS_ELEC',
    nom: 'Electrotechnique',
    domaine: 'TECHNIQUE_INDUSTRIE',
    duree_annees: 2,
    debouches: ['Technicien Ã©lectricien', 'Ã‰lectromÃ©canicien', 'Agent maintenance Ã©lectrique'],
    riasec: { R: 80, I: 65, A: 10, S: 20, E: 35, C: 55 },
    roi_index: 0.78,
    salaire_moy_fcfa: 280000,
    taux_emploi: 0.80,
    nb_ecoles_ci: 20,
  },
  {
    code: 'BTS_RESEAUX_INFO',
    nom: 'RÃ©seaux Informatique et TÃ©lÃ©communication',
    domaine: 'NUMERIQUE',
    duree_annees: 2,
    debouches: ['Technicien rÃ©seaux', 'Admin rÃ©seau', 'Support IT', 'Technicien tÃ©lÃ©com'],
    riasec: { R: 50, I: 82, A: 10, S: 20, E: 40, C: 65 },
    roi_index: 0.85,
    salaire_moy_fcfa: 320000,
    taux_emploi: 0.82,
    nb_ecoles_ci: 22,
  },
  {
    code: 'BTS_GENIE_CIVIL',
    nom: 'GÃ©nie Civil option BÃ¢timent',
    domaine: 'BTP',
    duree_annees: 2,
    debouches: ['Technicien BTP', 'Conducteur travaux', 'Dessinateur projeteur', 'GÃ©omÃ¨tre'],
    riasec: { R: 85, I: 60, A: 30, S: 25, E: 40, C: 55 },
    roi_index: 0.80,
    salaire_moy_fcfa: 290000,
    taux_emploi: 0.78,
    nb_ecoles_ci: 15,
  },
  {
    code: 'BTS_AGRO',
    nom: 'Agriculture Tropicale option Production VÃ©gÃ©tale',
    domaine: 'AGRICULTURE',
    duree_annees: 2,
    debouches: ['Technicien agricole', 'Agent dÃ©veloppement rural', 'Conseiller agricole', 'Entrepreneur agricole'],
    riasec: { R: 70, I: 60, A: 25, S: 50, E: 55, C: 40 },
    roi_index: 0.68,
    salaire_moy_fcfa: 220000,
    taux_emploi: 0.72,
    nb_ecoles_ci: 8,
  },
  {
    code: 'BTS_CARRIERE_JUR',
    nom: 'CarriÃ¨re Juridique et Professions ImmobiliÃ¨res',
    domaine: 'DROIT_IMMO',
    duree_annees: 2,
    debouches: ['Assistant juridique', 'Agent immobilier', 'Clerc notaire', 'Collaborateur avocat'],
    riasec: { R: 10, I: 60, A: 15, S: 60, E: 70, C: 75 },
    roi_index: 0.70,
    salaire_moy_fcfa: 260000,
    taux_emploi: 0.70,
    nb_ecoles_ci: 12,
  },
  {
    code: 'BTS_FINANCES_ASSUR',
    nom: 'Finances-Assurances',
    domaine: 'BANQUE_ASSURANCE',
    duree_annees: 2,
    debouches: ['Agent assurance', 'ChargÃ© clientÃ¨le banque', 'Courtier assurance', 'Gestionnaire sinistres'],
    riasec: { R: 15, I: 55, A: 10, S: 60, E: 70, C: 85 },
    roi_index: 0.78,
    salaire_moy_fcfa: 280000,
    taux_emploi: 0.76,
    nb_ecoles_ci: 18,
  },
  {
    code: 'BTS_MAINTENANCE',
    nom: 'Maintenance des SystÃ¨mes de Production',
    domaine: 'TECHNIQUE_INDUSTRIE',
    duree_annees: 2,
    debouches: ['Technicien maintenance', 'Agent de production', 'MÃ©canicien industriel'],
    riasec: { R: 85, I: 65, A: 10, S: 20, E: 35, C: 55 },
    roi_index: 0.75,
    salaire_moy_fcfa: 270000,
    taux_emploi: 0.78,
    nb_ecoles_ci: 14,
  },
  {
    code: 'BTS_GENIE_ENERGIE',
    nom: 'GÃ©nie EnergÃ©tique et Environnement',
    domaine: 'ENERGIE_ENVIRO',
    duree_annees: 2,
    debouches: ['Technicien Ã©nergie', 'Agent environnement', 'Technicien solaire', 'Agent ANASUR'],
    riasec: { R: 75, I: 65, A: 20, S: 35, E: 40, C: 55 },
    roi_index: 0.78,
    salaire_moy_fcfa: 275000,
    taux_emploi: 0.76,
    nb_ecoles_ci: 12,
  },
  {
    code: 'BTS_AGRO_ALIM',
    nom: 'Industrie Agro-alimentaire et Chimique',
    domaine: 'AGROALIMENTAIRE',
    duree_annees: 2,
    debouches: ['Technicien agroalimentaire', 'ContrÃ´leur qualitÃ©', 'Agent production alimentaire'],
    riasec: { R: 65, I: 65, A: 15, S: 35, E: 40, C: 60 },
    roi_index: 0.72,
    salaire_moy_fcfa: 260000,
    taux_emploi: 0.74,
    nb_ecoles_ci: 10,
  },
  {
    code: 'BTS_SYST_ELEC_INFO',
    nom: 'SystÃ¨mes Electroniques et Informatique',
    domaine: 'TECHNIQUE_INDUSTRIE',
    duree_annees: 2,
    debouches: ['Technicien Ã©lectronique', 'Technicien son/image', 'Agent support technique'],
    riasec: { R: 70, I: 78, A: 15, S: 20, E: 40, C: 60 },
    roi_index: 0.80,
    salaire_moy_fcfa: 290000,
    taux_emploi: 0.80,
    nb_ecoles_ci: 25,
  },
  {
    code: 'BTS_COMM_VIS',
    nom: 'Communication Visuelle',
    domaine: 'ARTS_COMM',
    duree_annees: 2,
    debouches: ['Graphiste', 'Designer', 'Directeur artistique junior', 'Infographiste'],
    riasec: { R: 25, I: 45, A: 90, S: 40, E: 55, C: 40 },
    roi_index: 0.65,
    salaire_moy_fcfa: 230000,
    taux_emploi: 0.68,
    nb_ecoles_ci: 5,
  },
  {
    code: 'BTS_GESTION_COLL',
    nom: 'Gestion des CollectivitÃ©s Territoriales',
    domaine: 'ADMINISTRATION_PUBLIQUE',
    duree_annees: 2,
    debouches: ['Agent collectivitÃ©', 'Assistant mairie', 'Gestionnaire communal'],
    riasec: { R: 20, I: 50, A: 15, S: 65, E: 55, C: 80 },
    roi_index: 0.65,
    salaire_moy_fcfa: 220000,
    taux_emploi: 0.70,
    nb_ecoles_ci: 10,
  },
  {
    code: 'BTS_MINES',
    nom: 'Mines, GÃ©ologie et PÃ©trole',
    domaine: 'MINES_ENERGIE',
    duree_annees: 2,
    debouches: ['Technicien minier', 'Agent gÃ©ologue', 'Technicien pÃ©trolier'],
    riasec: { R: 80, I: 70, A: 10, S: 20, E: 40, C: 50 },
    roi_index: 0.88,
    salaire_moy_fcfa: 400000,
    taux_emploi: 0.82,
    nb_ecoles_ci: 8,
  },
];

// ============================================================
// 4. Ã‰TABLISSEMENTS CLÃ‰S CI (extrait des 147 MESRS)
//    Seed des principaux Ã©tablissements par zone
// ============================================================
const ETABLISSEMENTS_CLES = [
  // â”€â”€ PUBLICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    code: 'UFHB_COCODY',
    nom: 'UniversitÃ© FÃ©lix HouphouÃ«t-Boigny',
    type: 'PUBLIC_UNIVERSITE',
    zone: 'COCODY',
    ville: 'Abidjan',
    filieres_codes: ['UNIV_DROIT','UNIV_ECONOMIE','UNIV_ANGLAIS','UNIV_MATHS_INFO','UNIV_PHYSIQUE_CHIMIE','UNIV_MEDECINE','UNIV_PHARMACIE','UNIV_PSYCHOLOGIE','UNIV_HISTOIRE','UNIV_GEOGRAPHIE','UNIV_LETTRES_MOD','UNIV_SOCIO','UNIV_PHILO','UNIV_ALLEMAND'],
    frais_annuels_fcfa: 0,
    acces: 'Concours MESRS',
    capacite_index: 5,
  },
  {
    code: 'INP_HB_YAMOUSSOUKRO',
    nom: 'Institut National Polytechnique FÃ©lix HouphouÃ«t-Boigny',
    type: 'PUBLIC_GRANDE_ECOLE',
    zone: 'YAMOUSSOUKRO',
    ville: 'Yamoussoukro',
    filieres_codes: ['UNIV_MATHS_INFO','UNIV_PHYSIQUE_CHIMIE','INFOCAD_DAS','INFOCAD_RSI'],
    frais_annuels_fcfa: 0,
    acces: 'Concours national â€” trÃ¨s sÃ©lectif',
    capacite_index: 4,
  },
  {
    code: 'UNA_ABOBO',
    nom: 'UniversitÃ© Nangui Abrogoua',
    type: 'PUBLIC_UNIVERSITE',
    zone: 'ABOBO',
    ville: 'Abidjan',
    filieres_codes: ['UNIV_MEDECINE','UNIV_PHARMACIE','UNIV_AGRO','UNIV_ALLEMAND'],
    frais_annuels_fcfa: 0,
    acces: 'Affectation MESRS',
    capacite_index: 3,
  },
  {
    code: 'UAO_BOUAKE',
    nom: 'UniversitÃ© Alassane Ouattara',
    type: 'PUBLIC_UNIVERSITE',
    zone: 'BOUAKE',
    ville: 'BouakÃ©',
    filieres_codes: ['UNIV_DROIT','UNIV_ECONOMIE','UNIV_ANGLAIS','UNIV_HISTOIRE','UNIV_GEOGRAPHIE','UNIV_PHILO','UNIV_SOCIO'],
    frais_annuels_fcfa: 0,
    acces: 'Affectation MESRS',
    capacite_index: 3,
  },
  {
    code: 'UPGC_KORHOGO',
    nom: 'UniversitÃ© Peleforo Gon Coulibaly',
    type: 'PUBLIC_UNIVERSITE',
    zone: 'KORHOGO',
    ville: 'Korhogo',
    filieres_codes: ['UNIV_DROIT','UNIV_ECONOMIE','UNIV_GEOGRAPHIE','UNIV_AGRO'],
    frais_annuels_fcfa: 0,
    acces: 'Affectation MESRS',
    capacite_index: 2,
  },
  // â”€â”€ PRIVÃ‰S ABIDJAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    code: 'PIGIER_PLATEAU',
    nom: 'PIGIER CÃ´te d\'Ivoire',
    type: 'PRIVE_BTS',
    zone: 'PLATEAU',
    ville: 'Abidjan',
    filieres_codes: ['BTS_ASSISTANAT_DIR','BTS_FINANCE_COMPTA','BTS_GESTION_COM','BTS_RH_COM','BTS_TOURISME','BTS_INFO_DEV'],
    frais_annuels_fcfa: 600000,
    acces: 'Dossier + entretien',
    capacite_index: 5,
  },
  {
    code: 'IST_LA_COLOMBE',
    nom: 'IST La Colombe',
    type: 'PRIVE_BTS',
    zone: 'KOUMASSI',
    ville: 'Abidjan',
    filieres_codes: ['BTS_FINANCE_COMPTA','BTS_GESTION_COM','BTS_ASSISTANAT_DIR','BTS_FINANCES_ASSUR','BTS_AGRO_ALIM','BTS_GENIE_ENERGIE','BTS_LOGISTIQUE','BTS_INFO_DEV','BTS_SYST_ELEC_INFO','BTS_MAINTENANCE','BTS_ELEC','BTS_RESEAUX_INFO','BTS_TOURISME','BTS_GESTION_COLL','BTS_GENIE_CIVIL','BTS_RH_COM'],
    frais_annuels_fcfa: 400000,
    acces: 'Dossier BAC',
    capacite_index: 5,
  },
  {
    code: 'ESTIC_ABIDJAN',
    nom: 'ESTIC â€” Ã‰cole SupÃ©rieure des Technologies et de l\'Informatique',
    type: 'PRIVE_BTS',
    zone: 'COCODY',
    ville: 'Abidjan',
    filieres_codes: ['BTS_INFO_DEV','BTS_RESEAUX_INFO','BTS_SYST_ELEC_INFO','BTS_GESTION_COM','BTS_FINANCE_COMPTA'],
    frais_annuels_fcfa: 550000,
    acces: 'Dossier + test entrÃ©e',
    capacite_index: 4,
  },
  {
    code: 'EPCCI_PLATEAU',
    nom: 'EPCCI â€” Ã‰cole Pratique Chambre de Commerce CI',
    type: 'PRIVE_BTS',
    zone: 'PLATEAU',
    ville: 'Abidjan',
    filieres_codes: ['BTS_ASSISTANAT_DIR','BTS_FINANCE_COMPTA','BTS_TOURISME','BTS_LOGISTIQUE','BTS_INFO_DEV','BTS_GESTION_COM'],
    frais_annuels_fcfa: 700000,
    acces: 'Dossier + test entrÃ©e',
    capacite_index: 4,
  },
  {
    code: 'INPRAT_ADZOPE',
    nom: 'INPRAT â€” Institut National Pratique Rural',
    type: 'PRIVE_BTS',
    zone: 'ADZOPE',
    ville: 'AdzopÃ©',
    filieres_codes: ['BTS_AGRO'],
    frais_annuels_fcfa: 300000,
    acces: 'Dossier BAC',
    capacite_index: 2,
  },
  // â”€â”€ PRIVÃ‰S INTÃ‰RIEUR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    code: 'HETEC_BOUAKE',
    nom: 'HETEC BouakÃ©',
    type: 'PRIVE_BTS',
    zone: 'BOUAKE',
    ville: 'BouakÃ©',
    filieres_codes: ['BTS_GESTION_COM','BTS_INFO_DEV','BTS_FINANCE_COMPTA','BTS_LOGISTIQUE','BTS_SYST_ELEC_INFO'],
    frais_annuels_fcfa: 350000,
    acces: 'Dossier BAC',
    capacite_index: 3,
  },
  {
    code: 'ISCAE_YAMOUSSOUKRO',
    nom: 'ISCAE Yamoussoukro',
    type: 'PRIVE_BTS',
    zone: 'YAMOUSSOUKRO',
    ville: 'Yamoussoukro',
    filieres_codes: ['BTS_FINANCE_COMPTA','BTS_GESTION_COM','BTS_LOGISTIQUE','BTS_INFO_DEV','BTS_RH_COM','BTS_GESTION_COLL','BTS_CARRIERE_JUR','BTS_RESEAUX_INFO'],
    frais_annuels_fcfa: 350000,
    acces: 'Dossier BAC',
    capacite_index: 3,
  },
  {
    code: 'ESICOM_KORHOGO',
    nom: 'ESICOM Korhogo',
    type: 'PRIVE_BTS',
    zone: 'KORHOGO',
    ville: 'Korhogo',
    filieres_codes: ['BTS_FINANCE_COMPTA','BTS_GESTION_COM','BTS_INFO_DEV','BTS_ASSISTANAT_DIR'],
    frais_annuels_fcfa: 300000,
    acces: 'Dossier BAC',
    capacite_index: 2,
  },
];

// ============================================================
// 5. CORRESPONDANCES RIASEC PROFILS ACADÃ‰MIQUES â† BEPC
// ============================================================
const PROFILS_ACADEMIQUES_BEPC = [
  {
    code: 'SCIENTIFIQUE_FORT',
    label: 'Scientifique fort',
    conditions: { maths_min: 14, physique_min: 12, moyenne_min: 12 },
    voie_naturelle: '2nde C',
    riasec_match: { R: 40, I: 85, A: 15, S: 25, E: 40, C: 55 },
    probabilite_reussite_2nde_c: 0.82,
  },
  {
    code: 'LITTERAIRE_FORT',
    label: 'LittÃ©raire fort',
    conditions: { francais_min: 14, histgeo_min: 12, moyenne_min: 11 },
    voie_naturelle: '2nde A',
    riasec_match: { R: 10, I: 55, A: 70, S: 65, E: 40, C: 40 },
    probabilite_reussite_2nde_a: 0.80,
  },
  {
    code: 'POLYVALENT',
    label: 'Polyvalent',
    conditions: { moyenne_min: 10, moyenne_max: 12 },
    voie_naturelle: '2nde A ou C',
    riasec_match: { R: 35, I: 65, A: 45, S: 55, E: 55, C: 55 },
    probabilite_reussite_2nde_a: 0.65,
    probabilite_reussite_2nde_c: 0.55,
  },
  {
    code: 'TECHNIQUE_PRATIQUE',
    label: 'Technique-pratique',
    conditions: { sciences_max: 12, moyenne_min: 8, moyenne_max: 11 },
    voie_naturelle: 'LycÃ©e technique / Pro',
    riasec_match: { R: 80, I: 55, A: 25, S: 35, E: 50, C: 60 },
    probabilite_reussite_lycee_tech: 0.75,
  },
  {
    code: 'EN_DIFFICULTE',
    label: 'En difficultÃ©',
    conditions: { moyenne_max: 10 },
    voie_naturelle: 'Formation professionnelle courte',
    riasec_match: { R: 65, I: 40, A: 40, S: 50, E: 55, C: 50 },
    probabilite_reussite_fp: 0.70,
  },
];

// ============================================================
// 6. SEUILS DOB CI PAR RÃ‰GION (donnÃ©es estimÃ©es â€” Ã  calibrer)
//    Structure : { filiÃ¨re, rÃ©gion, seuil_MO, tendance }
// ============================================================
const SEUILS_DOB = [
  // â”€â”€ ABIDJAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { filiere: '2nde_C', region: 'ABIDJAN_COCODY',    seuil: 13.5, tendance: 0.3, places: 480 },
  { filiere: '2nde_C', region: 'ABIDJAN_PLATEAU',   seuil: 13.2, tendance: 0.3, places: 400 },
  { filiere: '2nde_C', region: 'ABIDJAN_YOPOUGON',  seuil: 12.8, tendance: 0.2, places: 600 },
  { filiere: '2nde_C', region: 'ABIDJAN_ABOBO',     seuil: 12.5, tendance: 0.2, places: 500 },
  { filiere: '2nde_C', region: 'ABIDJAN_KOUMASSI',  seuil: 12.0, tendance: 0.2, places: 350 },
  { filiere: '2nde_A', region: 'ABIDJAN_COCODY',    seuil: 12.0, tendance: 0.3, places: 400 },
  { filiere: '2nde_A', region: 'ABIDJAN_YOPOUGON',  seuil: 11.5, tendance: 0.2, places: 500 },
  { filiere: '2nde_A', region: 'ABIDJAN_ABOBO',     seuil: 11.0, tendance: 0.2, places: 450 },
  { filiere: 'LYCEE_TECH', region: 'ABIDJAN',       seuil: 9.0,  tendance: 0.2, places: 1200 },
  { filiere: 'FORMATION_PRO', region: 'ABIDJAN',    seuil: 7.5,  tendance: 0.1, places: 2000 },
  // â”€â”€ INTÃ‰RIEUR CI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  { filiere: '2nde_C', region: 'BOUAKE',            seuil: 12.0, tendance: 0.3, places: 400 },
  { filiere: '2nde_C', region: 'YAMOUSSOUKRO',      seuil: 12.5, tendance: 0.3, places: 300 },
  { filiere: '2nde_C', region: 'KORHOGO',           seuil: 11.5, tendance: 0.2, places: 250 },
  { filiere: '2nde_C', region: 'SAN_PEDRO',         seuil: 11.0, tendance: 0.2, places: 200 },
  { filiere: '2nde_A', region: 'BOUAKE',            seuil: 11.0, tendance: 0.2, places: 350 },
  { filiere: '2nde_A', region: 'KORHOGO',           seuil: 10.5, tendance: 0.2, places: 200 },
  { filiere: 'LYCEE_TECH', region: 'BOUAKE',        seuil: 8.5,  tendance: 0.2, places: 600 },
  { filiere: 'LYCEE_TECH', region: 'YAMOUSSOUKRO',  seuil: 8.5,  tendance: 0.2, places: 400 },
  { filiere: 'FORMATION_PRO', region: 'INTERIEUR',  seuil: 7.0,  tendance: 0.1, places: 1500 },
];

// ============================================================
// FONCTION PRINCIPALE â€” ExÃ©cution du seed
// ============================================================
async function main() {
  console.log('ðŸŒ± YIRA Sprint 10A â€” Seed base_orientation CI');
  console.log('â”€'.repeat(50));

  // â”€â”€ 1. SÃ©ries BAC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\nðŸ“š Seed sÃ©ries BAC CI...');
  for (const serie of SERIES_BAC_CI) {
    await prisma.yiraSerieBAC.upsert({
      where: { code: serie.code },
      create: serie,
      update: serie,
    });
  }
  console.log(`   âœ… ${SERIES_BAC_CI.length} sÃ©ries BAC`);

  // â”€â”€ 2. FiliÃ¨res universitÃ©s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\nðŸŽ“ Seed filiÃ¨res universitÃ©s publiques...');
  for (const filiere of FILIERES_UNIVERSITE) {
    await prisma.yiraFiliereUniversite.upsert({
      where: { code: filiere.code },
      create: {
        code: filiere.code,
        nom: filiere.nom,
        domaine: filiere.domaine,
        series_bac: JSON.stringify(filiere.series_bac),
        age_max: filiere.age_max,
        criteres_acces: JSON.stringify(filiere.criteres_acces),
        universites: JSON.stringify(filiere.universites),
        duree_annees: filiere.duree_annees,
        debouches: JSON.stringify(filiere.debouches),
        riasec_vecteur: JSON.stringify(filiere.riasec),
        roi_index: filiere.roi_index,
        salaire_moy_fcfa: filiere.salaire_moy_fcfa,
        taux_emploi: filiere.taux_emploi,
      },
      update: {
        riasec_vecteur: JSON.stringify(filiere.riasec),
        roi_index: filiere.roi_index,
        salaire_moy_fcfa: filiere.salaire_moy_fcfa,
        taux_emploi: filiere.taux_emploi,
      },
    });
  }
  console.log(`   âœ… ${FILIERES_UNIVERSITE.length} filiÃ¨res universitÃ©s`);

  // â”€â”€ 3. FiliÃ¨res BTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\nðŸ« Seed filiÃ¨res BTS privÃ©es officielles...');
  for (const bts of FILIERES_BTS) {
    await prisma.yiraFiliereBTS.upsert({
      where: { code: bts.code },
      create: {
        code: bts.code,
        nom: bts.nom,
        domaine: bts.domaine,
        duree_annees: bts.duree_annees,
        debouches: JSON.stringify(bts.debouches),
        riasec_vecteur: JSON.stringify(bts.riasec),
        roi_index: bts.roi_index,
        salaire_moy_fcfa: bts.salaire_moy_fcfa,
        taux_emploi: bts.taux_emploi,
        nb_ecoles_ci: bts.nb_ecoles_ci,
      },
      update: {
        riasec_vecteur: JSON.stringify(bts.riasec),
        roi_index: bts.roi_index,
        salaire_moy_fcfa: bts.salaire_moy_fcfa,
        taux_emploi: bts.taux_emploi,
      },
    });
  }
  console.log(`   âœ… ${FILIERES_BTS.length} filiÃ¨res BTS`);

  // â”€â”€ 4. Ã‰tablissements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\nðŸ›ï¸  Seed Ã©tablissements clÃ©s CI...');
  for (const etab of ETABLISSEMENTS_CLES) {
    await prisma.yiraEtablissement.upsert({
      where: { code: etab.code },
      create: {
        code: etab.code,
        nom: etab.nom,
        type: etab.type,
        zone: etab.zone,
        ville: etab.ville,
        filieres_codes: JSON.stringify(etab.filieres_codes),
        frais_annuels_fcfa: etab.frais_annuels_fcfa,
        acces: etab.acces,
        capacite_index: etab.capacite_index,
      },
      update: {
        filieres_codes: JSON.stringify(etab.filieres_codes),
        frais_annuels_fcfa: etab.frais_annuels_fcfa,
      },
    });
  }
  console.log(`   âœ… ${ETABLISSEMENTS_CLES.length} Ã©tablissements`);

  // â”€â”€ 5. Profils acadÃ©miques BEPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\nðŸ“Š Seed profils acadÃ©miques BEPC...');
  for (const profil of PROFILS_ACADEMIQUES_BEPC) {
    await prisma.yiraProfilAcademique.upsert({
      where: { code: profil.code },
      create: {
        code: profil.code,
        label: profil.label,
        conditions: JSON.stringify(profil.conditions),
        voie_naturelle: profil.voie_naturelle,
        riasec_match: JSON.stringify(profil.riasec_match),
      },
      update: {
        conditions: JSON.stringify(profil.conditions),
        riasec_match: JSON.stringify(profil.riasec_match),
      },
    });
  }
  console.log(`   âœ… ${PROFILS_ACADEMIQUES_BEPC.length} profils acadÃ©miques`);

  // â”€â”€ 6. Seuils DOB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\nðŸŽ¯ Seed seuils DOB CI...');
  for (const seuil of SEUILS_DOB) {
    await prisma.yiraSeuilDOB.upsert({
      where: { filiere_region: { filiere: seuil.filiere, region: seuil.region } },
      create: seuil,
      update: { seuil: seuil.seuil, tendance: seuil.tendance, places: seuil.places },
    });
  }
  console.log(`   âœ… ${SEUILS_DOB.length} seuils DOB`);

  console.log('\n' + 'â”€'.repeat(50));
  console.log('âœ… Sprint 10A â€” Seed complet');
  console.log(`   SÃ©ries BAC  : ${SERIES_BAC_CI.length}`);
  console.log(`   FiliÃ¨res U. : ${FILIERES_UNIVERSITE.length}`);
  console.log(`   FiliÃ¨res BTS: ${FILIERES_BTS.length}`);
  console.log(`   Ã‰tabliss.   : ${ETABLISSEMENTS_CLES.length}`);
  console.log(`   Profils BEPC: ${PROFILS_ACADEMIQUES_BEPC.length}`);
  console.log(`   Seuils DOB  : ${SEUILS_DOB.length}`);
  console.log('\nâš ï¸  Valeurs illustratives â€” Ã  calibrer avec donnÃ©es terrain CI');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
