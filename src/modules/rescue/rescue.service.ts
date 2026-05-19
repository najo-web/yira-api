// =============================================================================
// YIRA V3.0 — RescueService (YIRA-RESCUE)
// Sprint 43 — Coaching IA remédiation 30 jours
// L2 §1.13 : Déclenchement auto si Trust Index < 0,6
// Tarif : 2000 FCFA/30j — Renouvellement 1500 FCFA
// Figures : Vieux Père (M) / Grande Sœur (F)
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { IaService } from '../../ia/ia.service';
import { PaymentService } from '../payment/payment.service';
import { TelecomService } from '../telecom/telecom.service';
import { YiraConfigService } from '../../core-config/yira-config.service';

@Injectable()
export class RescueService implements OnModuleInit {
  private readonly logger = new Logger(RescueService.name);
  private pool!: Pool;
  private ready = false;

  constructor(
    private config:   ConfigService,
    private ia:       IaService,
    private payment:  PaymentService,
    private telecom:  TelecomService,
    private yiraConf: YiraConfigService,
  ) {}

  async onModuleInit() {
    try {
      this.pool  = new Pool({ connectionString: this.config.get('DATABASE_URL_SYNC') });
      const c    = await this.pool.connect();
      c.release();
      this.ready = true;
      this.logger.log('[RESCUE] RescueService connecte a base_sync');
    } catch (e: any) {
      this.logger.warn('[RESCUE] Erreur init: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // DÉCLENCHEMENT AUTO depuis AntifraudeService (Trust Index < 0,6)
  // ---------------------------------------------------------------------------
  async declencherAuto(
    telephone:    string,
    trustIndex:   number,
    genre:        'M' | 'F' = 'M',
    tenantId = 'CI',
  ): Promise<any> {
    this.logger.log('[RESCUE] Declenchement auto — Trust Index: ' + trustIndex + ' < 0.6 → ' + telephone);

    // Vérifier si programme actif existe déjà
    const existing = await this.pool.query(
      'SELECT id FROM yira_rescue_programme WHERE telephone=$1 AND tenant_id=$2 AND statut=$3',
      [telephone, tenantId, 'ACTIF']
    );
    if (existing.rows.length > 0) {
      return { success: true, message: 'Programme RESCUE deja actif', programme_id: existing.rows[0].id, nouveau: false };
    }

    // Créer programme gratuit (déclenché automatiquement — pas de paiement)
    const figure = genre === 'F' ? 'GRANDE_SOEUR' : 'VIEUX_PERE';
    const res = await this.pool.query(`
      INSERT INTO yira_rescue_programme
        (tenant_id, telephone, figure_ia, trust_index_initial, statut, date_debut)
      VALUES ($1, $2, $3, $4, 'ACTIF', NOW())
      RETURNING id
    `, [tenantId, telephone, figure, trustIndex]);

    const programmeId = res.rows[0].id;

    // Générer et envoyer le premier message RESCUE
    const messageJ1 = await this.genererMessageJour(telephone, 1, trustIndex, genre, tenantId);
    await this.creerSession(programmeId, 1, messageJ1, tenantId);
    await this.telecom.sendVas(telephone, messageJ1.slice(0, 160), tenantId);

    this.logger.log('[RESCUE] Programme cree: ' + programmeId + ' | Figure: ' + figure);
    return { success: true, programme_id: programmeId, figure, message_j1: messageJ1, nouveau: true, duree: '30 jours', tarif: 'Gratuit (auto-declenche)' };
  }

  // ---------------------------------------------------------------------------
  // SOUSCRIRE VOLONTAIREMENT (2000 FCFA)
  // ---------------------------------------------------------------------------
  async souscrire(telephone: string, genre: 'M' | 'F' = 'M', tenantId = 'CI'): Promise<any> {
    const tarif = 2000;

    // Paiement Mobile Money
    const paiement = await this.payment.debiter(telephone, tarif, 'YIRA-RESCUE Coaching 30 jours', tenantId);
    if (!paiement.success) {
      return { success: false, message: 'Paiement echoue: ' + (paiement.error ?? 'Solde insuffisant') };
    }

    const figure = genre === 'F' ? 'GRANDE_SOEUR' : 'VIEUX_PERE';
    const res = await this.pool.query(`
      INSERT INTO yira_rescue_programme
        (tenant_id, telephone, figure_ia, trust_index_initial, statut, transaction_id, date_debut)
      VALUES ($1, $2, $3, 0.50, 'ACTIF', $4, NOW())
      RETURNING id
    `, [tenantId, telephone, figure, paiement.transaction_id]);

    const programmeId = res.rows[0].id;
    const messageJ1   = await this.genererMessageJour(telephone, 1, 0.50, genre, tenantId);
    await this.creerSession(programmeId, 1, messageJ1, tenantId);
    await this.telecom.sendVas(telephone, messageJ1.slice(0, 160), tenantId);

    this.logger.log('[RESCUE] Souscription: ' + telephone + ' | ' + tarif + ' FCFA');
    return { success: true, programme_id: programmeId, figure, message_j1: messageJ1, transaction_id: paiement.transaction_id, duree: '30 jours', tarif: tarif + ' FCFA' };
  }

  // ---------------------------------------------------------------------------
  // MESSAGE DU JOUR — IA inculturée
  // ---------------------------------------------------------------------------
  async obtenirMessageDuJour(telephone: string, tenantId = 'CI'): Promise<any> {
    const programme = await this.pool.query(
      'SELECT * FROM yira_rescue_programme WHERE telephone=$1 AND tenant_id=$2 AND statut=$3 ORDER BY created_at DESC LIMIT 1',
      [telephone, tenantId, 'ACTIF']
    );
    if (programme.rows.length === 0) return { success: false, message: 'Aucun programme RESCUE actif' };

    const prog  = programme.rows[0];
    const genre = prog.figure_ia === 'GRANDE_SOEUR' ? 'F' : 'M';
    const jour  = prog.jour_courant;

    // Vérifier si message du jour existe déjà
    const sessionExist = await this.pool.query(
      'SELECT * FROM yira_rescue_session WHERE programme_id=$1 AND jour=$2',
      [prog.id, jour]
    );
    if (sessionExist.rows.length > 0) {
      return { success: true, jour, message: sessionExist.rows[0].contenu_coaching, question: sessionExist.rows[0].question_du_jour, programme_id: prog.id };
    }

    // Générer nouveau message
    const message = await this.genererMessageJour(telephone, jour, prog.trust_index_initial, genre, tenantId);
    await this.creerSession(prog.id, jour, message, tenantId);

    return { success: true, jour, message, programme_id: prog.id, jours_restants: 30 - jour };
  }

  // ---------------------------------------------------------------------------
  // RÉPONDRE AU COACHING DU JOUR
  // ---------------------------------------------------------------------------
  async repondreJour(telephone: string, reponse: string, tenantId = 'CI'): Promise<any> {
    const programme = await this.pool.query(
      'SELECT * FROM yira_rescue_programme WHERE telephone=$1 AND tenant_id=$2 AND statut=$3 ORDER BY created_at DESC LIMIT 1',
      [telephone, tenantId, 'ACTIF']
    );
    if (programme.rows.length === 0) return { success: false, message: 'Aucun programme actif' };

    const prog  = programme.rows[0];
    const genre = prog.figure_ia === 'GRANDE_SOEUR' ? 'F' : 'M';
    const jour  = prog.jour_courant;

    // Évaluer la réponse
    const evaluation = await this.evaluerReponse(reponse, jour, genre, tenantId);

    // Mettre à jour session
    await this.pool.query(
      'UPDATE yira_rescue_session SET reponse_utilisateur=$1, score_jour=$2 WHERE programme_id=$3 AND jour=$4',
      [reponse, evaluation.score, prog.id, jour]
    );

    // Avancer au jour suivant
    const prochainJour = jour + 1;
    if (prochainJour > 30) {
      // Programme terminé — réévaluation Trust Index
      const nouveauTrust = Math.min(1.0, prog.trust_index_initial + 0.25);
      await this.pool.query(
        'UPDATE yira_rescue_programme SET statut=$1, jour_courant=$2, trust_index_final=$3, date_fin=NOW(), updated_at=NOW() WHERE id=$4',
        ['TERMINE', 30, nouveauTrust, prog.id]
      );
      const msgFin = await this.genererMessageFin(genre, nouveauTrust, tenantId);
      await this.telecom.sendVas(telephone, msgFin.slice(0, 160), tenantId);
      this.logger.log('[RESCUE] Programme termine: ' + telephone + ' | Trust final: ' + nouveauTrust);
      return { success: true, jour, evaluation, programme_termine: true, trust_index_final: nouveauTrust, message_fin: msgFin };
    }

    await this.pool.query(
      'UPDATE yira_rescue_programme SET jour_courant=$1, updated_at=NOW() WHERE id=$2',
      [prochainJour, prog.id]
    );

    return { success: true, jour, evaluation, prochain_jour: prochainJour, jours_restants: 30 - prochainJour, programme_termine: false };
  }

  // ---------------------------------------------------------------------------
  // STATUT PROGRAMME
  // ---------------------------------------------------------------------------
  async obtenirStatut(telephone: string, tenantId = 'CI'): Promise<any> {
    const programme = await this.pool.query(
      'SELECT * FROM yira_rescue_programme WHERE telephone=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1',
      [telephone, tenantId]
    );
    if (programme.rows.length === 0) return { actif: false, message: 'Aucun programme RESCUE' };
    const prog = programme.rows[0];
    return {
      actif:               prog.statut === 'ACTIF',
      statut:              prog.statut,
      figure:              prog.figure_ia,
      jour_courant:        prog.jour_courant,
      jours_restants:      30 - prog.jour_courant,
      trust_index_initial: prog.trust_index_initial,
      trust_index_final:   prog.trust_index_final,
      date_debut:          prog.date_debut,
      programme_id:        prog.id,
    };
  }

  // ---------------------------------------------------------------------------
  // MÉTHODES PRIVÉES
  // ---------------------------------------------------------------------------
  private async genererMessageJour(telephone: string, jour: number, trustIndex: number, genre: 'M' | 'F', tenantId: string): Promise<string> {
    const figure  = genre === 'F' ? 'Grande Soeur' : 'Vieux Pere';
    const themes  = ['Connaissance de soi', 'Forces cachees', 'Valeurs profondes', 'Obstacles interieurs', 'Confiance en soi', 'Vision futur CI'];
    const theme   = themes[(jour - 1) % themes.length];

    const prompt =
      'Tu es le ' + figure + ' coach YIRA-RESCUE CI. Jour ' + jour + '/30. ' +
      'Theme: ' + theme + '. Trust Index actuel: ' + trustIndex + '/1.0. ' +
      'Genere un message de coaching bienveillant (max 150 mots) ancre dans la realite ivoirienne. ' +
      'Inclus: 1 reflexion + 1 question de journalisation + 1 encouragement. ' +
      'Ton: ' + (genre === 'F' ? 'Grande Soeur chaleureux et empathique' : 'Vieux Pere sage et bienveillant') + '.';

    try {
      const result = await this.ia.generate({ module: 'YIRA_RESCUE', usage: 'COACHING_JOUR', pays: tenantId, canal: 'SMS', variables: {}, customPrompt: prompt });
      return result.text ?? this.messageMock(jour, genre);
    } catch (e: any) {
      return this.messageMock(jour, genre);
    }
  }

  private async evaluerReponse(reponse: string, jour: number, genre: 'M' | 'F', tenantId: string): Promise<any> {
    const figure = genre === 'F' ? 'Grande Soeur' : 'Vieux Pere';
    const prompt =
      'Tu es le ' + figure + ' YIRA-RESCUE CI. Jour ' + jour + '/30. ' +
      'Reponse du jeune: "' + reponse + '". ' +
      'Evalue (score 0-10) et donne feedback bienveillant CI max 80 mots. ' +
      'JSON: {"score":8,"feedback":"...","progression":"..."}';
    try {
      const result = await this.ia.generate({ module: 'YIRA_RESCUE', usage: 'EVAL_REPONSE', pays: tenantId, canal: 'APP', variables: {}, customPrompt: prompt });
      const clean  = (result.text ?? '').replace(/```json|```/g, '').trim();
      try { return JSON.parse(clean); } catch { return { score: 7, feedback: 'Bonne reflexion ! Continue.', progression: 'En progres' }; }
    } catch (e: any) {
      return { score: 7, feedback: 'Bonne reflexion ! Continue.', progression: 'En progres' };
    }
  }

  private async genererMessageFin(genre: 'M' | 'F', nouveauTrust: number, tenantId: string): Promise<string> {
    const figure = genre === 'F' ? 'Grande Soeur' : 'Vieux Pere';
    const prompt =
      'Tu es le ' + figure + ' YIRA-RESCUE CI. Le jeune vient de terminer 30 jours de coaching. ' +
      'Nouveau Trust Index: ' + nouveauTrust + '/1.0. ' +
      'Message de felicitations bienveillant (max 120 mots), ancre CI. ' +
      'Mentionne que son Passeport de Competences YIRA a ete mis a jour.';
    try {
      const result = await this.ia.generate({ module: 'YIRA_RESCUE', usage: 'MESSAGE_FIN', pays: tenantId, canal: 'SMS', variables: {}, customPrompt: prompt });
      return result.text ?? 'Felicitations ! Tu as termine 30 jours de coaching YIRA-RESCUE. Ton profil est plus clair. Consulte ton Passeport de Competences mis a jour. YIRA est fier de toi !';
    } catch (e: any) {
      return 'Felicitations ! 30 jours completes. Ton Passeport YIRA a ete mis a jour. Continue sur cette lancee !';
    }
  }

  private async creerSession(programmeId: string, jour: number, contenu: string, tenantId: string): Promise<void> {
    try {
      await this.pool.query(
        'INSERT INTO yira_rescue_session (tenant_id, programme_id, jour, contenu_coaching) VALUES ($1,$2,$3,$4)',
        [tenantId, programmeId, jour, contenu]
      );
    } catch (e: any) {
      this.logger.warn('[RESCUE] Erreur session: ' + e.message);
    }
  }

  private messageMock(jour: number, genre: 'M' | 'F'): string {
    const figure = genre === 'F' ? 'Ma fille' : 'Mon enfant';
    return figure + ', jour ' + jour + '/30. Prends 5 minutes aujourd hui pour ecrire 3 choses que tu fais bien. En Cote d\'Ivoire, chaque jeune a un talent unique. Quelle est ta plus grande force selon toi ? YIRA croit en toi !';
  }

  isReady(): boolean { return this.ready; }
}