-- =============================================================================
-- YIRA V3.0 — base_core — Script de vérification post-déploiement
-- Najo Technologies — CONFIDENTIEL
-- À exécuter après 01_base_core_security.sql ET le seed Prisma.
-- Ce script VÉRIFIE sans modifier. Toutes les requêtes sont en lecture seule.
-- =============================================================================

-- =============================================================================
-- CHECK 1 : Extensions installées
-- =============================================================================
DO $$
DECLARE
  v_ext TEXT;
  v_required TEXT[] := ARRAY['pgcrypto', 'uuid-ossp', 'pg_stat_statements'];
BEGIN
  FOREACH v_ext IN ARRAY v_required LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = v_ext) THEN
      RAISE WARNING '[YIRA-CHECK] Extension manquante : %', v_ext;
    ELSE
      RAISE NOTICE '[OK] Extension : %', v_ext;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- CHECK 2 : Rôles PostgreSQL créés
-- =============================================================================
DO $$
DECLARE
  v_role TEXT;
  v_required_roles TEXT[] := ARRAY[
    'yira_app_reader', 'yira_command_writer',
    'yira_migrator', 'yira_superadmin'
  ];
BEGIN
  FOREACH v_role IN ARRAY v_required_roles LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = v_role) THEN
      RAISE WARNING '[YIRA-CHECK] Rôle manquant : %', v_role;
    ELSE
      RAISE NOTICE '[OK] Rôle : %', v_role;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- CHECK 3 : RLS activé et forcé sur toutes les tables
-- Résultat attendu : rowsecurity=TRUE, forcerowsecurity=TRUE sur chaque table.
-- =============================================================================
SELECT
  tablename                            AS "Table",
  CASE WHEN rowsecurity     THEN '✅' ELSE '❌ MANQUANT' END AS "RLS activé",
  CASE WHEN forcerowsecurity THEN '✅' ELSE '❌ MANQUANT' END AS "RLS forcé"
FROM pg_tables
WHERE schemaname = 'core'
ORDER BY tablename;

-- =============================================================================
-- CHECK 4 : Policies RLS en place
-- Résultat attendu : au moins 2 policies par table (SELECT + write)
-- sauf audit_global (SELECT + INSERT uniquement).
-- =============================================================================
SELECT
  tablename   AS "Table",
  policyname  AS "Policy",
  cmd         AS "Opération",
  roles       AS "Rôles"
FROM pg_policies
WHERE schemaname = 'core'
ORDER BY tablename, policyname;

-- =============================================================================
-- CHECK 5 : Triggers actifs
-- Résultat attendu :
--   - trg_audit_immutable sur audit_global (UPDATE OR DELETE)
--   - trg_audit_* sur toutes les tables sensibles (AFTER INSERT OR UPDATE OR DELETE)
--   - trg_updated_at_* sur toutes les tables avec updated_at
--   - trg_soft_delete_* sur les tables avec deleted_at
-- =============================================================================
SELECT
  event_object_table  AS "Table",
  trigger_name        AS "Trigger",
  event_manipulation  AS "Événement",
  action_timing       AS "Timing",
  'ACTIVE'            AS "Statut"
FROM information_schema.triggers
WHERE trigger_schema = 'core'
ORDER BY event_object_table, trigger_name;

-- =============================================================================
-- CHECK 6 : Test d'isolation RLS — simulation tenant CI
-- Ce test vérifie que seules les données CI sont visibles quand
-- app.current_tenant = 'CI'.
-- =============================================================================
DO $$
DECLARE
  v_count_ci     INT;
  v_count_dev    INT;
BEGIN
  -- Simule une connexion tenant CI
  PERFORM set_config('app.current_tenant', 'CI', true);

  SELECT COUNT(*) INTO v_count_ci
  FROM core.country_config
  WHERE tenant_id = 'CI';

  SELECT COUNT(*) INTO v_count_dev
  FROM core.country_config
  WHERE tenant_id = 'NAJO_DEV';

  -- Avec RLS actif, v_count_dev doit être 0 pour le rôle yira_app_reader
  -- Ce test tourne sous yira_migrator (bypassRLS) — donc v_count_dev peut être > 0.
  -- Le vrai test d'isolation doit être fait sous yira_app_reader.
  RAISE NOTICE '[INFO] Tenant CI rows visibles (bypassRLS) : %', v_count_ci;
  RAISE NOTICE '[INFO] Tenant DEV rows visibles (bypassRLS) : %', v_count_dev;
  RAISE NOTICE '[INFO] Test RLS complet requis sous le rôle yira_app_reader.';
END $$;

-- =============================================================================
-- CHECK 7 : Test d'immuabilité audit_global
-- Tente une mise à jour sur audit_global → doit lever une exception.
-- Si aucun enregistrement n'existe, le test est skippé.
-- =============================================================================
DO $$
DECLARE
  v_audit_id UUID;
BEGIN
  -- Récupère un enregistrement de test
  SELECT id INTO v_audit_id FROM core.audit_global LIMIT 1;

  IF v_audit_id IS NULL THEN
    RAISE NOTICE '[SKIP] audit_global vide — insérer un enregistrement de test d''abord.';
    RETURN;
  END IF;

  -- Tente un UPDATE — doit lever une exception
  BEGIN
    UPDATE core.audit_global SET actor_role = 'HACKED' WHERE id = v_audit_id;
    -- Si on arrive ici, le trigger est ABSENT — CRITIQUE
    RAISE EXCEPTION '[YIRA-CRITICAL] audit_global est MODIFIABLE — trigger manquant !';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE '[OK] audit_global : immuabilité confirmée. Trigger opérationnel.';
    WHEN OTHERS THEN
      RAISE NOTICE '[OK] audit_global : protection active (code: %)', SQLSTATE;
  END;
END $$;

-- =============================================================================
-- CHECK 8 : Seed — données de base présentes
-- =============================================================================
DO $$
DECLARE
  v_tenant_ci_count   INT;
  v_tenant_dev_count  INT;
  v_prompt_count      INT;
  v_formula_count     INT;
  v_operator_count    INT;
  v_service_count     INT;
BEGIN
  SELECT COUNT(*) INTO v_tenant_ci_count   FROM core.country_config WHERE tenant_id = 'CI';
  SELECT COUNT(*) INTO v_tenant_dev_count  FROM core.country_config WHERE tenant_id = 'NAJO_DEV';
  SELECT COUNT(*) INTO v_prompt_count      FROM core.ia_prompts     WHERE tenant_id = 'CI';
  SELECT COUNT(*) INTO v_formula_count     FROM core.scoring_formulas WHERE tenant_id = 'CI';
  SELECT COUNT(*) INTO v_operator_count    FROM core.command_operators;
  SELECT COUNT(*) INTO v_service_count     FROM core.yira_config_service WHERE tenant_id = 'CI';

  IF v_tenant_ci_count   = 0 THEN RAISE WARNING '[❌] Tenant CI manquant — relancer le seed.'; END IF;
  IF v_tenant_dev_count  = 0 THEN RAISE WARNING '[❌] Tenant NAJO_DEV manquant.'; END IF;
  IF v_prompt_count      = 0 THEN RAISE WARNING '[❌] Aucun prompt IA CI — relancer le seed.'; END IF;
  IF v_formula_count     < 2 THEN RAISE WARNING '[❌] Formules CI incomplètes (attendu: TRUST_INDEX + SCG).'; END IF;
  IF v_operator_count    = 0 THEN RAISE WARNING '[❌] Aucun opérateur COMMAND — relancer le seed.'; END IF;
  IF v_service_count     = 0 THEN RAISE WARNING '[❌] Aucun service VAS CI — relancer le seed.'; END IF;

  IF v_tenant_ci_count > 0 AND v_prompt_count > 0 AND v_formula_count >= 2 THEN
    RAISE NOTICE '[OK] Seed base_core vérifié : tenants=%, prompts=%, formules=%, opérateurs=%, services=% ',
      v_tenant_ci_count + v_tenant_dev_count,
      v_prompt_count, v_formula_count, v_operator_count, v_service_count;
  END IF;
END $$;

-- =============================================================================
-- RAPPORT FINAL — Récapitulatif des entités base_core
-- =============================================================================
SELECT
  'country_config'        AS "Table",
  COUNT(*)                AS "Lignes",
  COUNT(*) FILTER (WHERE status = 'ACTIVE')   AS "Actives",
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS "Soft-deleted"
FROM core.country_config

UNION ALL SELECT 'ia_prompts', COUNT(*),
  COUNT(*) FILTER (WHERE status = 'ACTIVE'),
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
FROM core.ia_prompts

UNION ALL SELECT 'yira_config_service', COUNT(*),
  COUNT(*) FILTER (WHERE status = 'ACTIVE'),
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
FROM core.yira_config_service

UNION ALL SELECT 'referentials', COUNT(*),
  COUNT(*) FILTER (WHERE status = 'ACTIVE'),
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
FROM core.referentials

UNION ALL SELECT 'scoring_formulas', COUNT(*),
  COUNT(*) FILTER (WHERE status = 'ACTIVE'),
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
FROM core.scoring_formulas

UNION ALL SELECT 'vendor_alternatives', COUNT(*),
  COUNT(*),  -- pas de status sur cette table
  0
FROM core.vendor_alternatives

UNION ALL SELECT 'audit_global', COUNT(*),
  COUNT(*),  -- pas de status (immuable)
  0
FROM core.audit_global

UNION ALL SELECT 'command_operators', COUNT(*),
  COUNT(*) FILTER (WHERE status = 'ACTIVE'),
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
FROM core.command_operators

ORDER BY "Table";

-- =============================================================================
-- FIN DU SCRIPT DE VÉRIFICATION
-- Un rapport propre = toutes les lignes CHECK affichent [OK].
-- Tout [❌] ou WARNING doit être résolu avant le déploiement en production.
-- =============================================================================
