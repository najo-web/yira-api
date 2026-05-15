import { PrismaClient, EntityStatus, CommandOperatorRole, VasGroup, ReferentialType, YiraModule } from '../../node_modules/.prisma/client-core';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_CORE } },
});

async function setTenantContext(tenantId: string, operatorId: string): Promise<void> {
  await prisma.$executeRawUnsafe(`SET app.current_tenant = '${tenantId}'`);
  await prisma.$executeRawUnsafe(`SET app.current_operator_id = '${operatorId}'`);
  await prisma.$executeRawUnsafe(`SET app.current_operator_role = 'SUPER_ADMIN'`);
  await prisma.$executeRawUnsafe(`SET app.client_ip = '127.0.0.1'`);
}

async function main(): Promise<void> {
  console.log('YIRA V3.0 - Demarrage du seed base_core...');

  // ETAPE 1 - SUPER_ADMIN bootstrap
  const bootstrapPassword = await bcrypt.hash('YiraCommand#Bootstrap2026!', 12);
  await prisma.$executeRawUnsafe(`ALTER TABLE core.command_operators DISABLE TRIGGER trg_audit_command_operators`);

  const superAdmin = await prisma.commandOperator.upsert({
    where: { email: 'admin-bootstrap@najo.tech' },
    update: {},
    create: {
      email: 'admin-bootstrap@najo.tech',
      hashedPassword: bootstrapPassword,
      role: CommandOperatorRole.SUPER_ADMIN,
      permissions: { ai_studio: true, config_center: true, audit_trail: true, revenue_center: true, truth_monitor: true, curriculum_manager: true },
      mfaEnabled: false,
      status: EntityStatus.ACTIVE,
    },
  });

  await prisma.$executeRawUnsafe(`ALTER TABLE core.command_operators ENABLE TRIGGER trg_audit_command_operators`);
  await prisma.$executeRawUnsafe(`
    INSERT INTO core.audit_global (id, tenant_id, actor_id, actor_role, action_type, entity_type, entity_id, before_snapshot, after_snapshot, ip_address, created_at)
    VALUES (gen_random_uuid(), 'SYSTEM', '${superAdmin.id}'::uuid, 'SUPER_ADMIN', 'BOOTSTRAP_INSERT', 'command_operators', '${superAdmin.id}'::uuid, NULL, '{"email": "admin-bootstrap@najo.tech", "role": "SUPER_ADMIN"}'::jsonb, '127.0.0.1', NOW())
  `);
  console.log('OK Operateur SUPER_ADMIN cree : ' + superAdmin.id);

  // ETAPE 2 - TENANT CI
  await setTenantContext('CI', superAdmin.id);

  const tenantCI = await prisma.countryConfig.upsert({
    where: { tenantId: 'CI' },
    update: {},
    create: {
      tenantId: 'CI', countryName: "Cote d'Ivoire",
      ussdShortCode: '*xyz#', currencyCode: 'XOF', currencyMinorUnits: 0,
      vasPricing: { GROUP_A_PAYANT: { default_fcfa: 50, premium_fcfa: 75 }, GROUP_B_FREEMIUM: { free_questions_per_day: 3 }, GROUP_C_GRATUIT: { cost_per_interaction_fcfa: 0 }, GROUP_D_SANTE: { default_fcfa: 0 } },
      mobileMoneyProviders: [{ name: 'Orange Money', code: 'OM_CI', active: true, priority: 1 }, { name: 'MTN Mobile Money', code: 'MOMO_CI', active: true, priority: 2 }, { name: 'Wave', code: 'WAVE_CI', active: true, priority: 3 }],
      smsSenderIds: { otp: 'YIRA-CI', vas: 'YIRAVAS', sos: 'YIRA-SOS', alert: 'YIRA' },
      telecomProviders: { primary: 'TP_A', fallback: 'TP_B', timeout_ms: 5000, auto_failover: true, ussd_session_ttl_seconds: 180 },
      status: EntityStatus.ACTIVE,
    },
  });
  console.log('OK Tenant CI cree : ' + tenantCI.id);

  // ETAPE 3 - TENANT NAJO_DEV
  await setTenantContext('NAJO_DEV', superAdmin.id);

  const tenantDev = await prisma.countryConfig.upsert({
    where: { tenantId: 'NAJO_DEV' },
    update: {},
    create: {
      tenantId: 'NAJO_DEV', countryName: 'Najo Technologies - Environnement Dev',
      ussdShortCode: '*9999#', currencyCode: 'XOF', currencyMinorUnits: 0,
      vasPricing: { GROUP_A_PAYANT: { default_fcfa: 1, premium_fcfa: 1 }, GROUP_B_FREEMIUM: { free_questions_per_day: 999 }, GROUP_C_GRATUIT: { cost_per_interaction_fcfa: 0 }, GROUP_D_SANTE: { default_fcfa: 0 } },
      mobileMoneyProviders: [{ name: 'Mock Provider', code: 'MOCK', active: true, priority: 1 }],
      smsSenderIds: { otp: 'YIRA-DEV', vas: 'YIRA-DEV', sos: 'YIRA-DEV', alert: 'YIRA-DEV' },
      telecomProviders: { primary: 'MOCK_TP', fallback: 'MOCK_TP', timeout_ms: 100, auto_failover: false, ussd_session_ttl_seconds: 600 },
      status: EntityStatus.ACTIVE,
    },
  });
  console.log('OK Tenant NAJO_DEV cree : ' + tenantDev.id);

  // ETAPE 4 - PROMPT IA
  await setTenantContext('CI', superAdmin.id);

  const orientationPrompt = await prisma.iaPrompt.upsert({
    where: { tenantId_promptKey_version: { tenantId: 'CI', promptKey: 'ORIENTATION_LEAD_V1', version: 1 } },
    update: {},
    create: {
      tenantId: 'CI', promptKey: 'ORIENTATION_LEAD_V1',
      moduleTarget: YiraModule.YIRA_OS, agentName: 'VIEUX_PERE_ORIENTATION_AGENT',
      promptSystem: "Tu es un Vieux Pere respecte en Cote d'Ivoire. Tu incarnes la bienveillance et la connaissance du tissu economique ivoirien. Reponds en francais standard avec une touche chaleureuse ouest-africaine. Maximum 300 caracteres pour USSD.",
      promptUserTemplate: "Profil: {{prenom}}, niveau {{niveau_scolaire}}, RIASEC {{riasec_summary}}, Trust Index {{trust_index}}, region {{region}}. Genere un message d'orientation personnalise.",
      guardrails: { forbidden_topics: ['politique', 'religion', 'sexualite'], max_chars_ussd: 160, max_chars_web: 1000, sos_trigger_keywords: ['desespoir', 'mourir', 'suicide'], sos_redirect_module: 'YIRA_SOS' },
      cqciFilters: { dialect_level: 'standard_avec_touches_locales', formality_level: 'bienveillant_senior', avoid_cultural_stereotypes: true, validate_against_cqci_norms: true, cqci_min_score_to_publish: 0.75, cultural_refs_allowed: ['proverbes_baoulé', 'valeurs_communautaires_ci'] },
      version: 1, status: EntityStatus.ACTIVE, createdById: superAdmin.id,
    },
  });
  console.log('OK Prompt ORIENTATION_LEAD_V1 cree : ' + orientationPrompt.id);

  // ETAPE 5 - FORMULE TRUST INDEX
  const trustIndexFormula = await prisma.scoringFormula.upsert({
    where: { tenantId_formulaKey_version: { tenantId: 'CI', formulaKey: 'TRUST_INDEX', version: 1 } },
    update: {},
    create: {
      tenantId: 'CI', formulaKey: 'TRUST_INDEX', engineTarget: 'BaseEngine',
      coefficients: { coherence_interne: 0.40, coherence_inter_sources: 0.40, coherence_comportementale: 0.20 },
      thresholds: { hautement_fiable: { min: 0.80, max: 1.00, action: 'RECOMMANDATION_DIRECTE' }, fiable: { min: 0.60, max: 0.80, action: 'RECOMMANDATION_AVEC_VIGILANCE' }, incoherent: { min: 0.40, max: 0.60, action: 'REDIRECTION_YIRA_RESCUE' }, suspicion_fraude: { min: 0.00, max: 0.40, action: 'VALIDATION_HUMAINE_OBLIGATOIRE' } },
      formulaExpression: 'trust_index = (0.40 x coherence_interne) + (0.40 x coherence_inter_sources) + (0.20 x coherence_comportementale)',
      version: 1, status: EntityStatus.ACTIVE, createdById: superAdmin.id,
    },
  });
  console.log('OK Formule TRUST_INDEX V1 creee : ' + trustIndexFormula.id);

  // ETAPE 6 - FORMULE SCG
  const scgFormula = await prisma.scoringFormula.upsert({
    where: { tenantId_formulaKey_version: { tenantId: 'CI', formulaKey: 'SCG', version: 1 } },
    update: {},
    create: {
      tenantId: 'CI', formulaKey: 'SCG', engineTarget: 'BaseEngine',
      coefficients: { coherence_interne_riasec: 0.15, coherence_interne_big_five: 0.15, coherence_inter_sources: 0.25, coherence_scolaire: 0.15, coherence_comportementale: 0.15, coherence_culturelle_cqci: 0.15 },
      thresholds: { hautement_fiable: { min: 0.80, max: 1.00, action: 'RECOMMANDATION_CERTIFIABLE' }, fiable: { min: 0.60, max: 0.80, action: 'RECOMMANDATION_SECOND_AVIS' }, incoherent: { min: 0.40, max: 0.60, action: 'REDIRECTION_YIRA_RESCUE' }, suspicion_fraude: { min: 0.00, max: 0.40, action: 'VALIDATION_HUMAINE_OBLIGATOIRE' } },
      formulaExpression: 'scg = (0.15 x coh_riasec) + (0.15 x coh_big5) + (0.25 x inter_src) + (0.15 x scolaire) + (0.15 x comportemental) + (0.15 x cqci)',
      version: 1, status: EntityStatus.ACTIVE, createdById: superAdmin.id,
    },
  });
  console.log('OK Formule SCG V1 creee : ' + scgFormula.id);

  // ETAPE 7 - REFERENTIELS FILIERES BEPC
  const refFiliereRoot = await prisma.referential.upsert({
    where: { tenantId_refType_refCode: { tenantId: 'CI', refType: ReferentialType.FILIERE, refCode: 'SECONDAIRE_CI' } },
    update: {},
    create: { tenantId: 'CI', refType: ReferentialType.FILIERE, refCode: 'SECONDAIRE_CI', labelFr: "Filieres du secondaire - Cote d'Ivoire", labelLocal: "Filieres secondaire CI", metadata: { source: 'MENET-DOB', annee: 2026 }, sortOrder: 0, status: EntityStatus.ACTIVE },
  });

  const filieres = [
    { refCode: 'SEC_A', labelFr: 'Seconde A - Litteraire',        metadata: { coefficients: { francais: 4, histoire_geo: 3, anglais: 3, maths: 2 }, debouches: ['Droit', 'Lettres', 'Journalisme'] } },
    { refCode: 'SEC_C', labelFr: 'Seconde C - Scientifique',      metadata: { coefficients: { maths: 5, physique_chimie: 4, svt: 3, francais: 2 }, debouches: ['Medecine', 'Ingenierie', 'Informatique'] } },
    { refCode: 'SEC_D', labelFr: 'Seconde D - Sciences de la vie', metadata: { coefficients: { svt: 5, maths: 3, physique_chimie: 3 }, debouches: ['Biologie', 'Agronomie', 'Environnement'] } },
  ];

  for (const [index, filiere] of filieres.entries()) {
    await prisma.referential.upsert({
      where: { tenantId_refType_refCode: { tenantId: 'CI', refType: ReferentialType.FILIERE, refCode: filiere.refCode } },
      update: {},
      create: { tenantId: 'CI', refType: ReferentialType.FILIERE, refCode: filiere.refCode, labelFr: filiere.labelFr, labelLocal: filiere.labelFr, metadata: filiere.metadata, sortOrder: index + 1, parentId: refFiliereRoot.id, status: EntityStatus.ACTIVE },
    });
  }
  console.log('OK Referentiels filieres BEPC CI crees');

  // ETAPE 8 - SERVICE ZOUGLOU
  await prisma.yiraConfigService.upsert({
    where: { serviceCode: 'ZOUGLOU' },
    update: { ussdPath: '1*1', serviceName: 'Quiz Zouglou' },
    create: {
      tenantId: 'CI', serviceCode: 'ZOUGLOU', serviceName: 'Quiz Zouglou',
      ussdPath: '1*1', vasGroup: VasGroup.GROUP_A_PAYANT,
      pricingByTenant: { CI: { daily_fcfa: 50 }, default: { daily_fcfa: 50 } },
      smsTemplates: { welcome: 'Bienvenue sur Quiz ZOUGLOU! Tarif: 50F/j. STOP ZOUGLOU pour se desabonner.', daily_content: 'ZOUGLOU: {{question}} A){{a}} B){{b}} C){{c}}', stop_confirm: 'Desabonnement ZOUGLOU confirme. Merci!' },
      artciMetadata: { service_id_artci: '57/SVA/3/24', category: 'divertissement_culturel', double_optin: true, stop_delay_seconds: 5, opt_in_log_retention_days: 30 },
      doubleOptinRequired: true, isFreemium: false, status: EntityStatus.ACTIVE,
    },
  });

  // ETAPE 9 - MENUS USSD (Zero Hardcode)
  await setTenantContext('CI', superAdmin.id);

  const menusUssd = [
    { refCode: 'MENU_ACCUEIL',    labelFr: 'YIRA — Ton avenir commence ici',                    metadata: { ordre: 0 } },
    { refCode: 'PORTE_1',         labelFr: 'Apprendre et progresser',                            metadata: { ordre: 1, ussd_path: '1' } },
    { refCode: 'PORTE_2',         labelFr: 'Ma sante chaque jour',                               metadata: { ordre: 2, ussd_path: '2' } },
    { refCode: 'PORTE_3',         labelFr: 'Gagner et epargner',                                 metadata: { ordre: 3, ussd_path: '3' } },
    { refCode: 'PORTE_4',         labelFr: 'Mon avenir et mes droits',                           metadata: { ordre: 4, ussd_path: '4' } },
    { refCode: 'PORTE_5',         labelFr: 'SOS - Urgence sociale',                              metadata: { ordre: 5, ussd_path: '5' } },
    { refCode: 'LABEL_QUITTER',   labelFr: 'Quitter',                                            metadata: { ussd_key: '0' } },
    { refCode: 'LABEL_RETOUR',    labelFr: 'Retour',                                             metadata: { ussd_key: '0' } },
    { refCode: 'MSG_AU_REVOIR',   labelFr: 'Merci d utiliser YIRA! A bientot!',                  metadata: {} },
    { refCode: 'MSG_OPTIN_OUI',   labelFr: 'Je souscris',                                        metadata: { ussd_key: '1' } },
    { refCode: 'MSG_OPTIN_NON',   labelFr: 'Non merci',                                          metadata: { ussd_key: '2' } },
    { refCode: 'MSG_OPTIN_CONF',  labelFr: 'Souscription confirmee! Premiere question bientot!', metadata: {} },
    { refCode: 'MSG_OPTIN_REFUS', labelFr: 'Pas de souci! A bientot sur YIRA!',                  metadata: {} },
    { refCode: 'MAX_ABONNEMENTS', labelFr: 'Maximum 3 abonnements simultanes',                   metadata: { valeur: 3 } },
  ];

  for (const menu of menusUssd) {
    await prisma.referential.upsert({
      where: { tenantId_refType_refCode: { tenantId: 'CI', refType: ReferentialType.METIER, refCode: menu.refCode } },
      update: { labelFr: menu.labelFr },
      create: { tenantId: 'CI', refType: ReferentialType.METIER, refCode: menu.refCode, labelFr: menu.labelFr, labelLocal: menu.labelFr, metadata: menu.metadata, sortOrder: (menu.metadata as any).ordre ?? 0, status: EntityStatus.ACTIVE },
    });
  }
  console.log('OK Menus USSD crees : ' + menusUssd.length + ' referentiels');

  // ETAPE 10 - 36 SERVICES VAS
  const services = [
    { serviceCode: 'CULTURE',    serviceName: 'CultureQuizX',       ussdPath: '1*2',  vasGroup: VasGroup.GROUP_A_PAYANT,   prix: 50,  gratuit: false },
    { serviceCode: 'SPORT',      serviceName: 'Sport-Quiz',          ussdPath: '1*3',  vasGroup: VasGroup.GROUP_A_PAYANT,   prix: 50,  gratuit: false },
    { serviceCode: 'PROVERBE',   serviceName: 'ProverbeQuiz',        ussdPath: '1*4',  vasGroup: VasGroup.GROUP_A_PAYANT,   prix: 50,  gratuit: false },
    { serviceCode: 'QUIZIK',     serviceName: 'QuiZik Musique',      ussdPath: '1*5',  vasGroup: VasGroup.GROUP_A_PAYANT,   prix: 50,  gratuit: false },
    { serviceCode: 'CUISINE',    serviceName: 'Cuisine-Quiz',        ussdPath: '1*6',  vasGroup: VasGroup.GROUP_A_PAYANT,   prix: 50,  gratuit: false },
    { serviceCode: 'EDU',        serviceName: 'Quiz-Edu BEPC/BAC',   ussdPath: '1*7',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'ALPHA',      serviceName: 'Alpha-Quiz',          ussdPath: '1*8',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'HISTOIRE',   serviceName: 'Quiz Histoire CI',    ussdPath: '1*9',  vasGroup: VasGroup.GROUP_A_PAYANT,   prix: 50,  gratuit: false },
    { serviceCode: 'PALU',       serviceName: 'Quiz Paludisme',      ussdPath: '2*1',  vasGroup: VasGroup.GROUP_D_SANTE,    prix: 0,   gratuit: true  },
    { serviceCode: 'DEPIST',     serviceName: 'Centres Depistage',   ussdPath: '2*2',  vasGroup: VasGroup.GROUP_D_SANTE,    prix: 0,   gratuit: true  },
    { serviceCode: 'MAMA',       serviceName: 'Mama-Quiz',           ussdPath: '2*3',  vasGroup: VasGroup.GROUP_B_FREEMIUM, prix: 0,   gratuit: false },
    { serviceCode: 'VACCIN',     serviceName: 'Vaccin-Quiz',         ussdPath: '2*4',  vasGroup: VasGroup.GROUP_B_FREEMIUM, prix: 0,   gratuit: false },
    { serviceCode: 'NUTRI',      serviceName: 'Nutri-Quiz',          ussdPath: '2*5',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'HYGIENE',    serviceName: 'Hygiene-Quiz',        ussdPath: '2*6',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'EAU',        serviceName: 'Eau-Quiz WASH',       ussdPath: '2*7',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'CANCER',     serviceName: 'Prevention Cancer',   ussdPath: '2*8',  vasGroup: VasGroup.GROUP_D_SANTE,    prix: 0,   gratuit: true  },
    { serviceCode: 'ESPRIT',     serviceName: 'Sante Mentale',       ussdPath: '2*9',  vasGroup: VasGroup.GROUP_D_SANTE,    prix: 0,   gratuit: true  },
    { serviceCode: 'HANDICAP',   serviceName: 'Quiz Handicap',       ussdPath: '2*10', vasGroup: VasGroup.GROUP_D_SANTE,    prix: 0,   gratuit: true  },
    { serviceCode: 'AGRI',       serviceName: 'Agri-Quiz',           ussdPath: '3*1',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'METEO',      serviceName: 'Meteo-Agri',          ussdPath: '3*2',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'FINANCE',    serviceName: 'Finance-Quiz',        ussdPath: '3*3',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'MICRO',      serviceName: 'Micro-Quiz',          ussdPath: '3*4',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'ACTUQUIZ',   serviceName: 'ActuQuiz CI',         ussdPath: '3*5',  vasGroup: VasGroup.GROUP_A_PAYANT,   prix: 75,  gratuit: false },
    { serviceCode: 'SECURITE',   serviceName: 'InfoSecurite',        ussdPath: '3*6',  vasGroup: VasGroup.GROUP_A_PAYANT,   prix: 50,  gratuit: false },
    { serviceCode: 'ORIENTATION',serviceName: 'YIRA-Orientation',    ussdPath: '4*1',  vasGroup: VasGroup.GROUP_B_FREEMIUM, prix: 0,   gratuit: false },
    { serviceCode: 'EMPLOI',     serviceName: 'Offres Emploi CI',    ussdPath: '4*2',  vasGroup: VasGroup.GROUP_A_PAYANT,   prix: 75,  gratuit: false },
    { serviceCode: 'ROUTE',      serviceName: 'Route-Quiz Permis',   ussdPath: '4*3',  vasGroup: VasGroup.GROUP_B_FREEMIUM, prix: 0,   gratuit: false },
    { serviceCode: 'DROIT',      serviceName: 'Droit-Quiz',          ussdPath: '4*4',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'FEMME',      serviceName: 'Femme-Quiz',          ussdPath: '4*5',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'ELECTION',   serviceName: 'Election & CEI',      ussdPath: '4*6',  vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'ARNAQUE',    serviceName: 'Anti-Arnaque',        ussdPath: '4*7',  vasGroup: VasGroup.GROUP_D_SANTE,    prix: 0,   gratuit: true  },
    { serviceCode: 'CONCOURS',   serviceName: 'Concours FP CI',      ussdPath: '4*8',  vasGroup: VasGroup.GROUP_A_PAYANT,   prix: 50,  gratuit: false },
    { serviceCode: 'SENIOR',     serviceName: 'Droits Seniors',      ussdPath: '4*9',  vasGroup: VasGroup.GROUP_D_SANTE,    prix: 0,   gratuit: true  },
    { serviceCode: 'TRAVAIL',    serviceName: 'Droit du Travail',    ussdPath: '4*10', vasGroup: VasGroup.GROUP_C_GRATUIT,  prix: 0,   gratuit: true  },
    { serviceCode: 'VOD',        serviceName: 'VOD-Quiz Educatif',   ussdPath: '4*11', vasGroup: VasGroup.GROUP_E_VOD,      prix: 75,  gratuit: false },
    { serviceCode: 'SOS',        serviceName: 'SOS-YIRA Urgence',    ussdPath: '5*1',  vasGroup: VasGroup.GROUP_F_SOS,      prix: 0,   gratuit: true  },
  ];

  let createdCount = 0;
  for (const svc of services) {
    await prisma.yiraConfigService.upsert({
      where: { serviceCode: svc.serviceCode },
      update: { ussdPath: svc.ussdPath, serviceName: svc.serviceName },
      create: {
        tenantId: 'CI', serviceCode: svc.serviceCode, serviceName: svc.serviceName,
        ussdPath: svc.ussdPath, vasGroup: svc.vasGroup,
        doubleOptinRequired: !svc.gratuit,
        isFreemium: svc.vasGroup === VasGroup.GROUP_B_FREEMIUM,
        pricingByTenant: { CI: { daily_fcfa: svc.prix }, default: { daily_fcfa: svc.prix } },
        smsTemplates: {
          welcome:       'Bienvenue sur ' + svc.serviceName + '! Service YIRA.' + (svc.prix > 0 ? ' Tarif: ' + svc.prix + 'F/jour.' : ' Gratuit.') + ' STOP ' + svc.serviceCode + ' pour se desabonner.',
          daily_content: svc.serviceName + ': {{content}} - Repondez au *7572#',
          stop_confirm:  'Desabonnement ' + svc.serviceCode + ' confirme. Merci et a bientot sur YIRA!',
        },
        artciMetadata: { service_id_artci: '57/SVA/3/24', category: svc.vasGroup, double_optin: !svc.gratuit, stop_delay_seconds: 5, opt_in_log_retention_days: 30 },
        status: EntityStatus.ACTIVE,
      },
    });
    createdCount++;
  }
  console.log('OK ' + createdCount + ' services VAS crees (36 + ZOUGLOU = 37 total)');

  // ETAPE 11 - REGLES MODERATION COLLABORATIVE
  await setTenantContext('CI', superAdmin.id);

  const reglesMod = [
    { refCode: 'MODERATION_DEADLINE_HEURE',   labelFr: 'Heure limite moderation',                              metadata: { heure: '07:45', timezone: 'Africa/Abidjan' } },
    { refCode: 'MODERATION_AUTO_VALIDE',       labelFr: 'Auto-validation si pas action avant deadline',         metadata: { actif: true } },
    { refCode: 'MODERATION_STRICTE_SERVICES', labelFr: 'Services neccessitant validation humaine obligatoire', metadata: { codes: ['SANTE','PALU','CANCER','DEPIST','MAMA','VACCIN','DROIT','FEMME','ESPRIT'] } },
    { refCode: 'MODERATION_GROUPES',          labelFr: 'Attribution services par groupe moderateur',
      metadata: {
        SANTE:   ['PALU','DEPIST','MAMA','VACCIN','CANCER','ESPRIT','NUTRI','HYGIENE','EAU','HANDICAP'],
        CULTURE: ['ZOUGLOU','CULTURE','SPORT','PROVERBE','QUIZIK','CUISINE','HISTOIRE','ALPHA'],
        CITOYEN: ['DROIT','FEMME','ELECTION','ARNAQUE','SENIOR','TRAVAIL','AGRI','METEO','FINANCE','MICRO'],
        EDU:     ['EDU','ORIENTATION','ROUTE','EMPLOI','CONCOURS','VOD','ACTUQUIZ','SECURITE','SOS'],
      },
    },
  ];

  for (const regle of reglesMod) {
    await prisma.referential.upsert({
      where: { tenantId_refType_refCode: { tenantId: 'CI', refType: ReferentialType.METIER, refCode: regle.refCode } },
      update: { metadata: regle.metadata as any },
      create: { tenantId: 'CI', refType: ReferentialType.METIER, refCode: regle.refCode, labelFr: regle.labelFr, labelLocal: regle.labelFr, metadata: regle.metadata as any, sortOrder: 0, status: EntityStatus.ACTIVE },
    });
  }
  console.log('OK Regles moderation collaborative creees : ' + reglesMod.length);

  // RESUME FINAL
  console.log('\nSeed base_core V3.0 termine avec succes.');
  console.log('Tenants      : CI, NAJO_DEV');
  console.log('Operateur    : admin-bootstrap@najo.tech');
  console.log('Prompts IA   : ORIENTATION_LEAD_V1');
  console.log('Formules     : TRUST_INDEX V1, SCG V1');
  console.log('Menus USSD   : ' + menusUssd.length + ' referentiels (Zero Hardcode)');
  console.log('Services VAS : 37 services (5 portes thematiques)');
  console.log('Moderation   : 4 groupes + ' + reglesMod.length + ' regles');
  console.log('\nACTIONS POST-SEED OBLIGATOIRES :');
  console.log('1. Activer MFA sur admin-bootstrap@najo.tech');
  console.log('2. Remplacer *xyz# par le vrai code USSD CI');
  console.log('3. Configurer LAfricaMobile (TelecomService)');
  console.log('4. Creer les comptes moderateurs dans yira_moderateur (base_game)');
}

main()
  .catch((e) => {
    console.error('Erreur seed base_core :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });