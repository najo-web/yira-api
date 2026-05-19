// =============================================================================
// YIRA V3.0 — EtudeService (ONC-CI Dashboard)
// Sprint 47 — Observatoire National des Compétences CI
// L3 §4.7 Bloqueur B2G — KPIs PND/ODD pour ministères et bailleurs
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class EtudeService implements OnModuleInit {
  private readonly logger = new Logger(EtudeService.name);
  private pool!: Pool;
  private ready = false;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_ETUDE') });
      const c    = await this.pool.connect();
      c.release();
      this.ready = true;
      this.logger.log('[ONC-CI] EtudeService connecte a base_etude — Dashboard KPIs actif');
    } catch (e: any) {
      this.logger.warn('[ONC-CI] Erreur init: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // DASHBOARD ONC-CI — Vue consolidée pour ministères
  // ---------------------------------------------------------------------------
  async obtenirDashboard(tenantId = 'CI', periode = '2025'): Promise<any> {
    if (!this.ready) return this.dashboardMock();

    try {
      const [kpisPND, kpisODD, rapports] = await Promise.all([
        this.obtenirKpisPND(tenantId, periode),
        this.obtenirKpisODD(tenantId, periode),
        this.compterRapports(tenantId),
      ]);

      const tauxRealisationPND = this.calculerTauxRealisation(kpisPND);
      const tauxRealisationODD = this.calculerTauxRealisation(kpisODD);

      return {
        dashboard:    'ONC-CI — Observatoire National des Competences CI',
        periode,
        tenant:       tenantId,
        genere_le:    new Date().toISOString(),
        synthese: {
          kpis_pnd_total:         kpisPND.length,
          kpis_pnd_atteints:      kpisPND.filter((k: any) => k.statut === 'ATTEINT').length,
          taux_realisation_pnd:   tauxRealisationPND + '%',
          kpis_odd_total:         kpisODD.length,
          kpis_odd_atteints:      kpisODD.filter((k: any) => k.statut === 'ATTEINT').length,
          taux_realisation_odd:   tauxRealisationODD + '%',
          rapports_generes:       rapports,
        },
        kpis_pnd:     kpisPND,
        kpis_odd:     kpisODD,
        conformite:   'ISO 20252 + Standards ODD Nations Unies',
        note_legale:  'Donnees certifiees YIRA V3.0 — Najo Technologies CI — Export autorise ministeres signataires',
      };
    } catch (e: any) {
      this.logger.error('[ONC-CI] Erreur dashboard: ' + e.message);
      return this.dashboardMock();
    }
  }

  // ---------------------------------------------------------------------------
  // KPIs PND
  // ---------------------------------------------------------------------------
  async obtenirKpisPND(tenantId = 'CI', periode = '2025'): Promise<any[]> {
    if (!this.ready) return [];
    const res = await this.pool.query(
      'SELECT *, CASE WHEN valeur_reelle >= valeur_cible THEN \'ATTEINT\' WHEN valeur_reelle >= valeur_cible * 0.75 THEN \'EN_COURS\' ELSE \'A_RISQUE\' END as statut FROM yira_kpi_pnd WHERE tenant_id=$1 AND periode=$2 ORDER BY axe_pnd, indicateur_code',
      [tenantId, periode]
    );
    return res.rows;
  }

  // ---------------------------------------------------------------------------
  // KPIs ODD
  // ---------------------------------------------------------------------------
  async obtenirKpisODD(tenantId = 'CI', periode = '2025', oddNumero?: number): Promise<any[]> {
    if (!this.ready) return [];
    let query = 'SELECT *, CASE WHEN valeur_reelle >= valeur_cible THEN \'ATTEINT\' WHEN valeur_reelle >= valeur_cible * 0.75 THEN \'EN_COURS\' ELSE \'A_RISQUE\' END as statut FROM yira_kpi_odd WHERE tenant_id=$1 AND periode=$2';
    const params: any[] = [tenantId, periode];
    if (oddNumero) { params.push(oddNumero); query += ' AND odd_numero=$3'; }
    query += ' ORDER BY odd_numero, cible_code';
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  // ---------------------------------------------------------------------------
  // METTRE À JOUR UN KPI (depuis terrain ou système)
  // ---------------------------------------------------------------------------
  async mettreAJourKPI(
    type:             'PND' | 'ODD',
    indicateurCode:   string,
    valeurReelle:     number,
    source:           string,
    tenantId = 'CI',
  ): Promise<any> {
    if (!this.ready) return { success: false, message: 'Base non disponible' };

    const table = type === 'PND' ? 'yira_kpi_pnd' : 'yira_kpi_odd';
    await this.pool.query(
      'UPDATE ' + table + ' SET valeur_reelle=$1, source=$2 WHERE indicateur_code=$3 AND tenant_id=$4',
      [valeurReelle, source, indicateurCode, tenantId]
    );

    this.logger.log('[ONC-CI] KPI mis a jour: ' + indicateurCode + ' = ' + valeurReelle);
    return { success: true, indicateur_code: indicateurCode, valeur_reelle: valeurReelle, source };
  }

  // ---------------------------------------------------------------------------
  // GÉNÉRER RAPPORT INSTITUTIONNEL
  // ---------------------------------------------------------------------------
  async genererRapport(tenantId = 'CI', periode = '2025', typeRapport = 'TRIMESTRIEL'): Promise<any> {
    const dashboard = await this.obtenirDashboard(tenantId, periode);

    const rapport = {
      titre:          'Rapport ONC-CI — Observatoire National des Competences CI',
      type:           typeRapport,
      periode,
      tenant:         tenantId,
      genere_le:      new Date().toISOString(),
      genere_par:     'YIRA V3.0 — Najo Technologies CI',
      synthese_pnd:   dashboard.synthese,
      kpis_critiques: [
        ...dashboard.kpis_pnd.filter((k: any) => k.statut === 'A_RISQUE').slice(0, 5),
        ...dashboard.kpis_odd.filter((k: any) => k.statut === 'A_RISQUE').slice(0, 5),
      ],
      recommandations: [
        'Accelerer le deploiement YIRA dans les etablissements secondaires CI (cible PND_EDU_04)',
        'Renforcer partenariats employeurs pour ameliorer taux insertion ODD 8.5',
        'Etendre YIRA aux regions rurales pour reduire inegalite acces orientation (ODD 10.2)',
        'Formaliser convention MENET-YIRA pour integration curricula orientation',
        'Activer module ONC-CI dans 3 ministeres pilotes avant fin 2025',
      ],
      conformite:     'ISO 20252 · Standards ODD Nations Unies · Loi CI 2013-450',
      classification: 'DIFFUSION CONTROLEE — Ministeres signataires uniquement',
    };

    // Sauvegarder le rapport
    if (this.ready) {
      try {
        await this.pool.query(
          'INSERT INTO yira_rapport_genere (id, tenant_id, type_rapport, periode, contenu, genere_le) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())',
          [tenantId, typeRapport, periode, JSON.stringify(rapport)]
        );
      } catch (e: any) {
        this.logger.warn('[ONC-CI] Erreur sauvegarde rapport: ' + e.message);
      }
    }

    this.logger.log('[ONC-CI] Rapport genere: ' + typeRapport + ' / ' + periode);
    return rapport;
  }

  // ---------------------------------------------------------------------------
  // EXPORT CSV pour ministères
  // ---------------------------------------------------------------------------
  async exporterCSV(tenantId = 'CI', periode = '2025'): Promise<string> {
    const kpisPND = await this.obtenirKpisPND(tenantId, periode);
    const kpisODD = await this.obtenirKpisODD(tenantId, periode);

    const lines: string[] = [
      'TYPE,AXE/ODD,CODE,LIBELLE,CIBLE,REEL,UNITE,STATUT,SOURCE,PERIODE',
    ];

    for (const k of kpisPND) {
      lines.push(['PND', k.axe_pnd, k.indicateur_code, '"' + k.libelle + '"', k.valeur_cible, k.valeur_reelle ?? 0, k.unite, k.statut, k.source, k.periode].join(','));
    }
    for (const k of kpisODD) {
      lines.push(['ODD' + k.odd_numero, k.cible_code, k.indicateur_code, '"' + k.libelle + '"', k.valeur_cible, k.valeur_reelle ?? 0, k.unite, k.statut, k.source, k.periode].join(','));
    }

    // Journaliser l'export
    if (this.ready) {
      try {
        await this.pool.query(
          'INSERT INTO yira_export_audit (id, tenant_id, type_export, nb_lignes, periode, created_at) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())',
          [tenantId, 'CSV_KPI', lines.length - 1, periode]
        );
      } catch (e: any) {
        this.logger.warn('[ONC-CI] Erreur audit export: ' + e.message);
      }
    }

    this.logger.log('[ONC-CI] Export CSV: ' + (lines.length - 1) + ' KPIs');
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  private calculerTauxRealisation(kpis: any[]): number {
    if (kpis.length === 0) return 0;
    const atteints = kpis.filter(k => k.statut === 'ATTEINT').length;
    return Math.round((atteints / kpis.length) * 100);
  }

  private async compterRapports(tenantId: string): Promise<number> {
    try {
      const res = await this.pool.query('SELECT COUNT(*) FROM yira_rapport_genere WHERE tenant_id=$1', [tenantId]);
      return parseInt(res.rows[0].count);
    } catch { return 0; }
  }

  private dashboardMock(): any {
    return {
      dashboard: 'ONC-CI Mock', periode: '2025', tenant: 'CI',
      synthese: { kpis_pnd_total: 10, kpis_odd_total: 10, taux_realisation_pnd: '30%', taux_realisation_odd: '20%' },
      conformite: 'ISO 20252',
    };
  }

  isReady(): boolean { return this.ready; }
}