// =============================================================================
// YIRA V3.0 — SosService
// Sprint 37 — Chiffrement AES-256 (Loi 2013-450 CI)
// Colonnes réelles : telephone_hash, description_chiffree, localisation_chiffree
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import * as crypto from 'crypto';

export interface SignalementSOS {
  telephone:     string;
  type_urgence:  string;
  description:   string;
  localisation?: string;
  niveau_risque?: string;
  tenant_id?:    string;
}

export interface SignalementSOSResult {
  id:          string;
  statut:      string;
  message:     string;
  created_at:  string;
}

@Injectable()
export class SosService implements OnModuleInit {
  private readonly logger       = new Logger(SosService.name);
  private pool!: Pool;
  private ready                 = false;
  private readonly AES_KEY:       Buffer;
  private readonly AES_IV_LENGTH  = 16;

  constructor(private config: ConfigService) {
    const keyHex = config.get('SOS_AES_KEY') ?? '';
    if (keyHex && keyHex.length >= 64) {
      this.AES_KEY = Buffer.from(keyHex.slice(0, 64), 'hex');
    } else {
      this.AES_KEY = crypto.scryptSync('YIRA_SOS_DEV_KEY_2026', 'salt_najo_ci', 32);
      this.logger.warn('[SOS] Cle AES dev utilisee — configurer SOS_AES_KEY en production');
    }
  }

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_SOS') });
      const c    = await this.pool.connect();
      c.release();
      this.ready = true;
      this.logger.log('[SOS] SosService connecte a base_sos — AES-256 actif');
    } catch (e: any) {
      this.logger.warn('[SOS] Erreur init: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // CRÉER SIGNALEMENT — AES-256 sur description et localisation
  // telephone_hash = SHA-256 (non réversible, pour recherche uniquement)
  // ---------------------------------------------------------------------------
  async creerSignalement(data: SignalementSOS): Promise<SignalementSOSResult> {
    const tenantId = data.tenant_id ?? 'CI';

    // Hash SHA-256 du téléphone (non réversible — pour recherche)
    const telephoneHash       = crypto.createHash('sha256').update(data.telephone).digest('hex');
    // Chiffrement AES-256-CBC des données sensibles
    const descriptionChiffree = this.chiffrer(data.description);
    const localisationChiffree = data.localisation ? this.chiffrer(data.localisation) : null;
    const niveauRisque        = data.niveau_risque ?? 'MOYEN';

    try {
      const res = await this.pool.query(`
        INSERT INTO yira_sos_signalement
          (tenant_id, telephone_hash, type_urgence,
           description_chiffree, localisation_chiffree,
           niveau_risque, statut, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'NOUVEAU', NOW(), NOW())
        RETURNING id, statut, created_at
      `, [tenantId, telephoneHash, data.type_urgence,
          descriptionChiffree, localisationChiffree, niveauRisque]);

      const row = res.rows[0];
      this.logger.log('[SOS] Signalement cree: ' + row.id + ' | type: ' + data.type_urgence);
      await this.journaliserAcces(row.id, 'SYSTEME', 'CREATION', '127.0.0.1');

      return {
        id:         row.id,
        statut:     row.statut,
        message:    'Signalement enregistre. Un conseiller vous contactera dans les plus brefs delais.',
        created_at: row.created_at,
      };
    } catch (e: any) {
      this.logger.error('[SOS] Erreur creation: ' + e.message);
      throw new Error('Erreur enregistrement signalement: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // LIRE SIGNALEMENT — Déchiffrement + journalisation
  // ---------------------------------------------------------------------------
  async lireSignalement(id: string, travailleurId: string, ipAddress: string, tenantId = 'CI'): Promise<any> {
    try {
      const res = await this.pool.query(
        'SELECT * FROM yira_sos_signalement WHERE id=$1 AND tenant_id=$2',
        [id, tenantId]
      );
      if (res.rows.length === 0) throw new Error('Signalement non trouve');
      const row = res.rows[0];

      await this.journaliserAcces(id, travailleurId, 'LECTURE', ipAddress);

      return {
        id:           row.id,
        tenant_id:    row.tenant_id,
        telephone_hash: row.telephone_hash,
        type_urgence: row.type_urgence,
        description:  this.dechiffrer(row.description_chiffree),
        localisation: row.localisation_chiffree ? this.dechiffrer(row.localisation_chiffree) : null,
        niveau_risque: row.niveau_risque,
        statut:       row.statut,
        created_at:   row.created_at,
      };
    } catch (e: any) {
      this.logger.error('[SOS] Erreur lecture: ' + e.message);
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // LISTER — Sans déchiffrement
  // ---------------------------------------------------------------------------
  async listerSignalements(tenantId = 'CI', statut?: string): Promise<any[]> {
    try {
      const query  = statut
        ? 'SELECT id, tenant_id, type_urgence, niveau_risque, statut, created_at FROM yira_sos_signalement WHERE tenant_id=$1 AND statut=$2 ORDER BY created_at DESC LIMIT 50'
        : 'SELECT id, tenant_id, type_urgence, niveau_risque, statut, created_at FROM yira_sos_signalement WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50';
      const params = statut ? [tenantId, statut] : [tenantId];
      const res    = await this.pool.query(query, params);
      return res.rows;
    } catch (e: any) {
      this.logger.error('[SOS] Erreur liste: ' + e.message);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // TRAITER
  // ---------------------------------------------------------------------------
  async traiterSignalement(id: string, travailleurId: string, ipAddress: string, tenantId = 'CI'): Promise<boolean> {
    try {
      await this.pool.query(
        "UPDATE yira_sos_signalement SET statut='EN_COURS', travailleur_id=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3",
        [travailleurId, id, tenantId]
      );
      await this.journaliserAcces(id, travailleurId, 'TRAITEMENT', ipAddress);
      return true;
    } catch (e: any) {
      this.logger.error('[SOS] Erreur traitement: ' + e.message);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // ANONYMISER — Après 90 jours (loi 2013-450)
  // ---------------------------------------------------------------------------
  async anonymiserSignalements(tenantId = 'CI'): Promise<number> {
    try {
      const res = await this.pool.query(`
        UPDATE yira_sos_signalement
        SET description_chiffree = $1,
            localisation_chiffree = NULL,
            telephone_hash = 'ANONYMISE',
            updated_at = NOW()
        WHERE tenant_id = $2
          AND created_at < NOW() - INTERVAL '90 days'
          AND statut != 'ANONYMISE'
        RETURNING id
      `, [this.chiffrer('ANONYMISE'), tenantId]);

      this.logger.log('[SOS] ' + (res.rowCount ?? 0) + ' signalements anonymises');
      return res.rowCount ?? 0;
    } catch (e: any) {
      this.logger.error('[SOS] Erreur anonymisation: ' + e.message);
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // AES-256-CBC
  // ---------------------------------------------------------------------------
  private chiffrer(texte: string): string {
    const iv      = crypto.randomBytes(this.AES_IV_LENGTH);
    const cipher  = crypto.createCipheriv('aes-256-cbc', this.AES_KEY, iv);
    const chiffre = Buffer.concat([cipher.update(texte, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + chiffre.toString('hex');
  }

  private dechiffrer(texteChiffre: string): string {
    if (!texteChiffre || texteChiffre === 'ANONYMISE') return 'ANONYMISE';
    try {
      const [ivHex, dataHex] = texteChiffre.split(':');
      const iv               = Buffer.from(ivHex, 'hex');
      const data             = Buffer.from(dataHex, 'hex');
      const decipher         = crypto.createDecipheriv('aes-256-cbc', this.AES_KEY, iv);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch (e: any) {
      this.logger.error('[SOS] Erreur dechiffrement: ' + e.message);
      return 'ERREUR_DECHIFFREMENT';
    }
  }

  // ---------------------------------------------------------------------------
  // JOURNAL ACCÈS (conformité loi 2013-450)
  // ---------------------------------------------------------------------------
  private async journaliserAcces(signalementId: string, acteurId: string, action: string, ipAddress: string): Promise<void> {
    try {
      await this.pool.query(
        'INSERT INTO yira_sos_acces_log (tenant_id, signalement_id, acteur_id, action, ip_address) VALUES ($1, $2, $3, $4, $5)',
        ['CI', signalementId, acteurId, action, ipAddress]
      );
    } catch (e: any) {
      this.logger.warn('[SOS] Erreur journal: ' + e.message);
    }
  }

  isReady(): boolean { return this.ready; }
}