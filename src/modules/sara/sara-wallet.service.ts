// =============================================================================
// YIRA V3.0 — SaraWalletService
// Niveau 4 (N4) — Wallet USSD Mobile Money + Tontine + SARA SCORE
// L3 §3.7 : Données financières — transactions atomiques
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient as PrismaSara } from '.prisma/client-sara';
import { TelecomService } from '../telecom/telecom.service';

@Injectable()
export class SaraWalletService {
  private readonly logger = new Logger(SaraWalletService.name);
  private readonly prisma = new PrismaSara({
    datasources: { db: { url: process.env.DATABASE_URL_SARA } },
  });

  constructor(
    private telecom: TelecomService,
    private config:  ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Créer ou récupérer un wallet
  // ---------------------------------------------------------------------------
  async obtenirOuCreerWallet(userId: string, tenantId = 'CI'): Promise<any> {
    const existing = await this.prisma.saraWallet.findUnique({
      where: { user_id_tenant_id: { user_id: userId, tenant_id: tenantId } },
    });
    if (existing) return existing;

    const wallet = await this.prisma.saraWallet.create({
      data: { user_id: userId, tenant_id: tenantId, solde_fcfa: 0, solde_points: 0 },
    });
    this.logger.log('[SARA] Wallet créé → ' + userId);
    return wallet;
  }

  // ---------------------------------------------------------------------------
  // Dépôt Mobile Money
  // ---------------------------------------------------------------------------
  async depot(userId: string, montant: number, provider: string, tenantId = 'CI'): Promise<any> {
    const wallet = await this.obtenirOuCreerWallet(userId, tenantId);

    const transaction = await this.prisma.saraTransaction.create({
      data: {
        tenant_id:    tenantId,
        wallet_id:    wallet.id,
        type:         'DEPOT',
        montant_fcfa: montant,
        solde_avant:  wallet.solde_fcfa,
        solde_apres:  wallet.solde_fcfa + montant,
        description:  'Depot via ' + provider,
        provider,
        statut:       'SUCCES',
      },
    });

    await this.prisma.saraWallet.update({
      where: { id: wallet.id },
      data:  { solde_fcfa: wallet.solde_fcfa + montant },
    });

    await this.mettreAJourScore(userId, tenantId, 'DEPOT');
    this.logger.log('[SARA] Depot ' + montant + 'F → ' + userId + ' via ' + provider);
    return transaction;
  }

  // ---------------------------------------------------------------------------
  // Retrait Mobile Money
  // ---------------------------------------------------------------------------
  async retrait(userId: string, montant: number, provider: string, tenantId = 'CI'): Promise<any> {
    const wallet = await this.obtenirOuCreerWallet(userId, tenantId);

    if (wallet.solde_fcfa < montant) {
      throw new Error('Solde insuffisant — disponible: ' + wallet.solde_fcfa + ' FCFA');
    }

    const transaction = await this.prisma.saraTransaction.create({
      data: {
        tenant_id:    tenantId,
        wallet_id:    wallet.id,
        type:         'RETRAIT',
        montant_fcfa: montant,
        solde_avant:  wallet.solde_fcfa,
        solde_apres:  wallet.solde_fcfa - montant,
        description:  'Retrait via ' + provider,
        provider,
        statut:       'SUCCES',
      },
    });

    await this.prisma.saraWallet.update({
      where: { id: wallet.id },
      data:  { solde_fcfa: wallet.solde_fcfa - montant },
    });

    this.logger.log('[SARA] Retrait ' + montant + 'F → ' + userId);
    return transaction;
  }

  // ---------------------------------------------------------------------------
  // Récompense Airtime (SARA SCORE 80+)
  // ---------------------------------------------------------------------------
  async recompenseAirtime(userId: string, telephone: string, montant: number, tenantId = 'CI'): Promise<any> {
    const wallet = await this.obtenirOuCreerWallet(userId, tenantId);

    const result = await this.telecom.sendAirtime(telephone, montant);
    const statut = result.success ? 'SUCCES' : 'ECHEC';

    const transaction = await this.prisma.saraTransaction.create({
      data: {
        tenant_id:    tenantId,
        wallet_id:    wallet.id,
        type:         'RECOMPENSE',
        montant_fcfa: montant,
        solde_avant:  wallet.solde_fcfa,
        solde_apres:  wallet.solde_fcfa,
        description:  'Recompense airtime SARA SCORE',
        provider:     'AFRICASTALKING',
        statut,
      },
    });

    if (result.success) {
      await this.mettreAJourScore(userId, tenantId, 'RECOMPENSE');
      this.logger.log('[SARA] Recompense airtime ' + montant + 'F → ' + telephone);
    }

    return { transaction, sms: result };
  }

  // ---------------------------------------------------------------------------
  // Solde wallet
  // ---------------------------------------------------------------------------
  async solde(userId: string, tenantId = 'CI'): Promise<any> {
    const wallet = await this.obtenirOuCreerWallet(userId, tenantId);
    const score  = await this.obtenirScore(userId);
    return {
      solde_fcfa:   wallet.solde_fcfa,
      solde_points: wallet.solde_points,
      statut:       wallet.statut,
      sara_score:   score?.score ?? 0,
      sara_niveau:  score?.niveau ?? 'DEBUTANT',
    };
  }

  // ---------------------------------------------------------------------------
  // Historique transactions
  // ---------------------------------------------------------------------------
  async historique(userId: string, tenantId = 'CI', limit = 10): Promise<any[]> {
    const wallet = await this.obtenirOuCreerWallet(userId, tenantId);
    return this.prisma.saraTransaction.findMany({
      where:   { wallet_id: wallet.id },
      orderBy: { created_at: 'desc' },
      take:    limit,
    });
  }

  // ---------------------------------------------------------------------------
  // SARA SCORE — Calcul et mise à jour
  // ---------------------------------------------------------------------------
  async mettreAJourScore(userId: string, tenantId = 'CI', action: string): Promise<void> {
    let score = await this.prisma.saraScore.findUnique({ where: { user_id: userId } });

    const points: Record<string, number> = {
      DEPOT:       10,
      RECOMPENSE:  20,
      QUIZ_REPONDU: 5,
      JOURS_CONSECUTIFS: 15,
      TONTINE:     25,
    };

    const gain = points[action] ?? 0;

    if (!score) {
      score = await this.prisma.saraScore.create({
        data: { user_id: userId, tenant_id: tenantId, score: gain },
      });
    } else {
      const nouveauScore = Math.min(1000, score.score + gain);
      const niveau       = this.calculerNiveau(nouveauScore);
      score = await this.prisma.saraScore.update({
        where: { user_id: userId },
        data:  { score: nouveauScore, niveau, last_computed_at: new Date() },
      });
    }

    this.logger.log('[SARA] Score mis a jour → ' + userId + ' | ' + score.score + ' pts | ' + score.niveau);
  }

  async obtenirScore(userId: string): Promise<any> {
    return this.prisma.saraScore.findUnique({ where: { user_id: userId } });
  }

  private calculerNiveau(score: number): string {
    if (score >= 800) return 'PLATINE';
    if (score >= 600) return 'OR';
    if (score >= 400) return 'ARGENT';
    if (score >= 200) return 'BRONZE';
    return 'DEBUTANT';
  }
}