// =============================================================================
// YIRA V3.0 — PasseportService
// Sprint 38 — Passeport de Compétences 700 FCFA
// Fix: suppression poolSync + import crypto natif
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import { PaymentService } from '../payment/payment.service';
import { TelecomService } from '../telecom/telecom.service';
import { AssessmentService } from '../assessment/assessment.service';
import { OpService } from '../op/op.service';
import { YiraConfigService } from '../../core-config/yira-config.service';

export interface DemandePasseport {
  telephone:         string;
  tenant_id?:        string;
  riasec_scores?:    Record<string, number>;
  bigfive_reponses?: Record<string, number>;
  valeurs_reponses?: Record<string, number>;
  milieu?:           string;
}

@Injectable()
export class PasseportService implements OnModuleInit {
  private readonly logger = new Logger(PasseportService.name);
  private poolEtude!: Pool;
  private ready = false;

  constructor(
    private config:   ConfigService,
    private payment:  PaymentService,
    private telecom:  TelecomService,
    private assess:   AssessmentService,
    private opSvc:    OpService,
    private yiraConf: YiraConfigService,
  ) {}

  async onModuleInit() {
    try {
      this.poolEtude = new Pool({ connectionString: this.config.get('DATABASE_URL_ETUDE') });
      const c        = await this.poolEtude.connect();
      c.release();
      this.ready = true;
      this.logger.log('[PASSEPORT] PasseportService connecte');
    } catch (e: any) {
      this.logger.warn('[PASSEPORT] Erreur init: ' + e.message);
    }
  }

  async commanderPasseport(demande: DemandePasseport): Promise<any> {
    const tenantId = demande.tenant_id ?? 'CI';
    const cfg      = await this.yiraConf.getConfig(tenantId);
    const tarif    = (cfg as any)?.parametres_metier?.passeport_tarif ?? 700;

    this.logger.log('[PASSEPORT] Demande → ' + demande.telephone + ' | ' + tarif + ' FCFA');

    const paiement = await this.payment.debiter(
      demande.telephone, tarif, 'YIRA Passeport de Competences', tenantId,
    );

    if (!paiement.success) {
      return { success: false, message: 'Paiement echoue: ' + (paiement.error ?? 'Solde insuffisant'), statut: paiement.statut };
    }

    this.logger.log('[PASSEPORT] Paiement OK → ' + paiement.transaction_id);

    const profil  = await this.calculerProfilComposite(demande, tenantId);
    const rapport = await this.genererRapport(demande.telephone, profil, tenantId);
    await this.envoyerSmsRapport(demande.telephone, rapport.id, tenantId);

    return {
      success:        true,
      rapport_id:     rapport.id,
      message:        'Passeport genere! Lien envoye par SMS.',
      profil_resume:  profil.resume,
      transaction_id: paiement.transaction_id,
    };
  }

