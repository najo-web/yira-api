// =============================================================================
// YIRA V3.0 — PushSmsService
// Niveau 4 (N4) — Push SMS quotidien 08h00 aux abonnés VAS actifs
// L3 §5.3 : Envoi groupé par service — max 160 chars — Zéro Hardcode
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { TelecomService } from '../telecom/telecom.service';
import { PrismaClient as PrismaGame } from '.prisma/client-game';

export interface PushResult {
  serviceCode: string;
  total:       number;
  envoyes:     number;
  echecs:      number;
}

@Injectable()
export class PushSmsService {
  private readonly logger = new Logger(PushSmsService.name);
  private readonly prisma = new PrismaGame({
    datasources: { db: { url: process.env.DATABASE_URL_GAME } },
  });
  private pool: Pool;

  constructor(
    private telecom: TelecomService,
    private config:  ConfigService,
  ) {
    this.pool = new Pool({ connectionString: config.get('DATABASE_URL_SYNC') });
  }

  // ---------------------------------------------------------------------------
  // CRON 08h00 — Push SMS aux abonnés (questions validées du jour)
  // ---------------------------------------------------------------------------
  @Cron('0 8 * * *', { timeZone: 'Africa/Abidjan' })
  async pushQuotidien(): Promise<PushResult[]> {
    this.logger.log('[PUSH-SMS] Cron 08h00 — Démarrage push quotidien');

    const aujourd_hui = new Date();
    aujourd_hui.setHours(0, 0, 0, 0);

    // Récupère les questions validées du jour
    const questions = await this.prisma.yiraGameQuestion.findMany({
      where: {
        moderation_statut: 'VALIDEE',
        actif:             true,
        genere_at:         { gte: aujourd_hui },
      },
    }) as any[];

    this.logger.log('[PUSH-SMS] ' + questions.length + ' questions validées à pusher');

    const resultats: PushResult[] = [];

    for (const question of questions) {
      const resultat = await this.pusherPourService(question);
      resultats.push(resultat);
      // Pause 500ms entre chaque service
      await this.sleep(500);
    }

    const totalEnvoyes = resultats.reduce((s, r) => s + r.envoyes, 0);
    const totalEchecs  = resultats.reduce((s, r) => s + r.echecs, 0);
    this.logger.log('[PUSH-SMS] Terminé — ' + totalEnvoyes + ' SMS envoyés, ' + totalEchecs + ' échecs');

    return resultats;
  }

  // ---------------------------------------------------------------------------
  // Push pour un service donné
  // ---------------------------------------------------------------------------
  private async pusherPourService(question: any): Promise<PushResult> {
    const serviceCode = question.service_code;

    // Récupère tous les abonnés actifs du service avec leur téléphone
    const res = await this.pool.query(`
      SELECT u.telephone, u.country_code
      FROM yira_souscription_vas s
      JOIN yira_utilisateur u ON u.id = s.user_id
      WHERE s.service_code = $1
        AND s.statut = 'ACTIF'
        AND s.tenant_id = 'CI'
        AND u.telephone IS NOT NULL
        AND u.actif = true
    `, [serviceCode]);

    const abonnes = res.rows;
    let envoyes = 0;
    let echecs  = 0;

    // Formate le contenu SMS (max 160 chars)
    const smsContent = this.formaterSms(question);

    this.logger.log('[PUSH-SMS] ' + serviceCode + ' — ' + abonnes.length + ' abonnés');

    for (const abonne of abonnes) {
      try {
        const result = await this.telecom.sendVas(
          abonne.telephone,
          smsContent,
          abonne.country_code ?? 'CI',
        );
        if (result.success) envoyes++;
        else echecs++;

        // Pause 100ms entre chaque SMS (rate limiting AT)
        await this.sleep(100);
      } catch {
        echecs++;
      }
    }

    return { serviceCode, total: abonnes.length, envoyes, echecs };
  }

  // ---------------------------------------------------------------------------
  // Format SMS — 160 chars max
  // Modèle : "ZOUGLOU: Question? A)opt1 B)opt2 C)opt3 Rep:*7572*1*1*[A/B/C]#"
  // ---------------------------------------------------------------------------
  private formaterSms(question: any): string {
    const prefix = question.service_code + ': ';

    if (question.option_b) {
      // Format quiz
      const corps = question.question + ' A)' + question.option_a +
                    ' B)' + question.option_b + ' C)' + question.option_c;
      const full  = prefix + corps;
      return full.slice(0, 155) + (full.length > 155 ? '...' : '');
    }

    // Format info du jour
    const full = prefix + question.question + ' ' + question.option_a;
    return full.slice(0, 160);
  }

  // ---------------------------------------------------------------------------
  // Déclenchement manuel — Test sans attendre 08h00
  // ---------------------------------------------------------------------------
  async pusherMaintenant(): Promise<PushResult[]> {
    this.logger.log('[PUSH-SMS] Déclenchement manuel');
    return this.pushQuotidien();
  }

  // ---------------------------------------------------------------------------
  // Stats abonnés par service
  // ---------------------------------------------------------------------------
  async statsAbonnes(): Promise<any[]> {
    const res = await this.pool.query(`
      SELECT service_code, COUNT(*) as total_abonnes
      FROM yira_souscription_vas
      WHERE statut = 'ACTIF' AND tenant_id = 'CI'
      GROUP BY service_code
      ORDER BY total_abonnes DESC
    `);
    return res.rows;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}