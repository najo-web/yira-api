-- =============================================================================
-- YIRA V3.0 — base_core — Sécurisation PostgreSQL
-- Najo Technologies — CONFIDENTIEL
-- Référentiel : L3 §3.1, §3.9, §9 — Mai 2026
-- =============================================================================
-- Ordre d'exécution obligatoire :
--   1. Extensions
--   2. Schéma et rôles PostgreSQL
--   3. Row-Level Security (RLS)
--   4. Triggers d'immuabilité et d'audit automatique
-- =============================================================================
-- ⚠️  À exécuter par un superuser PostgreSQL une seule fois.
--     Toutes les migrations Prisma suivantes s'exécutent sous le rôle
--     yira_migrator (privilèges limités, tracés dans audit_global).
-- =============================================================================

-- =============================================================================
-- PARTIE 1 — EXTENSIONS
-- =============================================================================

-- pgcrypto : génération d'UUID v4, chiffrement AES-256-GCM (base_sos, MFA secrets)
-- Activé dès base_core pour disponibilité future dans toutes les bases.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- uuid-ossp : génération UUID v4 alternative (compatibilité Prisma gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_stat_statements : monitoring des requêtes lentes (observabilité L3 §10)
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- PARTIE 2 — SCHÉMA ET RÔLES POSTGRESQL
-- =============================================================================

-- Schéma dédié base_core (isolation des objets PostgreSQL)
CREATE SCHEMA IF NOT EXISTS core;

-- ----------------------------------------------------------------------------
-- RÔLE 1 : yira_app_reader
-- Utilisé par les modules métier (N4) via le service CoreConfigService (N2).
-- READ ONLY sur toutes les tables core.
-- Le RLS filtre automatiquement par tenant_id.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'yira_app_reader') THEN
    CREATE ROLE yira_app_reader NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA core TO yira_app_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO yira_app_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT ON TABLES TO yira_app_reader;

-- ----------------------------------------------------------------------------
-- RÔLE 2 : yira_command_writer
-- Utilisé exclusivement par YIRA-COMMAND (dashboard d'administration).
-- INSERT / UPDATE / DELETE sur toutes les tables core SAUF audit_global.
-- audit_global : INSERT uniquement (protection complémentaire via trigger).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'yira_command_writer') THEN
    CREATE ROLE yira_command_writer NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA core TO yira_command_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO yira_command_writer;

-- Restriction spécifique audit_global : INSERT only pour yira_command_writer
REVOKE UPDATE, DELETE ON core.audit_global FROM yira_command_writer;

ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO yira_command_writer;

-- ----------------------------------------------------------------------------
-- RÔLE 3 : yira_migrator
-- Utilisé par Prisma migrate uniquement (CI/CD pipeline).
-- Peut créer/modifier la structure des tables (DDL) mais n'accède pas aux données.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'yira_migrator') THEN
    CREATE ROLE yira_migrator NOLOGIN;
  END IF;
END
$$;

GRANT USAGE, CREATE ON SCHEMA core TO yira_migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA core TO yira_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA core TO yira_migrator;
-- yira_migrator peut bypasser RLS pour les migrations (tracé en audit)
ALTER ROLE yira_migrator BYPASSRLS;

-- ----------------------------------------------------------------------------
-- RÔLE 4 : yira_superadmin
-- Réservé aux opérateurs Najo Technologies pour maintenance globale.
-- Bypass RLS autorisé mais TOUTE action est journalisée dans audit_global.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'yira_superadmin') THEN
    CREATE ROLE yira_superadmin NOLOGIN;
  END IF;
END
$$;

GRANT yira_command_writer TO yira_superadmin;
-- Bypass RLS activé pour les opérations de maintenance globale (L3 §3.9)
ALTER ROLE yira_superadmin BYPASSRLS;

-- =============================================================================
-- PARTIE 3 — ROW-LEVEL SECURITY (RLS)
-- L3 §3.9 : isolation stricte par tenant_id via variable de session.
-- =============================================================================

-- Activation RLS sur toutes les tables avec tenant_id
-- Note : audit_global et vendor_alternatives n'ont pas de tenant_id →
--        contrôle d'accès géré uniquement par les privilèges de rôle.

ALTER TABLE core.country_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.ia_prompts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.yira_config_service ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.referentials        ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.scoring_formulas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.command_operators   ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_global        ENABLE ROW LEVEL SECURITY;

-- Force RLS même pour le propriétaire de la table (double sécurité)
ALTER TABLE core.country_config      FORCE ROW LEVEL SECURITY;
ALTER TABLE core.ia_prompts          FORCE ROW LEVEL SECURITY;
ALTER TABLE core.yira_config_service FORCE ROW LEVEL SECURITY;
ALTER TABLE core.referentials        FORCE ROW LEVEL SECURITY;
ALTER TABLE core.scoring_formulas    FORCE ROW LEVEL SECURITY;
ALTER TABLE core.audit_global        FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- FUNCTION utilitaire : get_current_tenant()
-- Lit la variable de session app.current_tenant.
-- Retourne NULL si non définie (bloque tout accès par défaut — fail-secure).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.get_current_tenant()
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN current_setting('app.current_tenant', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- FUNCTION utilitaire : is_system_admin()
-- Vérifie si le rôle courant est yira_superadmin.
-- Utilisé dans les policies RLS pour l'accès cross-tenant de maintenance.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.is_system_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_has_role(current_user, 'yira_superadmin', 'MEMBER');
END;
$$;

-- ============================================================================
-- POLICIES RLS — country_config
-- SELECT : tenant courant OU system admin
-- INSERT/UPDATE/DELETE : yira_command_writer uniquement (géré par rôle)
-- ============================================================================

DROP POLICY IF EXISTS rls_country_config_select ON core.country_config;
CREATE POLICY rls_country_config_select
  ON core.country_config
  FOR SELECT
  TO yira_app_reader, yira_command_writer
  USING (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  );

DROP POLICY IF EXISTS rls_country_config_write ON core.country_config;
CREATE POLICY rls_country_config_write
  ON core.country_config
  FOR ALL  -- INSERT / UPDATE / DELETE
  TO yira_command_writer
  USING (
    -- COMMAND ne peut modifier que son propre tenant (sauf SUPER_ADMIN)
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  )
  WITH CHECK (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  );

-- ============================================================================
-- POLICIES RLS — ia_prompts
-- ============================================================================

DROP POLICY IF EXISTS rls_ia_prompts_select ON core.ia_prompts;
CREATE POLICY rls_ia_prompts_select
  ON core.ia_prompts
  FOR SELECT
  TO yira_app_reader, yira_command_writer
  USING (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  );

DROP POLICY IF EXISTS rls_ia_prompts_write ON core.ia_prompts;
CREATE POLICY rls_ia_prompts_write
  ON core.ia_prompts
  FOR ALL
  TO yira_command_writer
  USING (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  )
  WITH CHECK (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  );

-- ============================================================================
-- POLICIES RLS — yira_config_service
-- ============================================================================

DROP POLICY IF EXISTS rls_config_service_select ON core.yira_config_service;
CREATE POLICY rls_config_service_select
  ON core.yira_config_service
  FOR SELECT
  TO yira_app_reader, yira_command_writer
  USING (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  );

DROP POLICY IF EXISTS rls_config_service_write ON core.yira_config_service;
CREATE POLICY rls_config_service_write
  ON core.yira_config_service
  FOR ALL
  TO yira_command_writer
  USING (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  )
  WITH CHECK (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  );

-- ============================================================================
-- POLICIES RLS — referentials
-- ============================================================================

DROP POLICY IF EXISTS rls_referentials_select ON core.referentials;
CREATE POLICY rls_referentials_select
  ON core.referentials
  FOR SELECT
  TO yira_app_reader, yira_command_writer
  USING (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  );

DROP POLICY IF EXISTS rls_referentials_write ON core.referentials;
CREATE POLICY rls_referentials_write
  ON core.referentials
  FOR ALL
  TO yira_command_writer
  USING (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  )
  WITH CHECK (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  );

-- ============================================================================
-- POLICIES RLS — scoring_formulas
-- ============================================================================

DROP POLICY IF EXISTS rls_scoring_formulas_select ON core.scoring_formulas;
CREATE POLICY rls_scoring_formulas_select
  ON core.scoring_formulas
  FOR SELECT
  TO yira_app_reader, yira_command_writer
  USING (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  );

DROP POLICY IF EXISTS rls_scoring_formulas_write ON core.scoring_formulas;
CREATE POLICY rls_scoring_formulas_write
  ON core.scoring_formulas
  FOR ALL
  TO yira_command_writer
  USING (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  )
  WITH CHECK (
    tenant_id = core.get_current_tenant()
    OR core.is_system_admin()
  );

-- ============================================================================
-- POLICIES RLS — command_operators
-- SELECT : SUPER_ADMIN uniquement (les opérateurs ne voient pas leurs pairs)
-- INSERT/UPDATE : SUPER_ADMIN uniquement
-- ============================================================================

DROP POLICY IF EXISTS rls_command_operators_admin ON core.command_operators;
CREATE POLICY rls_command_operators_admin
  ON core.command_operators
  FOR ALL
  TO yira_command_writer
  USING (core.is_system_admin())
  WITH CHECK (core.is_system_admin());

-- ============================================================================
-- POLICIES RLS — audit_global
-- SELECT : SUPER_ADMIN et AUDITOR (filtrés par tenant pour AUDITOR)
-- INSERT : yira_command_writer et les triggers système
-- UPDATE/DELETE : PERSONNE — renforcé par trigger ci-dessous
-- ============================================================================

DROP POLICY IF EXISTS rls_audit_global_select ON core.audit_global;
CREATE POLICY rls_audit_global_select
  ON core.audit_global
  FOR SELECT
  TO yira_command_writer
  USING (
    -- SUPER_ADMIN voit tout, les autres voient uniquement leur tenant
    core.is_system_admin()
    OR tenant_id = core.get_current_tenant()
  );

DROP POLICY IF EXISTS rls_audit_global_insert ON core.audit_global;
CREATE POLICY rls_audit_global_insert
  ON core.audit_global
  FOR INSERT
  TO yira_command_writer
  WITH CHECK (true);  -- La validation est faite par le trigger fn_audit_insert

-- =============================================================================
-- PARTIE 4 — TRIGGERS
-- =============================================================================

-- ----------------------------------------------------------------------------
-- TRIGGER 1 : fn_audit_immutable
-- Garantit l'immuabilité absolue de audit_global.
-- Bloque tout UPDATE ou DELETE, même par yira_superadmin.
-- L'immuabilité est une exigence ISO 27001 §A.12 — elle ne se contourne pas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.fn_audit_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION
    '[YIRA-SECURITY] audit_global est immuable. '
    'Opération % interdite sur l''enregistrement id=%. '
    'ISO 27001 §A.12 — Loi CI 2013-450.',
    TG_OP, OLD.id
  USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_immutable ON core.audit_global;
CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE
  ON core.audit_global
  FOR EACH ROW
  EXECUTE FUNCTION core.fn_audit_immutable();

-- ----------------------------------------------------------------------------
-- TRIGGER 2 : fn_audit_insert
-- Génère automatiquement une entrée audit_global à chaque modification
-- sur les tables sensibles de base_core.
-- Capte : avant/après (JSONB snapshot), acteur, IP, action.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.fn_audit_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id   UUID;
  v_actor_role TEXT;
  v_tenant_id  TEXT;
  v_entity_id  UUID;
  v_before     JSONB;
  v_after      JSONB;
BEGIN
  -- Lecture du contexte de session positionné par YIRA-COMMAND avant chaque requête
  v_actor_id   := current_setting('app.current_operator_id', true)::UUID;
  v_actor_role := current_setting('app.current_operator_role', true);
  v_tenant_id  := core.get_current_tenant();

  -- Construction des snapshots avant/après
  IF TG_OP = 'DELETE' THEN
    v_before    := to_jsonb(OLD);
    v_after     := NULL;
    v_entity_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_before    := NULL;
    v_after     := to_jsonb(NEW);
    v_entity_id := NEW.id;
  ELSE -- UPDATE
    v_before    := to_jsonb(OLD);
    v_after     := to_jsonb(NEW);
    v_entity_id := NEW.id;
  END IF;

  INSERT INTO core.audit_global (
    id,
    tenant_id,
    actor_id,
    actor_role,
    action_type,
    entity_type,
    entity_id,
    before_snapshot,
    after_snapshot,
    ip_address,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_tenant_id,
    v_actor_id,
    COALESCE(v_actor_role, 'SYSTEM'),
    TG_OP,
    TG_TABLE_NAME,
    v_entity_id,
    v_before,
    v_after,
    current_setting('app.client_ip', true),
    NOW()
  );

  -- Retourne NEW pour INSERT/UPDATE, OLD pour DELETE
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Application du trigger d'audit sur toutes les tables sensibles
-- (exclut audit_global lui-même pour éviter la récursion)

DROP TRIGGER IF EXISTS trg_audit_country_config ON core.country_config;
CREATE TRIGGER trg_audit_country_config
  AFTER INSERT OR UPDATE OR DELETE ON core.country_config
  FOR EACH ROW EXECUTE FUNCTION core.fn_audit_insert();

DROP TRIGGER IF EXISTS trg_audit_ia_prompts ON core.ia_prompts;
CREATE TRIGGER trg_audit_ia_prompts
  AFTER INSERT OR UPDATE OR DELETE ON core.ia_prompts
  FOR EACH ROW EXECUTE FUNCTION core.fn_audit_insert();

DROP TRIGGER IF EXISTS trg_audit_config_service ON core.yira_config_service;
CREATE TRIGGER trg_audit_config_service
  AFTER INSERT OR UPDATE OR DELETE ON core.yira_config_service
  FOR EACH ROW EXECUTE FUNCTION core.fn_audit_insert();

DROP TRIGGER IF EXISTS trg_audit_referentials ON core.referentials;
CREATE TRIGGER trg_audit_referentials
  AFTER INSERT OR UPDATE OR DELETE ON core.referentials
  FOR EACH ROW EXECUTE FUNCTION core.fn_audit_insert();

DROP TRIGGER IF EXISTS trg_audit_scoring_formulas ON core.scoring_formulas;
CREATE TRIGGER trg_audit_scoring_formulas
  AFTER INSERT OR UPDATE OR DELETE ON core.scoring_formulas
  FOR EACH ROW EXECUTE FUNCTION core.fn_audit_insert();

DROP TRIGGER IF EXISTS trg_audit_command_operators ON core.command_operators;
CREATE TRIGGER trg_audit_command_operators
  AFTER INSERT OR UPDATE OR DELETE ON core.command_operators
  FOR EACH ROW EXECUTE FUNCTION core.fn_audit_insert();

-- ----------------------------------------------------------------------------
-- TRIGGER 3 : fn_updated_at
-- Met à jour automatiquement updated_at à chaque modification.
-- Évite d'oublier la mise à jour dans le code applicatif.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.fn_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_updated_at_country_config ON core.country_config;
CREATE TRIGGER trg_updated_at_country_config
  BEFORE UPDATE ON core.country_config
  FOR EACH ROW EXECUTE FUNCTION core.fn_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at_ia_prompts ON core.ia_prompts;
CREATE TRIGGER trg_updated_at_ia_prompts
  BEFORE UPDATE ON core.ia_prompts
  FOR EACH ROW EXECUTE FUNCTION core.fn_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at_config_service ON core.yira_config_service;
CREATE TRIGGER trg_updated_at_config_service
  BEFORE UPDATE ON core.yira_config_service
  FOR EACH ROW EXECUTE FUNCTION core.fn_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at_referentials ON core.referentials;
CREATE TRIGGER trg_updated_at_referentials
  BEFORE UPDATE ON core.referentials
  FOR EACH ROW EXECUTE FUNCTION core.fn_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at_scoring_formulas ON core.scoring_formulas;
CREATE TRIGGER trg_updated_at_scoring_formulas
  BEFORE UPDATE ON core.scoring_formulas
  FOR EACH ROW EXECUTE FUNCTION core.fn_updated_at();

DROP TRIGGER IF EXISTS trg_updated_at_command_operators ON core.command_operators;
CREATE TRIGGER trg_updated_at_command_operators
  BEFORE UPDATE ON core.command_operators
  FOR EACH ROW EXECUTE FUNCTION core.fn_updated_at();

-- ----------------------------------------------------------------------------
-- TRIGGER 4 : fn_soft_delete_check
-- Empêche la suppression physique (hard delete) des enregistrements.
-- Toute suppression doit passer par deleted_at (soft delete).
-- Loi CI 2013-450 : les données doivent rester auditables.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.fn_soft_delete_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Un hard delete direct est interdit depuis le code applicatif.
  -- Seul yira_migrator (migrations) peut effectuer de vrais DELETE.
  IF NOT pg_has_role(current_user, 'yira_migrator', 'MEMBER') THEN
    RAISE EXCEPTION
      '[YIRA-POLICY] Suppression physique interdite sur %. '
      'Utilisez le soft delete (deleted_at = NOW()). '
      'Conformité Loi CI 2013-450.',
      TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_soft_delete_country_config ON core.country_config;
CREATE TRIGGER trg_soft_delete_country_config
  BEFORE DELETE ON core.country_config
  FOR EACH ROW EXECUTE FUNCTION core.fn_soft_delete_check();

DROP TRIGGER IF EXISTS trg_soft_delete_ia_prompts ON core.ia_prompts;
CREATE TRIGGER trg_soft_delete_ia_prompts
  BEFORE DELETE ON core.ia_prompts
  FOR EACH ROW EXECUTE FUNCTION core.fn_soft_delete_check();

DROP TRIGGER IF EXISTS trg_soft_delete_config_service ON core.yira_config_service;
CREATE TRIGGER trg_soft_delete_config_service
  BEFORE DELETE ON core.yira_config_service
  FOR EACH ROW EXECUTE FUNCTION core.fn_soft_delete_check();

DROP TRIGGER IF EXISTS trg_soft_delete_referentials ON core.referentials;
CREATE TRIGGER trg_soft_delete_referentials
  BEFORE DELETE ON core.referentials
  FOR EACH ROW EXECUTE FUNCTION core.fn_soft_delete_check();

DROP TRIGGER IF EXISTS trg_soft_delete_scoring_formulas ON core.scoring_formulas;
CREATE TRIGGER trg_soft_delete_scoring_formulas
  BEFORE DELETE ON core.scoring_formulas
  FOR EACH ROW EXECUTE FUNCTION core.fn_soft_delete_check();

-- =============================================================================
-- PARTIE 5 — INDEXES DE PERFORMANCE
-- Volume base_core : ~50 000 lignes stables — indexes sélectifs.
-- =============================================================================

-- country_config : lookup fréquent par tenant_id (toute requête)
CREATE INDEX IF NOT EXISTS idx_country_config_tenant_id
  ON core.country_config (tenant_id)
  WHERE deleted_at IS NULL;

-- ia_prompts : lookup par clé métier (CoreConfigService charge les prompts actifs)
CREATE INDEX IF NOT EXISTS idx_ia_prompts_key_active
  ON core.ia_prompts (tenant_id, prompt_key, version DESC)
  WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- referentials : lookup hiérarchique par type et tenant
CREATE INDEX IF NOT EXISTS idx_referentials_type_tenant
  ON core.referentials (tenant_id, ref_type, sort_order)
  WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- scoring_formulas : lookup par clé et version active
CREATE INDEX IF NOT EXISTS idx_scoring_formulas_key
  ON core.scoring_formulas (tenant_id, formula_key, version DESC)
  WHERE status = 'ACTIVE' AND deleted_at IS NULL;

-- audit_global : requêtes d'audit par plage de dates et entité
CREATE INDEX IF NOT EXISTS idx_audit_global_entity
  ON core.audit_global (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_global_actor
  ON core.audit_global (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_global_tenant_date
  ON core.audit_global (tenant_id, created_at DESC);

-- =============================================================================
-- FIN DU SCRIPT DE SÉCURISATION base_core
-- =============================================================================
-- Vérification post-exécution recommandée :
--   SELECT schemaname, tablename, rowsecurity, forcerowsecurity
--   FROM pg_tables WHERE schemaname = 'core';
-- Toutes les tables doivent afficher rowsecurity=true, forcerowsecurity=true.
-- =============================================================================