  private async calculerProfilComposite(demande: DemandePasseport, tenantId: string): Promise<any> {
    const milieu         = demande.milieu ?? 'URBAIN';
    const riasecScores   = demande.riasec_scores ?? { R:0, I:3, A:1, S:2, E:2, C:2 };
    const riasecDominant = Object.entries(riasecScores).sort((a, b) => b[1] - a[1])[0][0];
    const nomsRiasec: Record<string, string> = {
      R: 'Realiste', I: 'Investigateur', A: 'Artistique',
      S: 'Social',   E: 'Entrepreneur',  C: 'Conventionnel',
    };

    let bigFive: any = { dominant: 'Ouverture', O: 70, C: 65, E: 60, A: 75, N: 55 };
    if (demande.bigfive_reponses && Object.keys(demande.bigfive_reponses).length > 0) {
      bigFive = this.assess.calculerBigFive(demande.bigfive_reponses, milieu);
    }

    let valeurs: any = { dominant: 'Impact Social' };
    if (demande.valeurs_reponses && Object.keys(demande.valeurs_reponses).length > 0) {
      valeurs = this.assess.calculerValeurs(demande.valeurs_reponses);
    }

    const scg = this.assess.calculerSCG(riasecDominant, bigFive.dominant, valeurs.dominant, 70);

    let topMetiers: string[] = ['Medecin', 'Ingenieur', 'Enseignant'];
    try {
      const result = await this.opSvc.evaluer({
        telephone:    'passeport',
        country_code: tenantId,
        niveau:       'BEPC',
        riasec: {
          r: riasecScores['R'] ?? 0, i: riasecScores['I'] ?? 0,
          a: riasecScores['A'] ?? 0, s: riasecScores['S'] ?? 0,
          e: riasecScores['E'] ?? 0, c: riasecScores['C'] ?? 0,
        },
      });
      if (result?.metiers?.length > 0) {
        topMetiers = result.metiers.slice(0, 3).map((m: any) => m.nom_metier ?? m.nom ?? String(m));
      }
    } catch (e: any) {
      this.logger.warn('[PASSEPORT] OpService erreur: ' + e.message);
    }

    return {
      riasec_dominant: nomsRiasec[riasecDominant] ?? riasecDominant,
      riasec_scores:   riasecScores,
      big_five:        bigFive,
      valeurs,
      scg,
      top_metiers:  topMetiers,
      trust_index:  Math.round(scg) / 100,
      resume:       'Profil ' + (nomsRiasec[riasecDominant] ?? riasecDominant) +
        ' | Big Five: ' + bigFive.dominant +
        ' | Valeurs: ' + valeurs.dominant +
        ' | SCG: ' + scg + '/100',
    };
  }

  private async genererRapport(telephone: string, profil: any, tenantId: string): Promise<any> {
    const contenu     = JSON.stringify({ version: 'YIRA-V3.0', tenant_id: tenantId, generated: new Date().toISOString(), profil });
    const contenuHash = crypto.createHash('sha256').update(contenu).digest('hex');
    const expireAt    = new Date(Date.now() + 365 * 24 * 3600 * 1000);
    const rapportId   = crypto.randomUUID();

    await this.poolEtude.query(`
      INSERT INTO yira_rapport_genere
        (id, tenant_id, enquete_id, type_rapport, titre,
         contenu_hash, format, destinataire, statut, genere_at, expire_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10)
    `, [rapportId, tenantId, rapportId, 'PASSEPORT_COMPETENCES',
        'Passeport de Competences YIRA — ' + new Date().toLocaleDateString('fr-FR'),
        contenuHash, 'JSON', telephone, 'GENERE', expireAt]);

    this.logger.log('[PASSEPORT] Rapport genere: ' + rapportId);
    return { id: rapportId, contenu_hash: contenuHash, expire_at: expireAt };
  }

  private async envoyerSmsRapport(telephone: string, rapportId: string, tenantId: string): Promise<void> {
    const cfg     = await this.yiraConf.getConfig(tenantId);
    const baseUrl = (cfg as any)?.parametres_metier?.app_base_url ?? 'https://yira.africa';
    const lien    = baseUrl + '/passeport/' + rapportId;
    const sms     = 'YIRA: Votre Passeport de Competences est pret! Consultez: ' + lien + ' (valable 1 an)';
    await this.telecom.sendVas(telephone, sms.slice(0, 160), tenantId);
    this.logger.log('[PASSEPORT] SMS envoye → ' + telephone);
  }

  async consulterPasseport(rapportId: string, tenantId = 'CI'): Promise<any> {
    try {
      const res = await this.poolEtude.query(
        "SELECT * FROM yira_rapport_genere WHERE id=$1 AND tenant_id=$2 AND statut='GENERE'",
        [rapportId, tenantId]
      );
      if (res.rows.length === 0) return { found: false, message: 'Passeport non trouve ou expire' };
      return { found: true, rapport: res.rows[0] };
    } catch (e: any) {
      this.logger.error('[PASSEPORT] Erreur consultation: ' + e.message);
      return { found: false, message: 'Erreur: ' + e.message };
    }
  }

  isReady(): boolean { return this.ready; }
}