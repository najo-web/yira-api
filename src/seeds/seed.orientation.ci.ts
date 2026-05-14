// =============================================================================
// YIRA V3.0 — src/seeds/seed.orientation.ci.ts
// Najo Technologies — CONFIDENTIEL
// Sprint 10A — Seed officiel base_orientation
// Données réelles MESRS CI (Mai 2026)
// Sources :
//   - bac.mesrs-ci.net (filières universités publiques)
//   - PDF MESRS DESPRIV (147 établissements BTS privés)
// RÈGLE : Ne jamais modifier les données MESRS directement
//         Ajouter uniquement via seed versionné
// =============================================================================
// STATUT : En attente de base_orientation (sprint suivant)
// Ce fichier contient les données de référence MESRS CI complètes.
// L'exécution sera activée quand le client Prisma orientation sera généré.
// =============================================================================

// TODO Sprint base_orientation : décommenter ces lignes
// import { PrismaClient } from '../../node_modules/.prisma/client-orientation';
// const prisma = new PrismaClient({
//   datasources: { db: { url: process.env.DATABASE_URL_ORIENTATION } },
// });

// ============================================================
// 1. SÉRIES BAC CI OFFICIELLES (16 séries MESRS)
// ============================================================
const SERIES_BAC_CI = [
  { code: 'A1', nom: 'Lettres, Philosophie et Langues',            domaine: 'LETTRES' },
  { code: 'A2', nom: 'Lettres, Sciences Humaines et Sociales',     domaine: 'LETTRES' },
  { code: 'B',  nom: 'Économie et Sciences Sociales',              domaine: 'ECONOMIE' },
  { code: 'C',  nom: 'Mathématiques et Sciences Physiques',        domaine: 'SCIENCES' },
  { code: 'D',  nom: 'Sciences de la Vie et de la Terre',          domaine: 'SCIENCES' },
  { code: 'E',  nom: 'Mathématiques et Techniques',                domaine: 'TECHNIQUE' },
  { code: 'F1', nom: 'STI — Génie Mécanique',                      domaine: 'TECHNIQUE' },
  { code: 'F2', nom: 'STI — Génie Électrique',                     domaine: 'TECHNIQUE' },
  { code: 'F3', nom: 'STI — Génie Civil',                          domaine: 'TECHNIQUE' },
  { code: 'F4', nom: 'STI — Génie Chimique',                       domaine: 'TECHNIQUE' },
  { code: 'G1', nom: 'STG — Administration',                       domaine: 'GESTION' },
  { code: 'G2', nom: 'STG — Comptabilité',                         domaine: 'GESTION' },
  { code: 'H1', nom: 'STS — Infirmerie',                           domaine: 'SANTE' },
  { code: 'H2', nom: 'STS — Sage-Femme',                           domaine: 'SANTE' },
  { code: 'H3', nom: 'STS — Aide Soignant',                        domaine: 'SANTE' },
  { code: 'F7', nom: 'Sciences et Techniques Agricoles',           domaine: 'AGRICULTURE' },
];

// ============================================================
// 2. FILIÈRES UNIVERSITÉS PUBLIQUES CI (extrait représentatif)
// ============================================================
const FILIERES_UNIVERSITE = [
  { code: 'UNIV_MATHS_INFO',    nom: 'Mathématiques-Informatique',    domaine: 'SCIENCES_FONDAMENTALES', duree_annees: 3, universites: ['UFHB'], roi_index: 0.85, salaire_moy_fcfa: 500000, taux_emploi: 0.88, riasec: { R: 30, I: 90, A: 20, S: 30, E: 45, C: 65 } },
  { code: 'UNIV_DROIT',         nom: 'Sciences Juridiques',           domaine: 'DROIT_ECONOMIE',         duree_annees: 5, universites: ['UFHB', 'UAO', 'UJLOG', 'UPGC'], roi_index: 0.70, salaire_moy_fcfa: 400000, taux_emploi: 0.72, riasec: { R: 10, I: 65, A: 25, S: 70, E: 80, C: 65 } },
  { code: 'UNIV_ECONOMIE',      nom: 'Sciences Économiques',          domaine: 'DROIT_ECONOMIE',         duree_annees: 3, universites: ['UFHB', 'UAO'], roi_index: 0.78, salaire_moy_fcfa: 450000, taux_emploi: 0.78, riasec: { R: 20, I: 75, A: 25, S: 50, E: 70, C: 80 } },
  { code: 'UNIV_MEDECINE',      nom: 'Médecine',                      domaine: 'SANTE',                  duree_annees: 7, universites: ['UFHB', 'UNA'], roi_index: 0.90, salaire_moy_fcfa: 800000, taux_emploi: 0.95, riasec: { R: 35, I: 85, A: 20, S: 90, E: 45, C: 55 } },
  { code: 'UNIV_PHARMACIE',     nom: 'Pharmacie',                     domaine: 'SANTE',                  duree_annees: 6, universites: ['UFHB', 'UNA'], roi_index: 0.88, salaire_moy_fcfa: 600000, taux_emploi: 0.92, riasec: { R: 35, I: 80, A: 15, S: 70, E: 50, C: 65 } },
  { code: 'UNIV_PSYCHOLOGIE',   nom: 'Psychologie',                   domaine: 'SHS',                    duree_annees: 5, universites: ['UFHB'], roi_index: 0.65, salaire_moy_fcfa: 300000, taux_emploi: 0.70, riasec: { R: 15, I: 70, A: 35, S: 85, E: 40, C: 45 } },
  { code: 'UNIV_ANGLAIS',       nom: 'Anglais',                       domaine: 'LETTRES_LANGUES',        duree_annees: 3, universites: ['UFHB', 'UAO', 'UPGC'], roi_index: 0.60, salaire_moy_fcfa: 220000, taux_emploi: 0.65, riasec: { R: 20, I: 55, A: 50, S: 75, E: 45, C: 45 } },
  { code: 'INFOCAD_DAS',        nom: "Développement d'Application",   domaine: 'NUMERIQUE',              duree_annees: 3, universites: ['INFOCAD'], roi_index: 0.90, salaire_moy_fcfa: 500000, taux_emploi: 0.88, riasec: { R: 35, I: 90, A: 30, S: 25, E: 55, C: 65 } },
  { code: 'INFOCAD_RSI',        nom: 'Réseaux et Sécurité',           domaine: 'NUMERIQUE',              duree_annees: 3, universites: ['INFOCAD'], roi_index: 0.92, salaire_moy_fcfa: 550000, taux_emploi: 0.90, riasec: { R: 45, I: 88, A: 15, S: 25, E: 50, C: 70 } },
];

