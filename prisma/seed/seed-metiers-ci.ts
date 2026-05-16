// =============================================================================
// YIRA V3.0 — Seed Métiers Avenir CI 2030-2040
// 50 métiers porteurs en Côte d'Ivoire avec données réelles
// Sources : AGEPE, BAD, BM, ARTCI, MINEF, DARES-CI
// =============================================================================
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_ORIENTATION });

interface Metier {
  code: string; nom: string; secteur: string; description: string;
  riasec_codes: string[]; filieres_entree: string[];
  formations_ci: string[]; salaire_min: number; salaire_max: number;
  salaire_median: number; demande_2030: number; demande_label: string;
  acteurs_ci: string[]; competences: string[];
}

const METIERS: Metier[] = [
  // ── TECH & NUMÉRIQUE ──────────────────────────────────────────────────────
  {
    code: 'DEV_WEB_MOBILE', nom: 'Développeur Web/Mobile', secteur: 'TECH',
    description: 'Conçoit des applications web et mobiles pour entreprises et startups',
    riasec_codes: ['I', 'R', 'A'], filieres_entree: ['SEC_C', 'SEC_D', 'BAC_C', 'BAC_D'],
    formations_ci: ['BTS_INFORMATIQUE_INPHB', 'LICENCE_INFO_FHB', 'IUT_ABIDJAN'],
    salaire_min: 200000, salaire_max: 1500000, salaire_median: 450000,
    demande_2030: 580, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Orange CI', 'MTN CI', 'Wave', 'CIDigital', 'Startups Abidjan'],
    competences: ['JavaScript', 'React', 'Flutter', 'Node.js', 'SQL'],
  },
  {
    code: 'DATA_SCIENTIST', nom: 'Data Scientist / Analyste Data', secteur: 'TECH',
    description: 'Analyse les données massives pour aider à la prise de décision',
    riasec_codes: ['I', 'C', 'R'], filieres_entree: ['SEC_C', 'BAC_C', 'BAC_D'],
    formations_ci: ['MASTER_STATS_FHB', 'ENSEA_ABIDJAN', 'MASTER_INFO_INPHB'],
    salaire_min: 350000, salaire_max: 2000000, salaire_median: 700000,
    demande_2030: 650, demande_label: 'TRES_FORTE_CROISSANCE',
    acteurs_ci: ['BCEAO', 'Ecobank', 'Orange CI', 'ARTCI', 'BAD'],
    competences: ['Python', 'R', 'Machine Learning', 'SQL', 'Tableau'],
  },
  {
    code: 'CYBERSECURITE', nom: 'Expert Cybersécurité', secteur: 'TECH',
    description: 'Protège les systèmes informatiques contre les cyberattaques',
    riasec_codes: ['I', 'R', 'C'], filieres_entree: ['SEC_C', 'BAC_C'],
    formations_ci: ['MASTER_SECURITE_INPHB', 'BTS_RESEAUX_IUT'],
    salaire_min: 400000, salaire_max: 2500000, salaire_median: 900000,
    demande_2030: 720, demande_label: 'TRES_FORTE_CROISSANCE',
    acteurs_ci: ['ARTCI', 'CI-CERT', 'Banques CI', 'Telcos', 'SGBCI'],
    competences: ['Ethical Hacking', 'Firewall', 'SIEM', 'ISO 27001'],
  },
  {
    code: 'INGENIEUR_IA', nom: 'Ingénieur Intelligence Artificielle', secteur: 'TECH',
    description: 'Développe des systèmes IA pour automatiser et optimiser',
    riasec_codes: ['I', 'R', 'A'], filieres_entree: ['SEC_C', 'BAC_C'],
    formations_ci: ['MASTER_IA_INPHB', 'MASTER_INFO_FHB'],
    salaire_min: 500000, salaire_max: 3000000, salaire_median: 1200000,
    demande_2030: 800, demande_label: 'TRES_FORTE_CROISSANCE',
    acteurs_ci: ['Orange CI', 'Wave', 'Startups IA', 'BAD', 'ONU'],
    competences: ['Python', 'TensorFlow', 'NLP', 'Computer Vision', 'MLOps'],
  },
  {
    code: 'CHEF_PROJET_DIGITAL', nom: 'Chef de Projet Digital', secteur: 'TECH',
    description: 'Pilote la transformation digitale des entreprises',
    riasec_codes: ['E', 'S', 'I'], filieres_entree: ['SEC_A', 'SEC_C', 'BAC_G'],
    formations_ci: ['MASTER_MANAGEMENT_DIGITAL', 'MBA_ESA', 'BTS_INFORMATIQUE'],
    salaire_min: 300000, salaire_max: 1800000, salaire_median: 650000,
    demande_2030: 450, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Multinationales CI', 'Telcos', 'Banques', 'ONG'],
    competences: ['Agile', 'Scrum', 'PMP', 'Gestion projet', 'Leadership'],
  },

  // ── SANTÉ ─────────────────────────────────────────────────────────────────
  {
    code: 'MEDECIN_GENERALISTE', nom: 'Médecin Généraliste', secteur: 'SANTE',
    description: 'Diagnostique et traite les maladies courantes',
    riasec_codes: ['I', 'S', 'R'], filieres_entree: ['SEC_D', 'BAC_D'],
    formations_ci: ['MEDECINE_FHB_7ANS', 'UFR_SCIENCES_MEDICALES'],
    salaire_min: 400000, salaire_max: 3000000, salaire_median: 800000,
    demande_2030: 420, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['CHU Abidjan', 'Cliniques privées', 'MSF', 'OMS', 'Ministère Santé'],
    competences: ['Diagnostic', 'Pharmacologie', 'Urgences', 'Pédiatrie'],
  },
  {
    code: 'INFIRMIER_SPECIALISE', nom: 'Infirmier Spécialisé', secteur: 'SANTE',
    description: 'Soins infirmiers spécialisés en réanimation, pédiatrie ou bloc opératoire',
    riasec_codes: ['S', 'R', 'I'], filieres_entree: ['SEC_D', 'BAC_D', 'BAC_C'],
    formations_ci: ['INFAS_3ANS', 'BTS_SANTE_ABIDJAN'],
    salaire_min: 150000, salaire_max: 600000, salaire_median: 280000,
    demande_2030: 380, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['CHU', 'Cliniques', 'Dispensaires', 'ONG Santé', 'UNICEF'],
    competences: ['Soins infirmiers', 'Urgences', 'Pharmacie', 'Pédiatrie'],
  },
  {
    code: 'PHARMACIEN', nom: 'Pharmacien', secteur: 'SANTE',
    description: 'Dispense les médicaments et conseille sur leur usage',
    riasec_codes: ['I', 'S', 'C'], filieres_entree: ['SEC_D', 'BAC_D'],
    formations_ci: ['PHARMACIE_FHB_6ANS', 'UFR_PHARMA_ABIDJAN'],
    salaire_min: 300000, salaire_max: 2000000, salaire_median: 600000,
    demande_2030: 340, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Pharmacies privées', 'PSP', 'Industrie pharma', 'OMS'],
    competences: ['Pharmacologie', 'Biochimie', 'Gestion stock', 'Conseil patient'],
  },
  {
    code: 'NUTRITIONNISTE', nom: 'Nutritionniste-Diététicien', secteur: 'SANTE',
    description: 'Élabore des régimes alimentaires adaptés aux besoins de santé',
    riasec_codes: ['S', 'I', 'A'], filieres_entree: ['SEC_D', 'BAC_D'],
    formations_ci: ['BTS_DIETETIQUE_ISA', 'LICENCE_NUTRITION_FHB'],
    salaire_min: 200000, salaire_max: 800000, salaire_median: 350000,
    demande_2030: 380, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Hôtels 5*', 'Cliniques', 'Sportifs pro', 'Entreprises agroalim'],
    competences: ['Nutrition clinique', 'Diététique sportive', 'Micronutrition'],
  },
  {
    code: 'BIOLOGISTE_MEDICAL', nom: 'Biologiste Médical', secteur: 'SANTE',
    description: 'Analyse les prélèvements biologiques pour le diagnostic médical',
    riasec_codes: ['I', 'R', 'C'], filieres_entree: ['SEC_D', 'BAC_D'],
    formations_ci: ['BTS_ANALYSES_BIOLOGIQUES_INPHB', 'LICENCE_BIOLOGIE_FHB'],
    salaire_min: 250000, salaire_max: 1200000, salaire_median: 500000,
    demande_2030: 360, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Laboratoires CHU', 'Biolab', 'Pasteur CI', 'Cliniques privées'],
    competences: ['Hématologie', 'Biochimie', 'Microbiologie', 'PCR', 'ELISA'],
  },

  // ── FINANCE & BANQUE ──────────────────────────────────────────────────────
  {
    code: 'ANALYSTE_FINANCIER', nom: 'Analyste Financier', secteur: 'FINANCE',
    description: 'Évalue la santé financière des entreprises et conseille les investisseurs',
    riasec_codes: ['C', 'I', 'E'], filieres_entree: ['SEC_A', 'SEC_C', 'BAC_G'],
    formations_ci: ['MASTER_FINANCE_FHB', 'ESA_ABIDJAN', 'CESAG_DAKAR'],
    salaire_min: 350000, salaire_max: 2500000, salaire_median: 800000,
    demande_2030: 420, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Ecobank', 'SGBCI', 'BNI', 'SIB', 'NSIA Banque', 'BCEAO'],
    competences: ['Excel avancé', 'Bloomberg', 'Analyse financière', 'Modélisation'],
  },
  {
    code: 'FINTECH_EXPERT', nom: 'Expert FinTech / Mobile Money', secteur: 'FINANCE',
    description: 'Développe et gère les services financiers mobiles',
    riasec_codes: ['I', 'E', 'C'], filieres_entree: ['SEC_C', 'SEC_A', 'BAC_G'],
    formations_ci: ['MASTER_FINANCE_DIGITAL', 'MASTER_INFO_FHB', 'MBA_ESA'],
    salaire_min: 400000, salaire_max: 2000000, salaire_median: 750000,
    demande_2030: 680, demande_label: 'TRES_FORTE_CROISSANCE',
    acteurs_ci: ['Wave', 'Orange Money', 'MTN MoMo', 'NSIA', 'Startups FinTech'],
    competences: ['API Banking', 'Réglementation BCEAO', 'UX Finance', 'KYC/AML'],
  },
  {
    code: 'ACTUAIRE', nom: 'Actuaire Assurance', secteur: 'FINANCE',
    description: 'Calcule les risques et tarifs dans le secteur des assurances',
    riasec_codes: ['I', 'C', 'R'], filieres_entree: ['SEC_C', 'BAC_C'],
    formations_ci: ['MASTER_ACTUARIAT_FHB', 'ENSEA_ABIDJAN'],
    salaire_min: 500000, salaire_max: 3000000, salaire_median: 1100000,
    demande_2030: 350, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['NSIA Assurances', 'Sunu Assurances', 'Allianz CI', 'CICA-RE'],
    competences: ['Mathématiques actuarielles', 'R', 'Python', 'Modélisation risque'],
  },

  // ── AGRICULTURE & AGROALIMENTAIRE ────────────────────────────────────────
  {
    code: 'INGENIEUR_AGRONOME', nom: 'Ingénieur Agronome', secteur: 'AGRICULTURE',
    description: 'Améliore les techniques de production agricole',
    riasec_codes: ['R', 'I', 'S'], filieres_entree: ['SEC_D', 'BAC_D'],
    formations_ci: ['INGENIEUR_AGRO_INP_HB', 'LICENCE_AGRO_ABOBO_ADJAME'],
    salaire_min: 250000, salaire_max: 1500000, salaire_median: 500000,
    demande_2030: 460, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['SIFCA', 'OLAM CI', 'Cargill', 'ANADER', 'Ministère Agriculture'],
    competences: ['Agronomie tropicale', 'SIG agricole', 'Agro-écologie', 'Cacao'],
  },
  {
    code: 'TECH_AGRI_DIGITAL', nom: 'Technicien Agriculture Digitale', secteur: 'AGRICULTURE',
    description: 'Utilise les drones, capteurs IoT et IA pour optimiser les cultures',
    riasec_codes: ['R', 'I', 'C'], filieres_entree: ['SEC_D', 'SEC_C', 'BAC_D'],
    formations_ci: ['BTS_AGRO_INPHB', 'LICENCE_AGRO_DIGITAL'],
    salaire_min: 200000, salaire_max: 900000, salaire_median: 380000,
    demande_2030: 520, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['OLAM', 'Nestlé CI', 'AgriTech startups', 'FAO', 'IFAD'],
    competences: ['Drones agricoles', 'IoT', 'SIG', 'Phytotechnie', 'Data agricole'],
  },
  {
    code: 'INGENIEUR_AGROALIM', nom: 'Ingénieur Agroalimentaire', secteur: 'AGRICULTURE',
    description: 'Développe et contrôle la qualité des produits alimentaires',
    riasec_codes: ['R', 'I', 'C'], filieres_entree: ['SEC_D', 'BAC_D'],
    formations_ci: ['INGENIEUR_AGROALIM_INPHB', 'BTS_AGROALIM_ABIDJAN'],
    salaire_min: 280000, salaire_max: 1800000, salaire_median: 600000,
    demande_2030: 480, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['SIFCA', 'NESTLE CI', 'SOLIBRA', 'PALM CI', 'UNILEVER CI'],
    competences: ['HACCP', 'ISO 22000', 'Technologie alimentaire', 'Contrôle qualité'],
  },

  // ── BTP & GÉNIE CIVIL ────────────────────────────────────────────────────
  {
    code: 'INGENIEUR_GENIE_CIVIL', nom: 'Ingénieur Génie Civil', secteur: 'BTP',
    description: 'Conçoit et supervise les travaux de construction et infrastructure',
    riasec_codes: ['R', 'I', 'C'], filieres_entree: ['SEC_C', 'BAC_C'],
    formations_ci: ['INGENIEUR_GC_INPHB', 'ESTP_ABIDJAN', 'IUT_GC'],
    salaire_min: 300000, salaire_max: 2500000, salaire_median: 700000,
    demande_2030: 520, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Bouygues CI', 'COLAS CI', 'BNETD', 'Ageroute', 'FER'],
    competences: ['AutoCAD', 'BIM', 'Béton armé', 'Gestion chantier', 'Topographie'],
  },
  {
    code: 'ARCHITECTE', nom: 'Architecte', secteur: 'BTP',
    description: 'Conçoit des bâtiments alliant esthétique, fonctionnalité et durabilité',
    riasec_codes: ['A', 'R', 'I'], filieres_entree: ['SEC_A', 'SEC_C', 'BAC_C'],
    formations_ci: ['ARCHITECTURE_FHB_5ANS', 'ESACF_ABIDJAN'],
    salaire_min: 250000, salaire_max: 2000000, salaire_median: 600000,
    demande_2030: 380, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Cabinets archi Abidjan', 'Immobilières', 'BNETD', 'Promoteurs'],
    competences: ['ArchiCAD', 'Revit', 'SketchUp', 'Urbanisme', 'Développement durable'],
  },
  {
    code: 'INGENIEUR_ELECTRIQUE', nom: 'Ingénieur Électrique / Énergies', secteur: 'BTP',
    description: 'Conçoit les installations électriques et systèmes énergétiques',
    riasec_codes: ['R', 'I', 'C'], filieres_entree: ['SEC_C', 'BAC_C'],
    formations_ci: ['INGENIEUR_ELEC_INPHB', 'BTS_ELECTROTECHNIQUE_IUT'],
    salaire_min: 280000, salaire_max: 2000000, salaire_median: 650000,
    demande_2030: 490, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['CIE', 'SODEMI', 'ANARE-CI', 'Bouygues Energies', 'Engie Africa'],
    competences: ['Électrotechnique', 'Solaire PV', 'AutoCAD Élec', 'HTA/BT', 'SCADA'],
  },

  // ── ENVIRONNEMENT & ÉNERGIE ───────────────────────────────────────────────
  {
    code: 'INGENIEUR_ENERGIE_SOLAIRE', nom: 'Ingénieur Énergie Solaire', secteur: 'ENVIRONNEMENT',
    description: 'Conçoit et installe des systèmes d énergie solaire photovoltaïque',
    riasec_codes: ['R', 'I', 'E'], filieres_entree: ['SEC_C', 'BAC_C'],
    formations_ci: ['MASTER_ENERGIES_RENOUVELABLES_FHB', 'BTS_MAINTENANCE_INPHB'],
    salaire_min: 300000, salaire_max: 1800000, salaire_median: 650000,
    demande_2030: 680, demande_label: 'TRES_FORTE_CROISSANCE',
    acteurs_ci: ['ANARE-CI', 'Engie Africa', 'Zola Electric', 'BNETD', 'BM Projets'],
    competences: ['Dimensionnement PV', 'Batteries', 'Onduleurs', 'AutoCAD', 'HOMER'],
  },
  {
    code: 'EXPERT_ENVIRONNEMENT', nom: 'Expert Environnement / RSE', secteur: 'ENVIRONNEMENT',
    description: 'Évalue et minimise l impact environnemental des projets',
    riasec_codes: ['I', 'S', 'R'], filieres_entree: ['SEC_D', 'BAC_D'],
    formations_ci: ['MASTER_ENVIRONNEMENT_FHB', 'LICENCE_GEO_ABIDJAN'],
    salaire_min: 250000, salaire_max: 1500000, salaire_median: 550000,
    demande_2030: 420, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Multinationales CI', 'BAD', 'BM', 'ONG Environnement', 'BNETD'],
    competences: ['EIE', 'ISO 14001', 'GIS/SIG', 'Carbon footprint', 'Reporting RSE'],
  },

  // ── COMMERCE & MARKETING ──────────────────────────────────────────────────
  {
    code: 'MANAGER_MARKETING_DIGITAL', nom: 'Manager Marketing Digital', secteur: 'COMMERCE',
    description: 'Pilote la stratégie digitale et les campagnes marketing en ligne',
    riasec_codes: ['E', 'A', 'S'], filieres_entree: ['SEC_A', 'BAC_G', 'SEC_C'],
    formations_ci: ['MASTER_MARKETING_DIGITAL_ESA', 'BTS_COMMERCE_IUT', 'MBA_ESCA'],
    salaire_min: 250000, salaire_max: 1500000, salaire_median: 550000,
    demande_2030: 480, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Agences digitales Abidjan', 'FMCG CI', 'Telcos', 'E-commerce CI'],
    competences: ['SEO/SEA', 'Social Media', 'Google Analytics', 'CRM', 'Content Marketing'],
  },
  {
    code: 'RESPONSABLE_LOGISTIQUE', nom: 'Responsable Logistique / Supply Chain', secteur: 'COMMERCE',
    description: 'Optimise la chaîne d approvisionnement et la distribution',
    riasec_codes: ['C', 'E', 'R'], filieres_entree: ['SEC_A', 'SEC_C', 'BAC_G'],
    formations_ci: ['BTS_TRANSPORT_LOGISTIQUE', 'MASTER_SCM_ESA', 'IUT_LOGISTIQUE'],
    salaire_min: 280000, salaire_max: 1800000, salaire_median: 600000,
    demande_2030: 440, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Port d Abidjan', 'SITARAIL', 'DHL CI', 'BOLLORÉ', 'SDV SÉNÉGAL'],
    competences: ['SAP', 'Gestion stock', 'Transport multimodal', 'Douanes', 'ERP'],
  },

  // ── ÉDUCATION & FORMATION ─────────────────────────────────────────────────
  {
    code: 'FORMATEUR_DIGITAL', nom: 'Formateur / EdTech Specialist', secteur: 'EDUCATION',
    description: 'Crée et dispense des formations digitales et e-learning',
    riasec_codes: ['S', 'A', 'I'], filieres_entree: ['SEC_A', 'SEC_C', 'BAC_L'],
    formations_ci: ['MASTER_SCIENCES_EDUCATION_FHB', 'CAFOP_ABIDJAN', 'BTS_MULTIMEDIA'],
    salaire_min: 200000, salaire_max: 1000000, salaire_median: 380000,
    demande_2030: 380, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['ONFP', 'Startups EdTech CI', 'ONG Formation', 'UNESCO', 'UNICEF'],
    competences: ['Moodle', 'Pédagogie digitale', 'Conception curriculum', 'LMS'],
  },
  {
    code: 'PSYCHOLOGUE_SCOLAIRE', nom: 'Psychologue Scolaire', secteur: 'EDUCATION',
    description: 'Accompagne les élèves dans leur développement psychologique et scolaire',
    riasec_codes: ['S', 'I', 'A'], filieres_entree: ['SEC_A', 'BAC_L'],
    formations_ci: ['MASTER_PSYCHO_FHB', 'LICENCE_PSYCHO_ABIDJAN'],
    salaire_min: 200000, salaire_max: 900000, salaire_median: 350000,
    demande_2030: 320, demande_label: 'CROISSANCE_MODEREE',
    acteurs_ci: ['Lycées privés', 'Ministère Education', 'ONG', 'Cliniques psych'],
    competences: ['Psychologie cognitive', 'Tests psychométriques', 'Counseling', 'TCC'],
  },

  // ── DROIT & JURIDIQUE ─────────────────────────────────────────────────────
  {
    code: 'JURISTE_AFFAIRES', nom: 'Juriste d Affaires', secteur: 'DROIT',
    description: 'Conseille les entreprises sur les aspects juridiques et contractuels',
    riasec_codes: ['E', 'C', 'S'], filieres_entree: ['SEC_A', 'BAC_L'],
    formations_ci: ['MASTER_DROIT_AFFAIRES_FHB', 'FASSO_ABIDJAN'],
    salaire_min: 300000, salaire_max: 2000000, salaire_median: 700000,
    demande_2030: 380, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Cabinets avocats Abidjan', 'Multinationales', 'OHADA', 'CCIAD'],
    competences: ['Droit OHADA', 'Contrats', 'Droit fiscal', 'Arbitrage', 'Compliance'],
  },
  {
    code: 'EXPERT_COMPLIANCE', nom: 'Expert Compliance / AML', secteur: 'DROIT',
    description: 'Assure la conformité réglementaire des institutions financières',
    riasec_codes: ['C', 'I', 'E'], filieres_entree: ['SEC_A', 'BAC_G'],
    formations_ci: ['MASTER_FINANCE_DROIT_FHB', 'MASTER_COMPLIANCE_ESA'],
    salaire_min: 400000, salaire_max: 2500000, salaire_median: 900000,
    demande_2030: 450, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Banques CI', 'BCEAO', 'Assurances', 'Telcos', 'CENTIF-CI'],
    competences: ['LCB-FT', 'KYC', 'FATF', 'Réglementation BCEAO', 'Due diligence'],
  },

  // ── COMMUNICATION & MÉDIAS ────────────────────────────────────────────────
  {
    code: 'JOURNALISTE_MULTIMEDIA', nom: 'Journaliste Multimédia / Créateur Contenu', secteur: 'MEDIAS',
    description: 'Produit du contenu journalistique sur tous les supports digitaux',
    riasec_codes: ['A', 'E', 'S'], filieres_entree: ['SEC_A', 'BAC_L', 'BAC_G'],
    formations_ci: ['ISTC_ABIDJAN', 'MASTER_COMM_FHB', 'BTS_COMMUNICATION'],
    salaire_min: 150000, salaire_max: 1000000, salaire_median: 300000,
    demande_2030: 340, demande_label: 'CROISSANCE_MODEREE',
    acteurs_ci: ['RTI', 'AIP', 'Medias privés CI', 'RFI Abidjan', 'Fraternité Matin'],
    competences: ['Rédaction web', 'Vidéo', 'Réseaux sociaux', 'SEO', 'Podcast'],
  },
  {
    code: 'DESIGNER_UI_UX', nom: 'Designer UI/UX', secteur: 'MEDIAS',
    description: 'Conçoit des interfaces utilisateur intuitives et esthétiques',
    riasec_codes: ['A', 'I', 'R'], filieres_entree: ['SEC_A', 'SEC_C', 'BAC_L'],
    formations_ci: ['BTS_MULTIMEDIA_IUT', 'LICENCE_DESIGN_ABIDJAN', 'ESAG_ABIDJAN'],
    salaire_min: 200000, salaire_max: 1500000, salaire_median: 450000,
    demande_2030: 520, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Agences créatives CI', 'Startups Tech', 'E-commerce', 'Telcos'],
    competences: ['Figma', 'Adobe XD', 'Prototypage', 'Design thinking', 'CSS'],
  },

  // ── TOURISME & HÔTELLERIE ─────────────────────────────────────────────────
  {
    code: 'MANAGER_HOTELLERIE', nom: 'Manager Hôtellerie / Tourisme', secteur: 'TOURISME',
    description: 'Gère les établissements hôteliers et développe le tourisme',
    riasec_codes: ['E', 'S', 'A'], filieres_entree: ['SEC_A', 'BAC_G'],
    formations_ci: ['BTS_HOTELLERIE_RESTAURATION', 'MASTER_TOURISME_FHB', 'EHTC_ABIDJAN'],
    salaire_min: 200000, salaire_max: 1500000, salaire_median: 450000,
    demande_2030: 360, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Sofitel Abidjan', 'Pullman', 'Radisson', 'ONTT CI', 'Azalaï'],
    competences: ['Revenue management', 'Gestion hôtelière', 'Langues', 'Service client'],
  },

  // ── TRANSPORT & MOBILITÉ ──────────────────────────────────────────────────
  {
    code: 'INGENIEUR_TRANSPORT', nom: 'Ingénieur Transport / Mobilité Urbaine', secteur: 'TRANSPORT',
    description: 'Planifie et optimise les systèmes de transport urbain',
    riasec_codes: ['R', 'I', 'E'], filieres_entree: ['SEC_C', 'BAC_C'],
    formations_ci: ['MASTER_TRANSPORT_INPHB', 'INGENIEUR_GC_ROUTES'],
    salaire_min: 350000, salaire_max: 2000000, salaire_median: 700000,
    demande_2030: 420, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Sotra', 'Ageroute', 'FER', 'BNETD', 'Métro Abidjan'],
    competences: ['Modélisation trafic', 'SIG transport', 'Planification urbaine', 'VISSIM'],
  },

  // ── RESSOURCES HUMAINES ───────────────────────────────────────────────────
  {
    code: 'DRH_DIGITAL', nom: 'DRH / Responsable RH Digital', secteur: 'RH',
    description: 'Gère les ressources humaines en intégrant les outils digitaux',
    riasec_codes: ['S', 'E', 'C'], filieres_entree: ['SEC_A', 'BAC_G'],
    formations_ci: ['MASTER_RH_ESA', 'LICENCE_RH_FHB', 'MBA_GRH_ABIDJAN'],
    salaire_min: 300000, salaire_max: 1800000, salaire_median: 650000,
    demande_2030: 380, demande_label: 'FORTE_CROISSANCE',
    acteurs_ci: ['Multinationales CI', 'Groupes bancaires', 'Agro-industries', 'ONG'],
    competences: ['SIRH', 'Droit social OHADA', 'Recrutement digital', 'Formation', 'GPEC'],
  },
];

