// =============================================================================
// YIRA V3.0 — ModerationService
// Niveau 4 (N4) — Validation collaborative des questions quiz
// L3 §5.2 : Cron 07h45 auto-validation + API YIRA-COMMAND
// Services stricts : validation humaine obligatoire (SANTE, DROIT, etc.)
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TelecomService } from '../telecom/telecom.service';
import { PrismaClient as PrismaGame } from '.prisma/client-game';

export type ModerationStatut = 'EN_ATTENTE' | 'VALIDEE' | 'REJETEE' | 'CORRIGEE';

export interface ModerationResult {
  success:   boolean;
  questionId: string;
  statut:    ModerationStatut;
  message:   string;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly prisma = new PrismaGame({
    datasources: { db: { url: process.env.DATABASE_URL_GAME } },
  });

  // Services nécessitant validation humaine stricte (L2 §3.4)
  private readonly SERVICES_STRICTS = [
    'SANTE', 'PALU', 'CANCER', 'DEPIST', 'MAMA',
    'VACCIN', 'DROIT', 'FEMME', 'ESPRIT',
  ];

  constructor(
    private telecom: TelecomService,
    private config:  ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // CRON 07h45 — Auto-validation des questions non modérées
  // Exception : services stricts → jamais auto-validés
  // ---------------------------------------------------------------------------
  @Cron('45 7 * * *', { timeZone: 'Africa/Abidjan' })
  async autoValider(): Promise<void> {
    this.logger.log('[MODERATION] Cron 07h45 — Auto-validation démarrée');

    const aujourd_hui = new Date();
    aujourd_hui.setHours(0, 0, 0, 0);

    // Récupère toutes les questions EN_ATTENTE du jour
    const questions = await this.prisma.yiraGameQuestion.findMany({
      where: {
        moderation_statut: 'EN_ATTENTE',
        genere_at: { gte: aujourd_hui },
      },
    }) as any[];

    let autoValidees = 0;
    let ignorees     = 0;

    for (const q of questions) {
      const estStrict = this.SERVICES_STRICTS.includes(q.service_code.toUpperCase());

      if (estStrict) {
        // Service strict → on rejette automatiquement si pas validé
        await this.prisma.yiraGameQuestion.update({
          where: { id: q.id },
          data: {
            moderation_statut: 'REJETEE',
            modere_par:        'AUTO_SYSTEM',
            modere_at:         new Date(),
            motif_rejet:       'Service sensible — validation humaine requise avant 07h45',
          } as any,
        });
        ignorees++;
        this.logger.warn('[MODERATION] REJETE auto (strict) — ' + q.service_code);
      } else {
        // Service non-strict → auto-validation
        await this.prisma.yiraGameQuestion.update({
          where: { id: q.id },
          data: {
            moderation_statut: 'VALIDEE',
            modere_par:        'AUTO_SYSTEM',
            modere_at:         new Date(),
            actif:             true,
          } as any,
        });
        autoValidees++;
        this.logger.log('[MODERATION] AUTO-VALIDEE — ' + q.service_code);
      }
    }

    this.logger.log('[MODERATION] Auto-validation terminée — ' + autoValidees + ' validées, ' + ignorees + ' rejetées');

    // Lance le push SMS à 08h00
    await this.schedulerPushSms();
  }

  // ---------------------------------------------------------------------------
  // CRON 08h00 — Push SMS aux abonnés (questions validées)
  // ---------------------------------------------------------------------------
  @Cron('0 8 * * *', { timeZone: 'Africa/Abidjan' })
  async pushSmsAbonnes(): Promise<void> {
    this.logger.log('[MODERATION] Cron 08h00 — Push SMS abonnés démarré');
    await this.schedulerPushSms();
  }

  private async schedulerPushSms(): Promise<void> {
    const aujourd_hui = new Date();
    aujourd_hui.setHours(0, 0, 0, 0);

    const questionsValidees = await this.prisma.yiraGameQuestion.findMany({
      where: {
        moderation_statut: 'VALIDEE',
        actif:             true,
        genere_at:         { gte: aujourd_hui },
      },
    }) as any[];

    this.logger.log('[MODERATION] ' + questionsValidees.length + ' questions à pusher aux abonnés');

    // TODO Sprint 18 — Récupérer abonnés par service depuis base_sync
    // et envoyer via TelecomService.sendVas()
    for (const q of questionsValidees) {
      const smsContent = q.service_code + ': ' + q.question +
        (q.option_b ? ' A)' + q.option_a + ' B)' + q.option_b + ' C)' + q.option_c : '');
      this.logger.log('[MODERATION] SMS prêt → ' + q.service_code + ' | ' + smsContent.slice(0, 80));
    }
  }

  // ---------------------------------------------------------------------------
  // API COMMAND — Valider une question
  // ---------------------------------------------------------------------------
  async validerQuestion(questionId: string, moderateurId: string): Promise<ModerationResult> {
    try {
      await this.prisma.yiraGameQuestion.update({
        where: { id: questionId },
        data: {
          moderation_statut: 'VALIDEE',
          modere_par:        moderateurId,
          modere_at:         new Date(),
          actif:             true,
        } as any,
      });
      this.logger.log('[MODERATION] VALIDEE — ' + questionId + ' par ' + moderateurId);
      return { success: true, questionId, statut: 'VALIDEE', message: 'Question validée avec succès' };
    } catch (err: any) {
      return { success: false, questionId, statut: 'EN_ATTENTE', message: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // API COMMAND — Rejeter une question
  // ---------------------------------------------------------------------------
  async rejeterQuestion(questionId: string, moderateurId: string, motif: string): Promise<ModerationResult> {
    try {
      await this.prisma.yiraGameQuestion.update({
        where: { id: questionId },
        data: {
          moderation_statut: 'REJETEE',
          modere_par:        moderateurId,
          modere_at:         new Date(),
          motif_rejet:       motif,
          actif:             false,
        } as any,
      });
      this.logger.log('[MODERATION] REJETEE — ' + questionId + ' | motif: ' + motif);
      return { success: true, questionId, statut: 'REJETEE', message: 'Question rejetée' };
    } catch (err: any) {
      return { success: false, questionId, statut: 'EN_ATTENTE', message: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // API COMMAND — Corriger une question
  // ---------------------------------------------------------------------------
  async corrigerQuestion(
    questionId: string,
    moderateurId: string,
    correction: string,
  ): Promise<ModerationResult> {
    try {
      await this.prisma.yiraGameQuestion.update({
        where: { id: questionId },
        data: {
          moderation_statut:   'VALIDEE',
          modere_par:          moderateurId,
          modere_at:           new Date(),
          correction_manuelle: correction,
          actif:               true,
        } as any,
      });
      this.logger.log('[MODERATION] CORRIGEE — ' + questionId);
      return { success: true, questionId, statut: 'CORRIGEE', message: 'Question corrigée et validée' };
    } catch (err: any) {
      return { success: false, questionId, statut: 'EN_ATTENTE', message: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // API COMMAND — Lister les questions EN_ATTENTE
  // ---------------------------------------------------------------------------
  async listerEnAttente(serviceCode?: string): Promise<any[]> {
    const where: any = { moderation_statut: 'EN_ATTENTE' };
    if (serviceCode) where.service_code = serviceCode;
    return this.prisma.yiraGameQuestion.findMany({
      where,
      orderBy: { genere_at: 'desc' },
      take: 50,
    });
  }

  // ---------------------------------------------------------------------------
  // API COMMAND — Statistiques du jour
  // ---------------------------------------------------------------------------
  async statsJour(): Promise<any> {
    const aujourd_hui = new Date();
    aujourd_hui.setHours(0, 0, 0, 0);

    const [total, validees, rejetees, enAttente] = await Promise.all([
      this.prisma.yiraGameQuestion.count({ where: { genere_at: { gte: aujourd_hui } } }),
      this.prisma.yiraGameQuestion.count({ where: { genere_at: { gte: aujourd_hui }, moderation_statut: 'VALIDEE' } }),
      this.prisma.yiraGameQuestion.count({ where: { genere_at: { gte: aujourd_hui }, moderation_statut: 'REJETEE' } }),
      this.prisma.yiraGameQuestion.count({ where: { genere_at: { gte: aujourd_hui }, moderation_statut: 'EN_ATTENTE' } }),
    ]);

    return { total, validees, rejetees, enAttente, date: aujourd_hui.toISOString().split('T')[0] };
  }
}