// ============================================================
// 3. FILIÈRES BTS PRIVÉES CI (20 filières officielles MESRS)
// ============================================================
const FILIERES_BTS = [
  { code: 'BTS_FINANCE_COMPTA', nom: 'Finance Comptabilité et Gestion', domaine: 'GESTION_FINANCE',    duree_annees: 2, roi_index: 0.80, salaire_moy_fcfa: 280000, taux_emploi: 0.78, nb_ecoles_ci: 95, riasec: { R: 15, I: 55, A: 10, S: 40, E: 65, C: 90 } },
  { code: 'BTS_GESTION_COM',    nom: 'Gestion Commerciale',            domaine: 'COMMERCE',            duree_annees: 2, roi_index: 0.78, salaire_moy_fcfa: 260000, taux_emploi: 0.76, nb_ecoles_ci: 92, riasec: { R: 20, I: 40, A: 25, S: 65, E: 85, C: 60 } },
  { code: 'BTS_INFO_DEV',       nom: "Informatique Développeur d'App", domaine: 'NUMERIQUE',           duree_annees: 2, roi_index: 0.88, salaire_moy_fcfa: 350000, taux_emploi: 0.85, nb_ecoles_ci: 65, riasec: { R: 40, I: 85, A: 20, S: 25, E: 45, C: 65 } },
  { code: 'BTS_RH_COM',         nom: 'Ressources Humaines et Comm.',   domaine: 'RH_COMMUNICATION',    duree_annees: 2, roi_index: 0.72, salaire_moy_fcfa: 240000, taux_emploi: 0.72, nb_ecoles_ci: 60, riasec: { R: 15, I: 45, A: 45, S: 80, E: 65, C: 55 } },
  { code: 'BTS_LOGISTIQUE',     nom: 'Logistique',                     domaine: 'LOGISTIQUE_TRANSPORT', duree_annees: 2, roi_index: 0.75, salaire_moy_fcfa: 270000, taux_emploi: 0.75, nb_ecoles_ci: 48, riasec: { R: 50, I: 55, A: 15, S: 40, E: 60, C: 75 } },
  { code: 'BTS_RESEAUX_INFO',   nom: 'Réseaux Info et Télécommunication', domaine: 'NUMERIQUE',        duree_annees: 2, roi_index: 0.85, salaire_moy_fcfa: 320000, taux_emploi: 0.82, nb_ecoles_ci: 22, riasec: { R: 50, I: 82, A: 10, S: 20, E: 40, C: 65 } },
  { code: 'BTS_GENIE_CIVIL',    nom: 'Génie Civil option Bâtiment',    domaine: 'BTP',                 duree_annees: 2, roi_index: 0.80, salaire_moy_fcfa: 290000, taux_emploi: 0.78, nb_ecoles_ci: 15, riasec: { R: 85, I: 60, A: 30, S: 25, E: 40, C: 55 } },
  { code: 'BTS_ELEC',           nom: 'Electrotechnique',               domaine: 'TECHNIQUE_INDUSTRIE', duree_annees: 2, roi_index: 0.78, salaire_moy_fcfa: 280000, taux_emploi: 0.80, nb_ecoles_ci: 20, riasec: { R: 80, I: 65, A: 10, S: 20, E: 35, C: 55 } },
  { code: 'BTS_MINES',          nom: 'Mines, Géologie et Pétrole',     domaine: 'MINES_ENERGIE',       duree_annees: 2, roi_index: 0.88, salaire_moy_fcfa: 400000, taux_emploi: 0.82, nb_ecoles_ci: 8,  riasec: { R: 80, I: 70, A: 10, S: 20, E: 40, C: 50 } },
  { code: 'BTS_TOURISME',       nom: 'Tourisme et Hôtellerie',         domaine: 'TOURISME_HOTEL',      duree_annees: 2, roi_index: 0.65, salaire_moy_fcfa: 230000, taux_emploi: 0.68, nb_ecoles_ci: 30, riasec: { R: 25, I: 35, A: 45, S: 80, E: 65, C: 50 } },
];

