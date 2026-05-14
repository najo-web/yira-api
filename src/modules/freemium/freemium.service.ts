// =============================================================================
// YIRA V3.0 — src/modules/freemium/freemium.service.ts
// Najo Technologies — CONFIDENTIEL
// Niveau 4 (N4) — Filtre freemium par niveau d acces
// NOTE : base_sync sera migrée au sprint suivant.
//        En attendant, le service retourne filtreComplet() par defaut.
// =============================================================================
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export type NiveauAcces = 'FREE' | 'BASIC' | 'PREMIUM';
export interface FiltreFreemium {
  afficher_salaires: boolean;
  afficher_pii_complet: boolean;
  afficher_acteurs_ci: boolean;
  afficher_pdf: boolean;
  afficher_sara: boolean;
  message_upgrade?: string;
}

@Injectable()
export class FreemiumService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FreemiumService.name);
  private pool!: Pool;
  private syncReady = false;
  private configCache: Record<string, boolean> = {};
  private cacheExpiry: Record<string, number> = {};
  private readonly CACHE_TTL = 30000;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('DATABASE_URL_SYNC');
    if (!url) {
      this.logger.warn('DATABASE_URL_SYNC non definie — FreemiumService en mode degraded.');
      return;
    }
    try {
      this.pool = new Pool({ connectionString: url });
      const client = await this.pool.connect();
      client.release();
      this.syncReady = true;
      this.logger.log('FreemiumService connecte a base_sync');
    } catch (e: any) {
      this.logger.warn('FreemiumService — base_sync non disponible: ' + e.message);
      this.logger.warn('Mode degrade actif — filtreComplet() retourne par defaut.');
    }
  }

  async onModuleDestroy() {
    if (this.pool) await this.pool.end();
  }

  async obtenirFiltre(country_code: string, niveau: NiveauAcces): Promise<FiltreFreemium> {
    if (!this.syncReady) return this.filtreComplet();
    const actif = await this.estFreemiumActif(country_code);
    if (!actif) return this.filtreComplet();
    if (niveau === 'PREMIUM') return this.filtreComplet();
    if (niveau === 'BASIC')   return this.filtreBasic();
    return this.filtreFree();
  }

  async estFreemiumActif(country_code: string): Promise<boolean> {
    if (!this.syncReady) return false;
    const now = Date.now();
    if (this.configCache[country_code] !== undefined && this.cacheExpiry[country_code] > now)
      return this.configCache[country_code];
    try {
      const res = await this.pool.query(
        'SELECT freemium_actif FROM yira_config_pays WHERE country_code = $1',
        [country_code]
      );
      const val = res.rows.length > 0 ? res.rows[0].freemium_actif : false;
      this.configCache[country_code] = val;
      this.cacheExpiry[country_code] = now + this.CACHE_TTL;
      return val;
    } catch (e: any) {
      this.logger.warn('[Freemium] Erreur BDD: ' + e.message);
      return false;
    }
  }

  filtrerResultatOp(data: any, filtre: FiltreFreemium): any {
    const result = JSON.parse(JSON.stringify(data));
    if (!filtre.afficher_salaires && result.metiers_ci) {
      result.metiers_ci = result.metiers_ci.map((m: any) => {
        delete m.salaire_min; delete m.salaire_max;
        m._upgrade = 'BASIC 500 FCFA pour voir les salaires';
        return m;
      });
    }
    if (!filtre.afficher_pii_complet && result.pii) {
      result.pii = result.pii.filter((p: any) => p.delai === 'J+30');
      result._pii_upgrade = 'BASIC pour voir J+90 et J+180';
    }
    if (!filtre.afficher_acteurs_ci && result.metiers_ci) {
      result.metiers_ci = result.metiers_ci.map((m: any) => { delete m.acteurs_ci; return m; });
    }
    if (!filtre.afficher_sara) delete result.sara_eligible;
    if (filtre.message_upgrade) {
      result._upgrade_message = filtre.message_upgrade;
      result._upgrade_lien = 'yira.africa/premium';
    }
    return result;
  }

  invaliderCache(cc: string) {
    delete this.configCache[cc];
    delete this.cacheExpiry[cc];
  }

  private filtreComplet = (): FiltreFreemium => ({ afficher_salaires: true, afficher_pii_complet: true, afficher_acteurs_ci: true, afficher_pdf: true, afficher_sara: true });
  private filtreBasic   = (): FiltreFreemium => ({ afficher_salaires: true, afficher_pii_complet: false, afficher_acteurs_ci: true, afficher_pdf: false, afficher_sara: true, message_upgrade: 'PREMIUM 2000 FCFA pour J+90 et J+180' });
  private filtreFree    = (): FiltreFreemium => ({ afficher_salaires: false, afficher_pii_complet: false, afficher_acteurs_ci: false, afficher_pdf: false, afficher_sara: false, message_upgrade: 'BASIC 500 FCFA pour voir les salaires' });
}