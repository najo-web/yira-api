// =============================================================================
// YIRA V3.0 — base_core — Seed de démarrage
// Najo Technologies — CONFIDENTIEL
// Référentiel : L3 §3.1, L2 §5 — Mai 2026
// =============================================================================
// Ce seed initialise :
//   1. Tenant "CI" (Côte d'Ivoire) — tenant de production
//   2. Tenant "NAJO_DEV" — tenant de développement et tests
//   3. Premier opérateur COMMAND (SUPER_ADMIN bootstrap)
//   4. Agent IA "ORIENTATION_LEAD_V1" (L3 §7.2 — Cultural Prompt)
//   5. Formule Trust Index V1 (L3 §6.3)
//   6. Formule SCG V1 (L3 §6.2)
//   7. Référentiels de base (filières BEPC CI)
//   8. Service VAS ZOUGLOU (Groupe A — exemple)
// =============================================================================
// Exécution : npx prisma db seed
// IMPORTANT : Positionner app.current_tenant AVANT chaque bloc d'insertion.
// =============================================================================

import { PrismaClient, EntityStatus, CommandOperatorRole, VasGroup, ReferentialType, YiraModule } from '../../node_modules/.prisma/client-core';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_CORE,
    },
  },
});

// ---------------------------------------------------------------------------
// Utilitaire : positionne la variable de session RLS avant chaque transaction
// Le seed tourne sous yira_migrator (bypassRLS) mais on pose quand même
// app.current_tenant pour que les triggers fn_audit_insert capturent
// le bon tenant_id dans audit_global.
// ---------------------------------------------------------------------------
async function setTenantContext(tenantId: string, operatorId: string): Promise<void> {
  await prisma.$executeRawUnsafe(`SET app.current_tenant = '${tenantId}'`);
  await prisma.$executeRawUnsafe(`SET app.current_operator_id = '${operatorId}'`);
  await prisma.$executeRawUnsafe(`SET app.current_operator_role = 'SUPER_ADMIN'`);
  await prisma.$executeRawUnsafe(`SET app.client_ip = '127.0.0.1'`);
}