const FORMATIONS: any[] = [
  // INPHB Yamoussoukro
  { code: 'INGENIEUR_INFO_INPHB', nom: 'Ingénieur Informatique', etablissement: 'INPHB', ville: 'Yamoussoukro', type: 'PUBLIC', niveau_entree: 'BAC_C', duree_ans: 5, cout_annuel: 350000, filieres_bac: ['BAC_C', 'BAC_D'], metiers_cibles: ['DEV_WEB_MOBILE', 'DATA_SCIENTIST', 'INGENIEUR_IA'] },
  { code: 'INGENIEUR_GC_INPHB', nom: 'Ingénieur Génie Civil', etablissement: 'INPHB', ville: 'Yamoussoukro', type: 'PUBLIC', niveau_entree: 'BAC_C', duree_ans: 5, cout_annuel: 350000, filieres_bac: ['BAC_C'], metiers_cibles: ['INGENIEUR_GENIE_CIVIL', 'INGENIEUR_TRANSPORT'] },
  { code: 'INGENIEUR_AGRO_INPHB', nom: 'Ingénieur Agronome', etablissement: 'INPHB', ville: 'Yamoussoukro', type: 'PUBLIC', niveau_entree: 'BAC_D', duree_ans: 5, cout_annuel: 300000, filieres_bac: ['BAC_D'], metiers_cibles: ['INGENIEUR_AGRONOME', 'INGENIEUR_AGROALIM'] },
  // Université FHB
  { code: 'MEDECINE_FHB', nom: 'Doctorat en Médecine', etablissement: 'UFR Sciences Médicales - FHB', ville: 'Abidjan', type: 'PUBLIC', niveau_entree: 'BAC_D', duree_ans: 7, cout_annuel: 180000, filieres_bac: ['BAC_D'], metiers_cibles: ['MEDECIN_GENERALISTE'] },
  { code: 'PHARMACIE_FHB', nom: 'Doctorat en Pharmacie', etablissement: 'UFR Pharmacie - FHB', ville: 'Abidjan', type: 'PUBLIC', niveau_entree: 'BAC_D', duree_ans: 6, cout_annuel: 180000, filieres_bac: ['BAC_D'], metiers_cibles: ['PHARMACIEN'] },
  { code: 'MASTER_FINANCE_FHB', nom: 'Master Finance', etablissement: 'UFR SEG - FHB', ville: 'Abidjan', type: 'PUBLIC', niveau_entree: 'LICENCE', duree_ans: 2, cout_annuel: 200000, filieres_bac: ['BAC_G', 'BAC_C'], metiers_cibles: ['ANALYSTE_FINANCIER', 'ACTUAIRE'] },
  { code: 'ARCHITECTURE_FHB', nom: 'Diplôme Architecte', etablissement: 'UFR Architecture - FHB', ville: 'Abidjan', type: 'PUBLIC', niveau_entree: 'BAC_C', duree_ans: 5, cout_annuel: 200000, filieres_bac: ['BAC_C', 'BAC_A'], metiers_cibles: ['ARCHITECTE'] },
  // Grandes Écoles privées
  { code: 'MBA_ESA', nom: 'MBA Management', etablissement: 'ESA Abidjan', ville: 'Abidjan', type: 'PRIVE', niveau_entree: 'LICENCE', duree_ans: 2, cout_annuel: 1800000, filieres_bac: ['BAC_G', 'BAC_C', 'BAC_A'], metiers_cibles: ['CHEF_PROJET_DIGITAL', 'MANAGER_MARKETING_DIGITAL', 'DRH_DIGITAL'] },
  { code: 'BTS_INFO_IUT', nom: 'BTS Informatique', etablissement: 'IUT Abidjan', ville: 'Abidjan', type: 'PUBLIC', niveau_entree: 'BAC_C', duree_ans: 2, cout_annuel: 250000, filieres_bac: ['BAC_C', 'BAC_D'], metiers_cibles: ['DEV_WEB_MOBILE', 'CYBERSECURITE'] },
  { code: 'INFAS_INFIRMIER', nom: 'Diplôme Infirmier d État', etablissement: 'INFAS', ville: 'Abidjan', type: 'PUBLIC', niveau_entree: 'BAC_D', duree_ans: 3, cout_annuel: 150000, filieres_bac: ['BAC_D', 'BAC_C'], metiers_cibles: ['INFIRMIER_SPECIALISE'] },
  { code: 'ISTC_JOURNALISME', nom: 'Licence Journalisme', etablissement: 'ISTC Abidjan', ville: 'Abidjan', type: 'PUBLIC', niveau_entree: 'BAC', duree_ans: 3, cout_annuel: 300000, filieres_bac: ['BAC_A', 'BAC_L', 'BAC_G'], metiers_cibles: ['JOURNALISTE_MULTIMEDIA'] },
  { code: 'ESTP_BTP', nom: 'BTS Génie Civil', etablissement: 'ESTP Abidjan', ville: 'Abidjan', type: 'PRIVE', niveau_entree: 'BAC_C', duree_ans: 2, cout_annuel: 800000, filieres_bac: ['BAC_C'], metiers_cibles: ['INGENIEUR_GENIE_CIVIL'] },
];

async function seedMetiers() {
  console.log('Seed Métiers Avenir CI — Démarrage...');

  for (const m of METIERS) {
    await pool.query(`
      INSERT INTO yira_metier_avenir (
        code, nom, secteur, description, riasec_codes, filieres_entree,
        formations_ci, salaire_min, salaire_max, salaire_median,
        demande_2030, demande_label, acteurs_ci, competences
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (code) DO UPDATE SET
        nom=EXCLUDED.nom, salaire_median=EXCLUDED.salaire_median,
        demande_2030=EXCLUDED.demande_2030
    `, [
      m.code, m.nom, m.secteur, m.description,
      m.riasec_codes, m.filieres_entree, m.formations_ci,
      m.salaire_min, m.salaire_max, m.salaire_median,
      m.demande_2030, m.demande_label, m.acteurs_ci, m.competences,
    ]);
  }
  console.log('OK ' + METIERS.length + ' métiers insérés');

  for (const f of FORMATIONS) {
    await pool.query(`
      INSERT INTO yira_formation_ci (
        code, nom, etablissement, ville, type, niveau_entree,
        duree_ans, cout_annuel, filieres_bac, metiers_cibles
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (code) DO NOTHING
    `, [
      f.code, f.nom, f.etablissement, f.ville, f.type,
      f.niveau_entree, f.duree_ans, f.cout_annuel,
      f.filieres_bac, f.metiers_cibles,
    ]);
  }
  console.log('OK ' + FORMATIONS.length + ' formations insérées');

  await pool.end();
  console.log('Seed métiers CI terminé!');
}

seedMetiers().catch(e => { console.error(e); process.exit(1); });