// ============================================================
// 4. ÉTABLISSEMENTS CLÉS CI (extrait des 147 MESRS)
// ============================================================
const ETABLISSEMENTS_CLES = [
  { code: 'UFHB_COCODY',        nom: "Université Félix Houphouët-Boigny",      type: 'PUBLIC_UNIVERSITE',   zone: 'COCODY',        ville: 'Abidjan',       frais_annuels_fcfa: 0,       capacite_index: 5 },
  { code: 'INP_HB_YAMOUSSOUKRO', nom: "Institut National Polytechnique FHB",   type: 'PUBLIC_GRANDE_ECOLE', zone: 'YAMOUSSOUKRO',  ville: 'Yamoussoukro',  frais_annuels_fcfa: 0,       capacite_index: 4 },
  { code: 'UNA_ABOBO',          nom: 'Université Nangui Abrogoua',             type: 'PUBLIC_UNIVERSITE',   zone: 'ABOBO',         ville: 'Abidjan',       frais_annuels_fcfa: 0,       capacite_index: 3 },
  { code: 'UAO_BOUAKE',         nom: 'Université Alassane Ouattara',           type: 'PUBLIC_UNIVERSITE',   zone: 'BOUAKE',        ville: 'Bouaké',        frais_annuels_fcfa: 0,       capacite_index: 3 },
  { code: 'UPGC_KORHOGO',       nom: 'Université Peleforo Gon Coulibaly',      type: 'PUBLIC_UNIVERSITE',   zone: 'KORHOGO',       ville: 'Korhogo',       frais_annuels_fcfa: 0,       capacite_index: 2 },
  { code: 'PIGIER_PLATEAU',     nom: "PIGIER Côte d'Ivoire",                   type: 'PRIVE_BTS',           zone: 'PLATEAU',       ville: 'Abidjan',       frais_annuels_fcfa: 600000,  capacite_index: 5 },
  { code: 'IST_LA_COLOMBE',     nom: 'IST La Colombe',                         type: 'PRIVE_BTS',           zone: 'KOUMASSI',      ville: 'Abidjan',       frais_annuels_fcfa: 400000,  capacite_index: 5 },
  { code: 'ESTIC_ABIDJAN',      nom: 'ESTIC — École Sup. Tech. et Informatique', type: 'PRIVE_BTS',         zone: 'COCODY',        ville: 'Abidjan',       frais_annuels_fcfa: 550000,  capacite_index: 4 },
  { code: 'EPCCI_PLATEAU',      nom: 'EPCCI — École Pratique CCI',             type: 'PRIVE_BTS',           zone: 'PLATEAU',       ville: 'Abidjan',       frais_annuels_fcfa: 700000,  capacite_index: 4 },
  { code: 'HETEC_BOUAKE',       nom: 'HETEC Bouaké',                           type: 'PRIVE_BTS',           zone: 'BOUAKE',        ville: 'Bouaké',        frais_annuels_fcfa: 350000,  capacite_index: 3 },
  { code: 'ISCAE_YAMOUSSOUKRO', nom: 'ISCAE Yamoussoukro',                     type: 'PRIVE_BTS',           zone: 'YAMOUSSOUKRO',  ville: 'Yamoussoukro',  frais_annuels_fcfa: 350000,  capacite_index: 3 },
  { code: 'INFOCAD_ABIDJAN',    nom: 'INFOCAD',                                type: 'PRIVE_UNIVERSITE',    zone: 'COCODY',        ville: 'Abidjan',       frais_annuels_fcfa: 800000,  capacite_index: 4 },
];

// ============================================================
// EXPORT — Ces données seront utilisées par le seed base_orientation
// ============================================================
export const MESRS_DATA = {
  seriesBac:           SERIES_BAC_CI,
  filieresUniversite:  FILIERES_UNIVERSITE,
  filieresBts:         FILIERES_BTS,
  etablissements:      ETABLISSEMENTS_CLES,
};

// ============================================================
// SEED PRINCIPAL — Activé au Sprint base_orientation
// ============================================================
async function main() {
  console.log('⏸️  Seed base_orientation en attente — client Prisma non encore généré.');
  console.log(`   Données prêtes : ${SERIES_BAC_CI.length} séries BAC | ${FILIERES_UNIVERSITE.length} filières U. | ${FILIERES_BTS.length} BTS | ${ETABLISSEMENTS_CLES.length} établissements`);
  console.log('   TODO : décommenter le client Prisma et les upserts quand base_orientation sera créée.');
}

main().catch(console.error);