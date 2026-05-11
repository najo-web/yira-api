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
  private pool: Pool;
  private configCache: Record<string, boolean> = {};
  private cacheExpiry: Record<string, number> = {};
  private readonly CACHE_TTL = 30000;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.pool = new Pool({ connectionString: this.config.get('DATABASE_SYNC_URL') });
    // Test connexion
    const client = await this.pool.connect();
    client.release();
    this.logger.log('OK FreemiumService connecte a base_sync (pg)');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async obtenirFiltre(country_code: string, niveau: NiveauAcces): Promise<FiltreFreemium> {
    const actif = await this.estFreemiumActif(country_code);
    this.logger.log('[Freemium] ' + country_code + ' niveau=' + niveau + ' actif=' + actif);
    if (!actif) return this.filtreComplet();
    if (niveau === 'PREMIUM') return this.filtreComplet();
    if (niveau === 'BASIC') return this.filtreBasic();
    return this.filtreFree();
  }

  async estFreemiumActif(country_code: string): Promise<boolean> {
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
      this.logger.log('[Freemium] BDD lu: ' + country_code + ' freemium_actif=' + val);
      return val;
    } catch (e: any) {
      this.logger.warn('[Freemium] Erreur: ' + e.message);
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
    this.logger.log('[Freemium] Cache invalide pour ' + cc);
  }

  private filtreComplet = (): FiltreFreemium => ({ afficher_salaires:true, afficher_pii_complet:true, afficher_acteurs_ci:true, afficher_pdf:true, afficher_sara:true });
  private filtreBasic   = (): FiltreFreemium => ({ afficher_salaires:true, afficher_pii_complet:false, afficher_acteurs_ci:true, afficher_pdf:false, afficher_sara:true, message_upgrade:'PREMIUM 2000 FCFA pour J+90 et J+180' });
  private filtreFree    = (): FiltreFreemium => ({ afficher_salaires:false, afficher_pii_complet:false, afficher_acteurs_ci:false, afficher_pdf:false, afficher_sara:false, message_upgrade:'BASIC 500 FCFA pour voir les salaires' });
}