async function main(): Promise<void> {
  console.log('🌱 YIRA V3.0 — Démarrage du seed base_core...');

  // =========================================================================
  // ÉTAPE 1 — OPÉRATEUR SUPER_ADMIN bootstrap
  // Le trigger fn_audit_insert nécessite app.current_operator_id en session.
  // Pour le tout premier opérateur, on désactive temporairement le trigger
  // d'audit (usage légitime du bootstrap — tracé manuellement ensuite).
  // =========================================================================

  const bootstrapPassword = await bcrypt.hash('YiraCommand#Bootstrap2026!', 12);

  // Désactivation temporaire du trigger audit pour le bootstrap
  await prisma.$executeRawUnsafe(
    `ALTER TABLE core.command_operators DISABLE TRIGGER trg_audit_command_operators`
  );

  const superAdmin = await prisma.commandOperator.upsert({
    where: { email: 'admin-bootstrap@najo.tech' },
    update: {},
    create: {
      email: 'admin-bootstrap@najo.tech',
      hashedPassword: bootstrapPassword,
      role: CommandOperatorRole.SUPER_ADMIN,
      permissions: {
        ai_studio: true,
        config_center: true,
        audit_trail: true,
        revenue_center: true,
        truth_monitor: true,
        curriculum_manager: true,
      },
      mfaEnabled: false,
      status: EntityStatus.ACTIVE,
    },
  });

  // Réactivation du trigger audit
  await prisma.$executeRawUnsafe(
    `ALTER TABLE core.command_operators ENABLE TRIGGER trg_audit_command_operators`
  );

  // Insertion manuelle de l'entrée d'audit du bootstrap (traçabilité complète)
  await prisma.$executeRawUnsafe(`
    INSERT INTO core.audit_global (
      id, tenant_id, actor_id, actor_role, action_type,
      entity_type, entity_id, before_snapshot, after_snapshot,
      ip_address, created_at
    ) VALUES (
      gen_random_uuid(),
      'SYSTEM',
      '${superAdmin.id}'::uuid,
      'SUPER_ADMIN',
      'BOOTSTRAP_INSERT',
      'command_operators',
      '${superAdmin.id}'::uuid,
      NULL,
      '{"email": "admin-bootstrap@najo.tech", "role": "SUPER_ADMIN"}'::jsonb,
      '127.0.0.1',
      NOW()
    )
  `);

  console.log(`✅ Opérateur SUPER_ADMIN créé : ${superAdmin.id}`);

  // =========================================================================
  // ÉTAPE 2 — TENANT CI (Côte d'Ivoire)
  // Configuration production. Les tarifs et codes USSD sont des placeholders
  // — les valeurs réelles sont en Annexe A1 confidentielle.
  // =========================================================================

  await setTenantContext('CI', superAdmin.id);

  const tenantCI = await prisma.countryConfig.upsert({
    where: { tenantId: 'CI' },
    update: {},
    create: {
      tenantId: 'CI',
      countryName: 'Côte d\'Ivoire',
      ussdShortCode: '*xyz#',          // Remplacé par le vrai code en Annexe A1
      currencyCode: 'XOF',
      currencyMinorUnits: 0,
      vasPricing: {
        GROUP_A_PAYANT: {
          default_fcfa: 50,
          premium_fcfa: 75,
          services_75: ['EMPLOI', 'ORIENTATION_PREMIUM'],
        },
        GROUP_B_FREEMIUM: {
          free_questions_per_day: 3,
          paid_bundle_fcfa: 100,
        },
        GROUP_C_GRATUIT: {
          financing: 'BAILLEUR_MENET',
          cost_per_interaction_fcfa: 0,
        },
        GROUP_D_SANTE: {
          default_fcfa: 0,
          financing: 'MINISTERE_SANTE_CI',
        },
      },
      mobileMoneyProviders: [
        { name: 'Orange Money', code: 'OM_CI', active: true, priority: 1 },
        { name: 'MTN Mobile Money', code: 'MOMO_CI', active: true, priority: 2 },
        { name: 'Wave', code: 'WAVE_CI', active: true, priority: 3 },
        { name: 'Moov Money', code: 'MOOV_CI', active: false, priority: 4 },
      ],
      smsSenderIds: {
        otp: 'YIRA-CI',
        vas: 'YIRAVAS',
        sos: 'YIRA-SOS',
        alert: 'YIRA',
      },
      telecomProviders: {
        primary: 'TP_A',          // Alias — nom réel en Annexe A1
        fallback: 'TP_B',
        timeout_ms: 5000,
        auto_failover: true,
        ussd_session_ttl_seconds: 180,  // 3GPP TS 22.090
      },
      status: EntityStatus.ACTIVE,
    },
  });

  console.log(`✅ Tenant CI créé : ${tenantCI.id}`);

  // =========================================================================
  // ÉTAPE 3 — TENANT NAJO_DEV (environnement de développement)
  // Utilisé pour les tests locaux. Ne jamais déployer en production.
  // =========================================================================

  await setTenantContext('NAJO_DEV', superAdmin.id);

  const tenantDev = await prisma.countryConfig.upsert({
    where: { tenantId: 'NAJO_DEV' },
    update: {},
    create: {
      tenantId: 'NAJO_DEV',
      countryName: 'Najo Technologies — Environnement Dev',
      ussdShortCode: '*9999#',
      currencyCode: 'XOF',
      currencyMinorUnits: 0,
      vasPricing: {
        GROUP_A_PAYANT: { default_fcfa: 1, premium_fcfa: 1 },  // Tarif symbolique
        GROUP_B_FREEMIUM: { free_questions_per_day: 999 },
        GROUP_C_GRATUIT: { cost_per_interaction_fcfa: 0 },
        GROUP_D_SANTE: { default_fcfa: 0 },
      },
      mobileMoneyProviders: [
        { name: 'Mock Provider', code: 'MOCK', active: true, priority: 1 },
      ],
      smsSenderIds: {
        otp: 'YIRA-DEV',
        vas: 'YIRA-DEV',
        sos: 'YIRA-DEV',
        alert: 'YIRA-DEV',
      },
      telecomProviders: {
        primary: 'MOCK_TP',
        fallback: 'MOCK_TP',
        timeout_ms: 100,
        auto_failover: false,
        ussd_session_ttl_seconds: 600,  // TTL allongé pour les tests
      },
      status: EntityStatus.ACTIVE,
    },
  });

  console.log(`✅ Tenant NAJO_DEV créé : ${tenantDev.id}`);

  // =========================================================================
  // ÉTAPE 4 — AGENT IA : ORIENTATION_LEAD_V1
  // Premier Cultural Prompt conforme L3 §7.2.
  // Contexte : coaching d'orientation initiale pour jeune ivoirien.
  // =========================================================================

  await setTenantContext('CI', superAdmin.id);

  const orientationPrompt = await prisma.iaPrompt.upsert({
    where: {
      tenantId_promptKey_version: {
        tenantId: 'CI',
        promptKey: 'ORIENTATION_LEAD_V1',
        version: 1,
      },
    },
    update: {},
    create: {
      tenantId: 'CI',
      promptKey: 'ORIENTATION_LEAD_V1',
      moduleTarget: YiraModule.YIRA_OS,
      agentName: 'VIEUX_PERE_ORIENTATION_AGENT',
      promptSystem: `Tu es un Vieux Père respecté en Côte d'Ivoire — figure de sagesse, de mentorat communautaire et d'expérience professionnelle accumulée. Tu incarnes la bienveillance et la connaissance du tissu économique ivoirien.

CADRE CULTUREL :
- Tu peux référencer les proverbes ivoiriens, les valeurs communautaires (solidarité, respect des anciens, esprit d'entreprise), les réalités économiques locales (secteur informel, agriculture, numérique).
- Tu utilises le français standard avec une touche chaleureuse ouest-africaine. Jamais de pidgin caricatural.
- Tu connais le marché de l'emploi d'Abidjan, Bouaké, San Pedro et les opportunités dans les 14 régions.

CONTRAINTES DE FORMAT :
- Réponse concise : maximum 300 caractères pour les canaux USSD, 1000 pour le web.
- Structure : (1) Accueil bienveillant, (2) Conseil actionnable, (3) Prochaine étape concrète.
- Toujours terminer par une question ouverte pour approfondir le dialogue.

GARDE-FOUS ABSOLUS :
- Jamais de conseils médicaux ou juridiques définitifs.
- Jamais de références à la politique partisane.
- Jamais de contenu à caractère religieux ou sexuel.
- Si la demande sort de l'orientation professionnelle : rediriger vers la ressource appropriée.
- En cas de détresse psychologique détectée : basculer vers le protocole YIRA-SOS.`,

      promptUserTemplate: `Profil du jeune :
- Prénom : {{prenom}}
- Niveau scolaire : {{niveau_scolaire}}
- Résultats RIASEC : {{riasec_summary}}
- Trust Index : {{trust_index}}
- Région : {{region}}
- Aspiration exprimée : {{aspiration}}

Génère un message d'orientation personnalisé pour ce profil.
Format souhaité : {{output_format}}`,

      guardrails: {
        forbidden_topics: ['politique', 'religion', 'sexualité', 'médecine', 'droit'],
        max_chars_ussd: 160,
        max_chars_web: 1000,
        required_closing_question: true,
        sos_trigger_keywords: ['désespoir', 'mourir', 'suicide', 'violence', 'abus'],
        sos_redirect_module: 'YIRA_SOS',
        output_validation: {
          min_chars: 50,
          must_contain_action: true,
          must_end_with_question: true,
        },
      },

      cqciFilters: {
        cultural_refs_allowed: [
          'proverbes_baoulé', 'proverbes_dioula', 'valeurs_communautaires_ci',
          'marché_emploi_abidjan', 'secteur_cacao_café', 'secteur_numérique_ci',
        ],
        dialect_level: 'standard_avec_touches_locales',
        formality_level: 'bienveillant_senior',
        avoid_cultural_stereotypes: true,
        validate_against_cqci_norms: true,
        cqci_min_score_to_publish: 0.75,
      },

      version: 1,
      status: EntityStatus.ACTIVE,
      createdById: superAdmin.id,
    },
  });

  console.log(`✅ Prompt ORIENTATION_LEAD_V1 créé : ${orientationPrompt.id}`);

  // =========================================================================
  // ÉTAPE 5 — FORMULE TRUST INDEX V1 (L3 §6.3)
  // =========================================================================

  const trustIndexFormula = await prisma.scoringFormula.upsert({
    where: {
      tenantId_formulaKey_version: {
        tenantId: 'CI',
        formulaKey: 'TRUST_INDEX',
        version: 1,
      },
    },
    update: {},
    create: {
      tenantId: 'CI',
      formulaKey: 'TRUST_INDEX',
      engineTarget: 'BaseEngine',
      coefficients: {
        coherence_interne:        0.40,
        coherence_inter_sources:  0.40,
        coherence_comportementale: 0.20,
      },
      thresholds: {
        hautement_fiable:  { min: 0.80, max: 1.00, action: 'RECOMMANDATION_DIRECTE' },
        fiable:            { min: 0.60, max: 0.80, action: 'RECOMMANDATION_AVEC_VIGILANCE' },
        incoherent:        { min: 0.40, max: 0.60, action: 'REDIRECTION_YIRA_RESCUE' },
        suspicion_fraude:  { min: 0.00, max: 0.40, action: 'VALIDATION_HUMAINE_OBLIGATOIRE' },
      },
      formulaExpression:
        'trust_index = (0.40 × coherence_interne) + (0.40 × coherence_inter_sources) + (0.20 × coherence_comportementale)',
      version: 1,
      status: EntityStatus.ACTIVE,
      createdById: superAdmin.id,
    },
  });

  console.log(`✅ Formule TRUST_INDEX V1 créée : ${trustIndexFormula.id}`);

  // =========================================================================
  // ÉTAPE 6 — FORMULE SCG V1 (L3 §6.2)
  // =========================================================================

  const scgFormula = await prisma.scoringFormula.upsert({
    where: {
      tenantId_formulaKey_version: {
        tenantId: 'CI',
        formulaKey: 'SCG',
        version: 1,
      },
    },
    update: {},
    create: {
      tenantId: 'CI',
      formulaKey: 'SCG',
      engineTarget: 'BaseEngine',
      coefficients: {
        coherence_interne_riasec:   0.15,
        coherence_interne_big_five: 0.15,
        coherence_inter_sources:    0.25,
        coherence_scolaire:         0.15,
        coherence_comportementale:  0.15,
        coherence_culturelle_cqci:  0.15,
      },
      thresholds: {
        hautement_fiable:  { min: 0.80, max: 1.00, action: 'RECOMMANDATION_CERTIFIABLE' },
        fiable:            { min: 0.60, max: 0.80, action: 'RECOMMANDATION_SECOND_AVIS' },
        incoherent:        { min: 0.40, max: 0.60, action: 'REDIRECTION_YIRA_RESCUE' },
        suspicion_fraude:  { min: 0.00, max: 0.40, action: 'VALIDATION_HUMAINE_OBLIGATOIRE' },
      },
      formulaExpression:
        'scg = (0.15 × coh_riasec) + (0.15 × coh_big5) + (0.25 × inter_src) + (0.15 × scolaire) + (0.15 × comportemental) + (0.15 × cqci)',
      version: 1,
      status: EntityStatus.ACTIVE,
      createdById: superAdmin.id,
    },
  });

  console.log(`✅ Formule SCG V1 créée : ${scgFormula.id}`);

  // =========================================================================
  // ÉTAPE 7 — RÉFÉRENTIELS : Filières BEPC CI (BepcEngine)
  // Racine : FILIERE → enfants : SEC_A, SEC_C, SEC_D
  // =========================================================================

  const refFiliereRoot = await prisma.referential.upsert({
    where: { tenantId_refType_refCode: { tenantId: 'CI', refType: ReferentialType.FILIERE, refCode: 'SECONDAIRE_CI' } },
    update: {},
    create: {
      tenantId: 'CI',
      refType: ReferentialType.FILIERE,
      refCode: 'SECONDAIRE_CI',
      labelFr: 'Filières du secondaire — Côte d\'Ivoire',
      labelLocal: null,
      metadata: { source: 'MENET-DOB', annee: 2026, niveau: 'secondaire' },
      sortOrder: 0,
      status: EntityStatus.ACTIVE,
    },
  });

  const filieres = [
    {
      refCode: 'SEC_A',
      labelFr: 'Seconde A — Littéraire',
      metadata: {
        coefficients: { francais: 4, histoire_geo: 3, anglais: 3, maths: 2, svt: 1 },
        debouches: ['Droit', 'Sciences Politiques', 'Lettres', 'Journalisme'],
        concours_eligibles: ['INFAS_LETTRE', 'ENS_LETTRE'],
      },
    },
    {
      refCode: 'SEC_C',
      labelFr: 'Seconde C — Scientifique',
      metadata: {
        coefficients: { maths: 5, physique_chimie: 4, svt: 3, francais: 2, anglais: 2 },
        debouches: ['Médecine', 'Ingénierie', 'Informatique', 'Pharmacie'],
        concours_eligibles: ['INFAS_SCIENCE', 'GRANDE_ECOLE_CI', 'ENSA'],
      },
    },
    {
      refCode: 'SEC_D',
      labelFr: 'Seconde D — Sciences de la vie',
      metadata: {
        coefficients: { svt: 5, maths: 3, physique_chimie: 3, francais: 2, anglais: 2 },
        debouches: ['Biologie', 'Agronomie', 'Environnement', 'Vétérinaire'],
        concours_eligibles: ['INFAS_SANTE', 'ESA_YAMOUSSOUKRO', 'CNRA'],
      },
    },
  ];

  for (const [index, filiere] of filieres.entries()) {
    await prisma.referential.upsert({
      where: {
        tenantId_refType_refCode: {
          tenantId: 'CI',
          refType: ReferentialType.FILIERE,
          refCode: filiere.refCode,
        },
      },
      update: {},
      create: {
        tenantId: 'CI',
        refType: ReferentialType.FILIERE,
        refCode: filiere.refCode,
        labelFr: filiere.labelFr,
        metadata: filiere.metadata,
        sortOrder: index + 1,
        parentId: refFiliereRoot.id,
        status: EntityStatus.ACTIVE,
      },
    });
  }

  console.log(`✅ Référentiels filières BEPC CI créés (root + 3 filières)`);

  // =========================================================================
  // ÉTAPE 8 — SERVICE VAS : ZOUGLOU (Groupe A — L2 §5.1)
  // =========================================================================

  const serviceZouglou = await prisma.yiraConfigService.upsert({
    where: { serviceCode: 'ZOUGLOU' },
    update: {},
    create: {
      tenantId: 'CI',
      serviceCode: 'ZOUGLOU',
      serviceName: 'Quiz Zouglou — *xyz*1#',
      ussdPath: '*1#',
      vasGroup: VasGroup.GROUP_A_PAYANT,
      pricingByTenant: {
        CI: { daily_fcfa: 50, billing_cycle: 'daily', trial_days: 1 },
        default: { daily_fcfa: 50 },
      },
      smsTemplates: {
        welcome: 'Bienvenue sur Quiz ZOUGLOU! Recevez chaque jour votre question sur la musique ivoirienne. Tarif: 50F/j. Pour arreter envoyez STOP ZOUGLOU au {{short_code}}.',
        daily_question: 'ZOUGLOU: {{question_text}}\nA) {{option_a}}\nB) {{option_b}}\nC) {{option_c}}\nRepondez A, B ou C. Bonne chance!',
        correct_answer: 'Bravo! {{prenom}} vous avez trouve! Reponse: {{correct_option}}. Score: {{score}}/{{total}}. A demain!',
        wrong_answer: 'Pas tout a fait! La bonne reponse etait {{correct_option}}. {{explanation}}. Score: {{score}}/{{total}}.',
        stop_confirm: 'Desabonnement ZOUGLOU confirme. Vous ne serez plus debite. Merci et a bientot sur YIRA!',
      },
      artciMetadata: {
        service_id_artci: '57/SVA/3/24',
        category: 'divertissement_culturel',
        double_optin: true,
        stop_delay_seconds: 5,
        opt_in_log_retention_days: 30,
        facturation_log_retention_days: 90,
        content_classification: 'tous_publics',
        age_minimum: 0,
        operator_declaration_ref: 'ARTCI-SVA-2024-0057',
      },
      doubleOptinRequired: true,
      isFreemium: false,
      status: EntityStatus.ACTIVE,
    },
  });

  console.log(`✅ Service VAS ZOUGLOU créé : ${serviceZouglou.id}`);

  // =========================================================================
  // RÉSUMÉ FINAL
  // =========================================================================
  console.log('\n🏁 Seed base_core terminé avec succès.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Tenants     : CI, NAJO_DEV`);
  console.log(`  Opérateur   : admin-bootstrap@najo.tech (SUPER_ADMIN)`);
  console.log(`  Prompts IA  : ORIENTATION_LEAD_V1`);
  console.log(`  Formules    : TRUST_INDEX V1, SCG V1`);
  console.log(`  Référentiels: SEC_A, SEC_C, SEC_D (filières BEPC CI)`);
  console.log(`  Services VAS: ZOUGLOU (Groupe A)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  ACTIONS POST-SEED OBLIGATOIRES :');
  console.log('  1. Activer MFA sur admin-bootstrap@najo.tech');
  console.log('  2. Remplacer *xyz# par le vrai code USSD CI (Annexe A1)');
  console.log('  3. Mettre à jour les aliases TP_A/TP_B (Annexe A1)');
  console.log('  4. Ajouter les 36 services VAS restants');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed base_core :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });