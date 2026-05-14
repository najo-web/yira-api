// =============================================================================
// YIRA V3.0 â€” CoreConfig Types
// Interfaces TypeScript pour les entitÃ©s base_core exposÃ©es aux modules mÃ©tier.
// Ces types sont la seule surface de contact entre N4 et base_core.
// ZÃ©ro import Prisma direct dans les modules mÃ©tier â€” ils utilisent ces types.
// =============================================================================

// ---------------------------------------------------------------------------
// CountryConfig â€” Configuration tenant pays
// ---------------------------------------------------------------------------
export interface VasPricing {
  GROUP_A_PAYANT: { default_fcfa: number; premium_fcfa: number; services_75?: string[] };
  GROUP_B_FREEMIUM: { free_questions_per_day: number; paid_bundle_fcfa?: number };
  GROUP_C_GRATUIT: { cost_per_interaction_fcfa: number; financing?: string };
  GROUP_D_SANTE: { default_fcfa: number; financing?: string };
}

export interface MobileMoneyProvider {
  name: string;
  code: string;
  active: boolean;
  priority: number;
}

export interface TelecomProviderConfig {
  primary: string;
  fallback: string;
  timeout_ms: number;
  auto_failover: boolean;
  ussd_session_ttl_seconds: number;
}

export interface CountryConfigDto {
  id: string;
  tenantId: string;
  countryName: string;
  ussdShortCode: string;
  currencyCode: string;
  currencyMinorUnits: number;
  vasPricing: VasPricing;
  mobileMoneyProviders: MobileMoneyProvider[];
  smsSenderIds: Record<string, string>;
  telecomProviders: TelecomProviderConfig;
}

// ---------------------------------------------------------------------------
// IaPrompt â€” Prompt IA versionnÃ©
// ---------------------------------------------------------------------------
export interface PromptGuardrails {
  forbidden_topics: string[];
  max_chars_ussd: number;
  max_chars_web: number;
  required_closing_question: boolean;
  sos_trigger_keywords: string[];
  sos_redirect_module: string;
  output_validation: {
    min_chars: number;
    must_contain_action: boolean;
    must_end_with_question: boolean;
  };
}

export interface CqciFilters {
  cultural_refs_allowed: string[];
  dialect_level: string;
  formality_level: string;
  avoid_cultural_stereotypes: boolean;
  validate_against_cqci_norms: boolean;
  cqci_min_score_to_publish: number;
}

export interface IaPromptDto {
  id: string;
  tenantId: string;
  promptKey: string;
  moduleTarget: string;
  agentName: string;
  promptSystem: string;
  promptUserTemplate: string;
  guardrails: PromptGuardrails;
  cqciFilters: CqciFilters;
  version: number;
}

// ---------------------------------------------------------------------------
// ScoringFormula â€” Formule de scoring versionnÃ©e
// ---------------------------------------------------------------------------
export interface ScoringFormulaDto {
  id: string;
  tenantId: string;
  formulaKey: string;
  engineTarget: string;
  coefficients: Record<string, number>;
  thresholds: Record<string, { min: number; max: number; action: string }>;
  formulaExpression: string;
  version: number;
}

// ---------------------------------------------------------------------------
// YiraConfigService â€” Configuration service VAS
// ---------------------------------------------------------------------------
export interface VasServiceDto {
  id: string;
  tenantId: string;
  serviceCode: string;
  serviceName: string;
  ussdPath: string;
  vasGroup: string;
  pricingByTenant: Record<string, { daily_fcfa: number; billing_cycle?: string }>;
  smsTemplates: Record<string, string>;
  artciMetadata: Record<string, unknown>;
  doubleOptinRequired: boolean;
  isFreemium: boolean;
}

// ---------------------------------------------------------------------------
// Referential â€” RÃ©fÃ©rentiel mÃ©tier hiÃ©rarchique
// ---------------------------------------------------------------------------
export interface ReferentialDto {
  id: string;
  tenantId: string;
  refType: string;
  refCode: string;
  labelFr: string;
  labelLocal: string | null;
  metadata: Record<string, unknown>;
  sortOrder: number;
  parentId: string | null;
  children?: ReferentialDto[];
}

// ---------------------------------------------------------------------------
// Cache keys â€” ClÃ©s Redis standardisÃ©es pour base_core
// Format : core:{tenant}:{domaine}:{clÃ©}
// ---------------------------------------------------------------------------
export const CORE_CACHE_KEYS = {
  countryConfig: (tenantId: string) =>
    `core:${tenantId}:country_config`,
  iaPrompt: (tenantId: string, promptKey: string) =>
    `core:${tenantId}:ia_prompt:${promptKey}`,
  scoringFormula: (tenantId: string, formulaKey: string) =>
    `core:${tenantId}:scoring_formula:${formulaKey}`,
  vasService: (tenantId: string, serviceCode: string) =>
    `core:${tenantId}:vas_service:${serviceCode}`,
  referentials: (tenantId: string, refType: string) =>
    `core:${tenantId}:referentials:${refType}`,
} as const;

// TTL Redis en secondes â€” L3 Â§3.2 (rÃ©fÃ©rentiels stables, cache long)
export const CORE_CACHE_TTL = {
  COUNTRY_CONFIG: 3600,      // 1 heure â€” change rarement
  IA_PROMPT: 1800,           // 30 min â€” peut Ãªtre mis Ã  jour par AI Studio
  SCORING_FORMULA: 3600,     // 1 heure â€” versionnÃ©, stable
  VAS_SERVICE: 3600,         // 1 heure â€” stable
  REFERENTIALS: 7200,        // 2 heures â€” trÃ¨s stable
} as const;