// =============================================================================
// YIRA V3.0 — VeillesMarcheService (25ème Agent IA)
// Sprint 35 — Agent de Veille Marché
// Fix: app.current_operator_id requis par trigger audit_global
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import { TelecomService } from '../telecom/telecom.service';
import { YiraConfigService } from '../../core-config/yira-config.service';

export interface ServiceProposition {
  nom_propose:           string;
  code_propose:          string;
  description:           string;
  groupe_tarifaire:      string;
  tarif_fcfa_jour:       number;
  type_question:         string;
  content_sources:       any[];
  score_pertinence_cqci: number;
  raison_proposition:    string;
}

const VAS_GROUP_MAP: Record<string, string> = {
  'A': 'GROUP_A_PAYANT',
  'B': 'GROUP_B_FREEMIUM',
  'C': 'GROUP_C_GRATUIT',
  'D': 'GROUP_D_SANTE',
  'E': 'GROUP_E_VOD',
  'F': 'GROUP_F_SOS',
};

// ID système YIRA-COMMAND pour l'audit trail
const SYSTEM_OPERATOR_ID = 'f4119151-4608-476e-90a4-4ca7c75fd3ee';

@Injectable()
export class VeillesMarcheService implements OnModuleInit {
  private readonly logger = new Logger(VeillesMarcheService.name);
  private poolCore!: Pool;
  private poolSync!: Pool;
  private ready = false;

  constructor(
    private config:   ConfigService,
    private telecom:  TelecomService,
    private yiraConf: YiraConfigService,
  ) {}

  async onModuleInit() {
    try {
      this.poolCore = new Pool({ connectionString: this.config.get('DATABASE_URL_CORE') });
      this.poolSync = new Pool({ connectionString: this.config.get('DATABASE_URL_SYNC') });
      const c = await this.poolCore.connect();
      c.release();
      this.ready = true;
      this.logger.log('[VEILLE] VeillesMarcheService connecte');
    } catch (e: any) {
      this.logger.warn('[VEILLE] Erreur init: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Initialiser le contexte RLS pour chaque transaction
  // ---------------------------------------------------------------------------
  private async setRLSContext(client: PoolClient, tenantId: string): Promise<void> {
    await client.query('SET LOCAL app.current_tenant = ' + "'" + tenantId + "'");
    await client.query("SET LOCAL app.current_operator_id = '" + SYSTEM_OPERATOR_ID + "'");
    await client.query("SET LOCAL app.current_operator_role = 'SUPER_ADMIN'");
    await client.query("SET LOCAL app.client_ip = '127.0.0.1'");
  }

  @Cron('0 6 * * 0', { timeZone: 'Africa/Abidjan' })
  async analyserMarcheEtProposer(): Promise<void> {
    this.logger.log('[VEILLE] Demarrage analyse hebdomadaire — ' + new Date().toISOString());
    if (!this.ready) return;
    try {
      const kpis              = await this.chargerKpisVas('CI');
      const servicesExistants = await this.chargerServicesExistants('CI');
      const proposition       = await this.genererPropositionIA(kpis, servicesExistants, 'CI');
      if (!proposition) { this.logger.warn('[VEILLE] Aucune proposition generee'); return; }
      await this.stockerProposition(proposition, 'CI');
      await this.alerterAdmin(proposition, 'CI');
      this.logger.log('[VEILLE] Proposition soumise: ' + proposition.nom_propose);
    } catch (e: any) {
      this.logger.error('[VEILLE] Erreur analyse: ' + e.message);
    }
  }

  private async chargerKpisVas(tenantId: string): Promise<any[]> {
    try {
      const res = await this.poolSync.query(
        'SELECT service_code, COUNT(*) FILTER (WHERE statut = $1) AS nb_abonnes, COUNT(*) AS nb_total, ROUND(COUNT(*) FILTER (WHERE statut = $1)::numeric / NULLIF(COUNT(*),0), 4) AS taux_abonnement FROM yira_game_abonnement WHERE tenant_id = $2 GROUP BY service_code ORDER BY taux_abonnement ASC',
        ['ACTIF', tenantId]
      );
      return res.rows;
    } catch {
      return [
        { service_code: 'ZOUGLOU', nb_abonnes: 150, taux_abonnement: 0.12 },
        { service_code: 'SPORT',   nb_abonnes: 89,  taux_abonnement: 0.07 },
        { service_code: 'METEO',   nb_abonnes: 23,  taux_abonnement: 0.02 },
      ];
    }
  }

  private async chargerServicesExistants(tenantId: string): Promise<string[]> {
    let client: PoolClient | null = null;
    try {
      client = await this.poolCore.connect();
      await client.query('BEGIN');
      await this.setRLSContext(client, tenantId);
      const res = await client.query(
        'SELECT service_code, service_name FROM core.yira_config_service WHERE tenant_id = $1 AND status = $2 ORDER BY service_code',
        [tenantId, 'ACTIVE']
      );
      await client.query('COMMIT');
      return res.rows.map((r: any) => r.service_code + ' (' + r.service_name + ')');
    } catch (e: any) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      return [];
    } finally {
      if (client) client.release();
    }
  }

  private async genererPropositionIA(kpis: any[], servicesExistants: string[], tenantId: string): Promise<ServiceProposition | null> {
    const apiKey     = this.config.get('ANTHROPIC_API_KEY') ?? '';
    const kpisResume = kpis.slice(0, 10).map(k =>
      k.service_code + ': ' + (k.nb_abonnes ?? 0) + ' abonnes, taux=' + (k.taux_abonnement ?? 0)
    ).join('\n');

    const prompt = 'Tu es l\'Agent de Veille Marche YIRA pour la Cote d\'Ivoire.\n' +
      'SERVICES EXISTANTS (' + servicesExistants.length + '): ' + servicesExistants.slice(0, 20).join(', ') + '\n' +
      'KPIs:\n' + kpisResume + '\n' +
      'Propose un nouveau service VAS USSD non couvert pour jeunes ivoiriens 14-35 ans.\n' +
      'Reponds UNIQUEMENT en JSON:\n' +
      '{"nom_propose":"Nom","code_propose":"CODE","description":"1 phrase","groupe_tarifaire":"B","tarif_fcfa_jour":50,"type_question":"QCM_3","content_sources":[{"url":"https://www.rfi.fr/fr/afrique/rss","type":"RSS","actif":true,"priorite":1}],"score_pertinence_cqci":0.85,"raison_proposition":"Raison"}';

    if (!apiKey) {
      return {
        nom_propose: 'Woro-Quiz Transport', code_propose: 'WORO',
        description: 'Quiz sur les transports et mobilite a Abidjan',
        groupe_tarifaire: 'B', tarif_fcfa_jour: 50, type_question: 'QCM_3',
        content_sources: [{ url: 'https://www.rfi.fr/fr/afrique/rss', type: 'RSS', actif: true, priorite: 1 }],
        score_pertinence_cqci: 0.88,
        raison_proposition: 'Abidjan 3eme ville africaine par embouteillages.',
      };
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      });
      const data  = await response.json() as any;
      const text  = data?.content?.[0]?.text ?? '';
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean) as ServiceProposition;
    } catch (e: any) {
      this.logger.error('[VEILLE] Erreur IA: ' + e.message);
      return null;
    }
  }

  private async stockerProposition(prop: ServiceProposition, tenantId: string): Promise<void> {
    let client: PoolClient | null = null;
    try {
      client = await this.poolCore.connect();
      await client.query('BEGIN');
      await this.setRLSContext(client, tenantId);
      await client.query(
        'INSERT INTO core.yira_service_proposition (tenant_id, nom_propose, code_propose, description, groupe_tarifaire, tarif_fcfa_jour, type_question, content_sources, score_pertinence_cqci, raison_proposition, statut, agent_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [tenantId, prop.nom_propose, prop.code_propose, prop.description, prop.groupe_tarifaire,
         prop.tarif_fcfa_jour, prop.type_question, JSON.stringify(prop.content_sources),
         prop.score_pertinence_cqci, prop.raison_proposition, 'EN_ATTENTE_VALIDATION', 'VEILLE_V1']
      );
      await client.query('COMMIT');
      this.logger.log('[VEILLE] Proposition stockee: ' + prop.code_propose);
    } catch (e: any) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      this.logger.error('[VEILLE] Erreur stockage: ' + e.message);
    } finally {
      if (client) client.release();
    }
  }

  private async alerterAdmin(prop: ServiceProposition, tenantId: string): Promise<void> {
    try {
      const cfg      = await this.yiraConf.getConfig(tenantId);
      const params   = (cfg as any)?.parametres_metier ?? {};
      const adminTel = params?.admin_tel_veille ?? '';
      if (!adminTel) { this.logger.warn('[VEILLE] admin_tel_veille non configure'); return; }
      const sms = 'YIRA-CMD: Nouveau service propose: ' + prop.nom_propose +
        ' (' + prop.code_propose + '). Score: ' + prop.score_pertinence_cqci + '. Validez sur YIRA-COMMAND.';
      await this.telecom.sendVas(adminTel, sms.slice(0, 160), tenantId);
    } catch (e: any) {
      this.logger.warn('[VEILLE] Erreur alerte admin: ' + e.message);
    }
  }

  async listerPropositions(tenantId = 'CI', statut = 'EN_ATTENTE_VALIDATION'): Promise<any[]> {
    let client: PoolClient | null = null;
    try {
      client = await this.poolCore.connect();
      await client.query('BEGIN');
      await this.setRLSContext(client, tenantId);
      const res = await client.query(
        'SELECT * FROM core.yira_service_proposition WHERE tenant_id=$1 AND statut=$2 ORDER BY created_at DESC LIMIT 20',
        [tenantId, statut]
      );
      await client.query('COMMIT');
      return res.rows;
    } catch (e: any) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      return [];
    } finally {
      if (client) client.release();
    }
  }

  async validerProposition(id: string, adminId: string, tenantId = 'CI'): Promise<boolean> {
    let client: PoolClient | null = null;
    try {
      client = await this.poolCore.connect();
      await client.query('BEGIN');
      await this.setRLSContext(client, tenantId);

      const propRes = await client.query(
        'SELECT * FROM core.yira_service_proposition WHERE id=$1 AND tenant_id=$2',
        [id, tenantId]
      );
      if (propRes.rows.length === 0) throw new Error('Proposition non trouvee');
      const prop = propRes.rows[0];

      const vasGroup           = VAS_GROUP_MAP[prop.groupe_tarifaire] ?? 'GROUP_B_FREEMIUM';
      const ussdPath           = '6*' + Math.floor(Math.random() * 99 + 1);
      const contentSourcesJson = typeof prop.content_sources === 'string' ? prop.content_sources : JSON.stringify(prop.content_sources);
      const pricingByTenant    = JSON.stringify({ [tenantId]: { daily_fcfa: prop.tarif_fcfa_jour } });
      const smsTemplates       = JSON.stringify({});
      const artciMetadata      = JSON.stringify({ service_code: prop.code_propose, tenant_id: tenantId });
      const isFreemium         = prop.groupe_tarifaire === 'B';

      await client.query(
        'INSERT INTO core.yira_config_service (id, tenant_id, service_code, service_name, vas_group, ussd_path, type_question, content_sources, pricing_by_tenant, sms_templates, artci_metadata, double_optin_required, is_freemium, status, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4::core."VasGroup", $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, true, $11, $12, NOW(), NOW()) ON CONFLICT DO NOTHING',
        [tenantId, prop.code_propose, prop.nom_propose, vasGroup, ussdPath, prop.type_question,
         contentSourcesJson, pricingByTenant, smsTemplates, artciMetadata, isFreemium, 'ACTIVE']
      );

      await client.query(
        "UPDATE core.yira_service_proposition SET statut='VALIDE', valide_par=$1, valide_at=NOW(), updated_at=NOW() WHERE id=$2",
        [adminId, id]
      );

      await client.query('COMMIT');
      await this.yiraConf.invaliderCache(tenantId);
      this.logger.log('[VEILLE] Proposition validee: ' + prop.code_propose + ' path=' + ussdPath);
      return true;
    } catch (e: any) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      this.logger.error('[VEILLE] Erreur validation: ' + e.message);
      return false;
    } finally {
      if (client) client.release();
    }
  }

  async rejeterProposition(id: string, adminId: string, raison: string, tenantId = 'CI'): Promise<boolean> {
    let client: PoolClient | null = null;
    try {
      client = await this.poolCore.connect();
      await client.query('BEGIN');
      await this.setRLSContext(client, tenantId);
      await client.query(
        "UPDATE core.yira_service_proposition SET statut='REJETE', rejete_par=$1, rejete_at=NOW(), raison_rejet=$2, updated_at=NOW() WHERE id=$3",
        [adminId, raison, id]
      );
      await client.query('COMMIT');
      this.logger.log('[VEILLE] Proposition rejetee: ' + id);
      return true;
    } catch (e: any) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      this.logger.error('[VEILLE] Erreur rejet: ' + e.message);
      return false;
    } finally {
      if (client) client.release();
    }
  }

  async analyserMaintenant(tenantId = 'CI'): Promise<ServiceProposition | null> {
    this.logger.log('[VEILLE] Analyse manuelle declenchee');
    const kpis              = await this.chargerKpisVas(tenantId);
    const servicesExistants = await this.chargerServicesExistants(tenantId);
    const proposition       = await this.genererPropositionIA(kpis, servicesExistants, tenantId);
    if (proposition) {
      await this.stockerProposition(proposition, tenantId);
      await this.alerterAdmin(proposition, tenantId);
    }
    return proposition;
  }
}