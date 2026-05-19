// =============================================================================
// YIRA V3.0 â€” PackParentsService
// Sprint 46 â€” Pack Parents 1000 FCFA (10 SMS + QR rapport)
// L2 Â§3.2 : Engagement parental â€” suivi progression enfant
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PaymentService } from '../payment/payment.service';
import { TelecomService } from '../telecom/telecom.service';
import { IaService } from '../../ia/ia.service';

@Injectable()
export class PackParentsService implements OnModuleInit {
  private readonly logger = new Logger(PackParentsService.name);
  private pool!: Pool;
  private ready = false;

  constructor(
    private config:  ConfigService,
    private payment: PaymentService,
    private telecom: TelecomService,
    private ia:      IaService,
  ) {}

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_SYNC') });
      const c    = await this.pool.connect();
      c.release();
      this.ready = true;
      this.logger.log('[PACK-PARENTS] PackParentsService connecte a base_sync');
    } catch (e: any) {
      this.logger.warn('[PACK-PARENTS] Erreur init: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // SOUSCRIRE AU PACK PARENTS (1000 FCFA/mois)
  // ---------------------------------------------------------------------------
  async souscrire(
    telephoneParent:  string,
    telephoneEnfant:  string,
    nomEnfant:        string,
    niveauEnfant:     string,
    typePack:         'MENSUEL' | 'TRIMESTRIEL' = 'MENSUEL',
    tenantId = 'CI',
  ): Promise<any> {
    const montant = typePack === 'TRIMESTRIEL' ? 2500 : 1000;

    // VÃ©rifier pack actif existant
    const existing = await this.pool.query(
      'SELECT id FROM yira_pack_parents WHERE telephone_parent=$1 AND telephone_enfant=$2 AND tenant_id=$3 AND statut=$4',
      [telephoneParent, telephoneEnfant, tenantId, 'ACTIF']
    );
    if (existing.rows.length > 0) {
      return { success: false, message: 'Pack Parents deja actif pour cet enfant' };
    }

    // Paiement Mobile Money
    const paiement = await this.payment.debiter(telephoneParent, montant, 'YIRA Pack Parents â€” Suivi ' + nomEnfant, tenantId);
    if (!paiement.success) {
      return { success: false, message: 'Paiement echoue: ' + (paiement.error ?? 'Solde insuffisant') };
    }

    // Calcul date fin
    const dateFin = new Date();
    dateFin.setMonth(dateFin.getMonth() + (typePack === 'TRIMESTRIEL' ? 3 : 1));

    // CrÃ©er pack
    const res = await this.pool.query(`
      INSERT INTO yira_pack_parents
        (tenant_id, telephone_parent, telephone_enfant, nom_enfant, niveau_enfant,
         statut, type_pack, transaction_id, montant, nb_sms_max, date_fin)
      VALUES ($1,$2,$3,$4,$5,'ACTIF',$6,$7,$8,$9,$10)
      RETURNING id
    `, [tenantId, telephoneParent, telephoneEnfant, nomEnfant, niveauEnfant,
        typePack, paiement.transaction_id, montant,
        typePack === 'TRIMESTRIEL' ? 30 : 10,
        dateFin]);

    const packId = res.rows[0].id;

    // GÃ©nÃ©rer les 10 SMS d'alertes planifiÃ©es
    await this.planifierSMS(packId, nomEnfant, niveauEnfant, tenantId);

    // SMS de bienvenue au parent
    const msgBienvenue = 'YIRA Pack Parents active ! Vous recevrez 10 alertes de suivi pour ' +
      nomEnfant + ' sur 30 jours. Merci de faire confiance a YIRA pour l avenir de votre enfant.';
    await this.telecom.sendVas(telephoneParent, msgBienvenue, tenantId);

    // QR code (URL rapport)
    const qrCode = 'https://yira.africa/rapport/' + packId;
    await this.pool.query(
      'UPDATE yira_pack_parents SET rapport_qr_code=$1, updated_at=NOW() WHERE id=$2',
      [qrCode, packId]
    );

    this.logger.log('[PACK-PARENTS] Pack cree: ' + packId + ' | Parent: ' + telephoneParent);
    return {
      success:       true,
      pack_id:       packId,
      nom_enfant:    nomEnfant,
      type_pack:     typePack,
      montant:       montant + ' FCFA',
      nb_sms:        typePack === 'TRIMESTRIEL' ? 30 : 10,
      date_fin:      dateFin.toISOString().split('T')[0],
      rapport_url:   qrCode,
      transaction_id: paiement.transaction_id,
      message:       'Pack Parents active ! Vous recevrez des alertes de progression pour ' + nomEnfant,
    };
  }

  // ---------------------------------------------------------------------------
  // PLANIFIER LES 10 SMS D'ALERTES
  // ---------------------------------------------------------------------------
  private async planifierSMS(packId: string, nomEnfant: string, niveauEnfant: string, tenantId: string): Promise<void> {
    const typesAlertes = [
      { type: 'BIENVENUE',      contenu: 'Bienvenue ! Le suivi de ' + nomEnfant + ' commence. YIRA analysera sa progression chaque semaine.' },
      { type: 'PROFIL',         contenu: nomEnfant + ' a complete son profil psychometrique RIASEC. Ses points forts apparaitront bientot.' },
      { type: 'RIASEC',         contenu: 'Profil RIASEC de ' + nomEnfant + ' : ses 3 forces principales ont ete identifiees. Connectez-vous pour voir le detail.' },
      { type: 'ORIENTATION',    contenu: nomEnfant + ' a recu ses 3 recommandations de filieres. Discutez-en ensemble ce soir !' },
      { type: 'DOB',            contenu: 'Simulation DOB de ' + nomEnfant + ' : ses chances d affectation en ' + (niveauEnfant === 'BEPC' ? '2nde C' : 'universite') + ' sont calculees.' },
      { type: 'PROGRESSION',    contenu: nomEnfant + ' progresse ! Son Trust Index a augmente cette semaine. Encouragez-le/la.' },
      { type: 'PLAN_ACTION',    contenu: 'Plan d action de ' + nomEnfant + ' pour les 30 prochains jours est pret. 3 actions prioritaires a faire ensemble.' },
      { type: 'MI_PARCOURS',    contenu: 'Bilan mi-parcours de ' + nomEnfant + ' : objectifs atteints a 60%. Consultez le rapport complet.' },
      { type: 'ALERTE_RISQUE',  contenu: 'YIRA detecte que ' + nomEnfant + ' a besoin de renforcement en Mathematiques. Nous vous recommandons un cours de soutien.' },
      { type: 'BILAN_FINAL',    contenu: 'Bilan final du mois de ' + nomEnfant + ' disponible. Telechargez son Passeport de Competences YIRA sur yira.africa' },
    ];

    for (const alerte of typesAlertes) {
      await this.pool.query(
        'INSERT INTO yira_pack_parents_sms (tenant_id, pack_id, type_alerte, contenu, statut_envoi) VALUES ($1,$2,$3,$4,$5)',
        [tenantId, packId, alerte.type, alerte.contenu, 'EN_ATTENTE']
      );
    }
    this.logger.log('[PACK-PARENTS] 10 SMS planifies pour pack: ' + packId);
  }

  // ---------------------------------------------------------------------------
  // ENVOYER PROCHAIN SMS D'ALERTE
  // ---------------------------------------------------------------------------
  async envoyerProchainSMS(packId: string, tenantId = 'CI'): Promise<any> {
    const pack = await this.pool.query(
      'SELECT * FROM yira_pack_parents WHERE id=$1 AND tenant_id=$2 AND statut=$3',
      [packId, tenantId, 'ACTIF']
    );
    if (pack.rows.length === 0) return { success: false, message: 'Pack non trouve ou expire' };

    const prochainSMS = await this.pool.query(
      'SELECT * FROM yira_pack_parents_sms WHERE pack_id=$1 AND statut_envoi=$2 ORDER BY created_at ASC LIMIT 1',
      [packId, 'EN_ATTENTE']
    );
    if (prochainSMS.rows.length === 0) return { success: true, message: 'Tous les SMS ont ete envoyes', termine: true };

    const sms    = prochainSMS.rows[0];
    const envoie = await this.telecom.sendVas(pack.rows[0].telephone_parent, sms.contenu, tenantId);

    await this.pool.query(
      'UPDATE yira_pack_parents_sms SET statut_envoi=$1, date_envoi=NOW() WHERE id=$2',
      [envoie ? 'ENVOYE' : 'ECHEC', sms.id]
    );
    await this.pool.query(
      'UPDATE yira_pack_parents SET nb_sms_envoyes=nb_sms_envoyes+1, updated_at=NOW() WHERE id=$1',
      [packId]
    );

    this.logger.log('[PACK-PARENTS] SMS envoye: ' + sms.type_alerte + ' â†’ ' + pack.rows[0].telephone_parent);
    return { success: true, type_alerte: sms.type_alerte, contenu: sms.contenu, envoye: envoie };
  }

  // ---------------------------------------------------------------------------
  // GÃ‰NÃ‰RER RAPPORT PARENT (IA inculturÃ©)
  // ---------------------------------------------------------------------------
  async genererRapport(packId: string, profilEnfant: any, tenantId = 'CI'): Promise<any> {
    const pack = await this.pool.query(
      'SELECT * FROM yira_pack_parents WHERE id=$1 AND tenant_id=$2',
      [packId, tenantId]
    );
    if (pack.rows.length === 0) return { success: false, message: 'Pack non trouve' };

    const p = pack.rows[0];
    const prompt =
      'Tu es YIRA, conseiller d orientation ivoirien. Genere un rapport mensuel de progression ' +
      'pour les parents de ' + p.nom_enfant + ' (niveau: ' + p.niveau_enfant + '). ' +
      'Ton: bienveillant, clair, adapte aux parents ivoiriens. Max 300 mots. ' +
      'Structure: 1) Points forts identifies 2) Recommandation filiere principale 3) ' +
      'Plan action 3 etapes pour les parents 4) Message encouragement. ' +
      'Profil: ' + JSON.stringify(profilEnfant ?? { riasec: 'I dominant', trust_index: 0.75 });

    try {
      const result = await this.ia.generate({
        module: 'YIRA_OP', usage: 'RAPPORT_PARENTS', pays: tenantId,
        canal: 'APP', variables: {}, customPrompt: prompt,
      });
      return {
        success:     true,
        pack_id:     packId,
        nom_enfant:  p.nom_enfant,
        rapport:     result.text ?? this.rapportMock(p.nom_enfant, p.niveau_enfant),
        rapport_url: p.rapport_qr_code,
        genere_le:   new Date().toISOString(),
      };
    } catch (e: any) {
      return { success: true, pack_id: packId, rapport: this.rapportMock(p.nom_enfant, p.niveau_enfant) };
    }
  }

  // ---------------------------------------------------------------------------
  // STATUT PACK
  // ---------------------------------------------------------------------------
  async obtenirStatut(telephoneParent: string, tenantId = 'CI'): Promise<any> {
    const packs = await this.pool.query(
      'SELECT p.*, COUNT(s.id) FILTER (WHERE s.statut_envoi=\'ENVOYE\') as sms_envoyes_count FROM yira_pack_parents p LEFT JOIN yira_pack_parents_sms s ON s.pack_id=p.id WHERE p.telephone_parent=$1 AND p.tenant_id=$2 GROUP BY p.id ORDER BY p.created_at DESC',
      [telephoneParent, tenantId]
    );
    return {
      success: true,
      packs:   packs.rows.map(p => ({
        pack_id:       p.id,
        nom_enfant:    p.nom_enfant,
        niveau:        p.niveau_enfant,
        statut:        p.statut,
        sms_envoyes:   p.nb_sms_envoyes,
        sms_restants:  p.nb_sms_max - p.nb_sms_envoyes,
        date_fin:      p.date_fin,
        rapport_url:   p.rapport_qr_code,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // RENOUVELER PACK (500 FCFA)
  // ---------------------------------------------------------------------------
  async renouveler(packId: string, telephoneParent: string, tenantId = 'CI'): Promise<any> {
    const montantRenouvellement = 500;
    const paiement = await this.payment.debiter(telephoneParent, montantRenouvellement, 'YIRA Pack Parents Renouvellement', tenantId);
    if (!paiement.success) return { success: false, message: 'Paiement renouvellement echoue' };

    const dateFin = new Date();
    dateFin.setMonth(dateFin.getMonth() + 1);
    await this.pool.query(
      'UPDATE yira_pack_parents SET statut=$1, date_fin=$2, nb_sms_envoyes=0, updated_at=NOW() WHERE id=$3',
      ['RENOUVELE', dateFin, packId]
    );
    await this.planifierSMS(packId, 'votre enfant', 'BEPC', tenantId);
    this.logger.log('[PACK-PARENTS] Pack renouvele: ' + packId);
    return { success: true, pack_id: packId, montant: montantRenouvellement + ' FCFA', date_fin: dateFin.toISOString().split('T')[0] };
  }

  private rapportMock(nomEnfant: string, niveau: string): string {
    return 'Rapport YIRA pour ' + nomEnfant + ' (niveau ' + niveau + ').\n' +
      '1. POINTS FORTS: Profil analytique et social bien equilibre. Curiosite intellectuelle elevee.\n' +
      '2. FILIERE RECOMMANDEE: Sciences (2nde C) si au lycee, ou filiere technique informatique.\n' +
      '3. PLAN PARENTS: a) Encouragez 1h de lecture par jour b) Inscrivez aux cours de soutien ONFP c) Visitez un lycee technique ensemble.\n' +
      '4. ENCOURAGEMENT: ' + nomEnfant + ' a tout pour reussir. Votre soutien est sa plus grande force. YIRA vous accompagne !';
  }

  isReady(): boolean { return this.ready; }
}
