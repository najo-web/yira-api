// =============================================================================
// YIRA V3.0 — SignerService
// Niveau 4 (N4) — Carnet épargne Signer-Signer + Crédit bancaire
// SMS templates depuis base_game.yira_sms_tpl (Zéro Hardcode)
// =============================================================================
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient as PrismaSigner } from '.prisma/client-signer';
import { TelecomService } from '../telecom/telecom.service';
import { SmsTemplateService } from '../telecom/sms-template.service';
import { YiraConfigService } from '../../core-config/yira-config.service';

@Injectable()
export class SignerService {
  private readonly logger = new Logger(SignerService.name);
  private readonly prisma = new PrismaSigner({
    datasources: { db: { url: process.env.DATABASE_URL_SIGNER } },
  });

  constructor(
    private telecom:  TelecomService,
    private config:   ConfigService,
    private smsTpl:   SmsTemplateService,
    private yiraConf: YiraConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // OUVRIR UN CARNET
  // ---------------------------------------------------------------------------
  async ouvrirCarnet(dto: {
    telephone: string; mise_jour: number; projet?: string;
    type_projet?: string; collecteur_terrain_id?: string;
    collecteur_principal_id?: string; tenant_id?: string; kyc_niveau?: number;
  }): Promise<any> {
    const tenantId = dto.tenant_id ?? 'CI';
    const cfg      = await this.yiraConf.getSignerConfig(tenantId);
    const { telephone, mise_jour, projet, type_projet,
      collecteur_terrain_id, collecteur_principal_id, kyc_niveau } = dto;

    if (mise_jour < cfg.mise_min) throw new BadRequestException('Mise minimum: ' + cfg.mise_min + ' FCFA');
    if (mise_jour > cfg.mise_max) throw new BadRequestException('Mise maximum: ' + cfg.mise_max + ' FCFA');

    const kycRequis = this.getKycRequis(mise_jour);
    if ((kyc_niveau ?? 0) < kycRequis) {
      throw new BadRequestException('Mise de ' + mise_jour + ' FCFA/jour requiert KYC niveau ' + kycRequis);
    }

    const merchant = await this.prisma.yiraMerchant.upsert({
      where:  { telephone },
      create: { telephone },
      update: {},
    });

    const carnetActif = await this.prisma.yiraSignerCarnet.findFirst({
      where: { merchant_id: merchant.id, statut: { in: ['OUVERT', 'EN_COURS', 'PAUSE'] } },
    });
    if (carnetActif) throw new BadRequestException('Carnet actif existant — terminez-le avant d en ouvrir un nouveau');

    const ref   = 'CRN-' + new Date().getFullYear() + '-' + telephone.slice(-4) + '-' + Date.now().toString().slice(-4);
    const debut = new Date();
    debut.setDate(debut.getDate() + 1);
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + 31);

    const carnet = await this.prisma.yiraSignerCarnet.create({
      data: {
        reference: ref, merchant_id: merchant.id, telephone,
        mise_jour, projet: projet ?? null,
        type_projet: type_projet ?? 'AUTRE', statut: 'OUVERT',
        collecteur_terrain_id: collecteur_terrain_id ?? null,
        collecteur_principal_id: collecteur_principal_id ?? null,
        tenant_id: tenantId, kyc_niveau: kyc_niveau ?? 0,
        date_debut: debut, date_fin_prevue: fin,
      },
    });

    if (collecteur_terrain_id) {
      await this.prisma.yiraSignerCollecteurTerrain.update({
        where: { id: collecteur_terrain_id },
        data:  { total_carnets: { increment: 1 } },
      });
    }

    // SMS depuis template base_game (Zéro Hardcode)
    const cfgPays = await this.yiraConf.getConfig(tenantId);
    const smsMsg  = await this.smsTpl.obtenir('SIGNER_OUVERTURE', {
      reference:   ref,
      mise:        String(mise_jour),
      epargne_max: String(mise_jour * cfg.jours_epargne),
      projet:      projet ?? 'Non precise',
      shortcode:   cfgPays.ussd_short_code,
    }, tenantId);
    await this.telecom.sendVas(telephone, smsMsg);

    this.logger.log('[SIGNER] Carnet ouvert: ' + ref + ' | ' + telephone + ' | ' + mise_jour + 'F/j');
    return carnet;
  }

  // ---------------------------------------------------------------------------
  // SIGNER UN JOUR
  // ---------------------------------------------------------------------------
  async signerJour(dto: {
    carnet_id: string; canal?: string;
    telephone_payeur?: string; signe_par?: string; reference_tx?: string;
  }): Promise<any> {
    const { carnet_id, canal, telephone_payeur, signe_par, reference_tx } = dto;

    const carnet = await this.prisma.yiraSignerCarnet.findUnique({ where: { id: carnet_id } });
    if (!carnet) throw new NotFoundException('Carnet introuvable');
    if (carnet.statut === 'COMPLETE')  throw new BadRequestException('Carnet deja complete');
    if (carnet.statut === 'ABANDONNE') throw new BadRequestException('Carnet abandonne');
    if (carnet.en_pause)               throw new BadRequestException('Carnet en pause');

    const cfg          = await this.yiraConf.getSignerConfig(carnet.tenant_id ?? 'CI');
    const prochainJour = carnet.jours_signes + 1;

    const dejaSign = await this.prisma.yiraSignerJour.findUnique({
      where: { carnet_id_numero_jour: { carnet_id, numero_jour: prochainJour } },
    });
    if (dejaSign) throw new BadRequestException('Jour ' + prochainJour + ' deja signe');

    const walletPayeur = await this.prisma.yiraSignerWallet.findUnique({
      where: { merchant_id: carnet.merchant_id },
    });
    if (!walletPayeur || walletPayeur.solde < carnet.mise_jour) {
      throw new BadRequestException('Solde insuffisant. Requis: ' + this.fmt(carnet.mise_jour) + ' FCFA. Disponible: ' + this.fmt(walletPayeur?.solde ?? 0) + ' FCFA');
    }

    await this.prisma.yiraSignerWallet.update({
      where: { id: walletPayeur.id },
      data:  { solde: { decrement: carnet.mise_jour } },
    });

    await this.prisma.yiraSignerJour.create({
      data: {
        carnet_id, numero_jour: prochainJour,
        montant:          carnet.mise_jour,
        canal:            canal ?? 'USSD_WALLET',
        signe_par:        signe_par ?? 'CLIENT',
        telephone_payeur: telephone_payeur ?? null,
        reference_tx:     reference_tx ?? null,
        statut:           'SIGNE',
      },
    });

    const nouvelleEpargne = carnet.epargne_cumulee + carnet.mise_jour;
    const nouveauxJours   = carnet.jours_signes + 1;
    const nouveauScore    = Math.round((nouveauxJours / Math.min(prochainJour, cfg.jours_epargne)) * 100);
    const estComplete     = nouveauxJours >= cfg.jours_epargne;

    await this.prisma.yiraSignerCarnet.update({
      where: { id: carnet_id },
      data: {
        jours_signes:    nouveauxJours,
        jour_actuel:     prochainJour,
        epargne_cumulee: nouvelleEpargne,
        score_regularite: nouveauScore,
        statut:          estComplete ? 'COMPLETE' : 'EN_COURS',
        date_completion: estComplete ? new Date() : null,
      },
    });

    // SMS depuis template (Zéro Hardcode)
    const smsMsg = await this.smsTpl.obtenir('SIGNER_SIGNATURE', {
      jour:           String(prochainJour),
      epargne:        String(nouvelleEpargne),
      jours_restants: String(cfg.jours_epargne - nouveauxJours),
    }, carnet.tenant_id ?? 'CI');
    await this.telecom.sendVas(carnet.telephone, smsMsg);

    if (estComplete) await this.onCarnetComplete(carnet_id);

    this.logger.log('[SIGNER] Jour ' + prochainJour + ' signe | ' + carnet.reference);
    return {
      jour:           prochainJour,
      epargne:        nouvelleEpargne,
      jours_restants: cfg.jours_epargne - nouveauxJours,
      score:          nouveauScore,
      complete:       estComplete,
    };
  }

  // ---------------------------------------------------------------------------
  // RETRAIT ÉPARGNE
  // ---------------------------------------------------------------------------
  async retirerEpargne(telephone: string, montant: number): Promise<any> {
    const tenantId = 'CI';
    const cfg      = await this.yiraConf.getSignerConfig(tenantId);
    const merchant = await this.prisma.yiraMerchant.findUnique({ where: { telephone } });
    if (!merchant) throw new NotFoundException('Client introuvable');

    const carnet = await this.prisma.yiraSignerCarnet.findFirst({
      where: { merchant_id: merchant.id, statut: { in: ['EN_COURS', 'OUVERT'] } },
    });
    if (!carnet) throw new NotFoundException('Aucun carnet actif');
    if (montant > carnet.epargne_cumulee) throw new BadRequestException('Montant superieur a l epargne: ' + this.fmt(carnet.epargne_cumulee) + ' FCFA');

    const frais      = Math.ceil(montant * (cfg.frais_retrait_pct / 100));
    const montantNet = montant - frais;

    await this.prisma.yiraSignerWallet.upsert({
      where:  { merchant_id: merchant.id },
      create: { merchant_id: merchant.id, solde: montantNet },
      update: { solde: { increment: montantNet } },
    });

    await this.prisma.yiraSignerCarnet.update({
      where: { id: carnet.id },
      data:  { epargne_cumulee: { decrement: montant } },
    });

    const cfgPays  = await this.yiraConf.getConfig(tenantId);
    const smsRetrait = await this.smsTpl.obtenir('SARA_RETRAIT', {
      montant:  String(montantNet),
      frais:    String(frais),
      solde:    String(carnet.epargne_cumulee - montant),
    }, tenantId);
    await this.telecom.sendVas(telephone, smsRetrait);

    return { montant, frais, montant_net: montantNet, epargne_restante: carnet.epargne_cumulee - montant };
  }

  // ---------------------------------------------------------------------------
  // PAUSE CARNET
  // ---------------------------------------------------------------------------
  async pauseCarnet(carnet_id: string, jours = 3): Promise<any> {
    const carnet = await this.prisma.yiraSignerCarnet.findUnique({ where: { id: carnet_id } });
    if (!carnet) throw new NotFoundException('Carnet introuvable');

    const cfg = await this.yiraConf.getSignerConfig(carnet.tenant_id ?? 'CI');
    if (carnet.nb_pauses >= cfg.max_pauses) throw new BadRequestException('Maximum ' + cfg.max_pauses + ' pauses autorisees');

    const fin_pause = new Date();
    fin_pause.setDate(fin_pause.getDate() + jours);

    await this.prisma.yiraSignerCarnet.update({
      where: { id: carnet_id },
      data:  { en_pause: true, pause_fin: fin_pause, nb_pauses: { increment: 1 }, statut: 'PAUSE' },
    });

    const cfgPays   = await this.yiraConf.getConfig(carnet.tenant_id ?? 'CI');
    const smsPause  = await this.smsTpl.obtenir('SIGNER_RAPPEL', {
      reference: carnet.reference,
      mise:      String(carnet.mise_jour),
      shortcode: cfgPays.ussd_short_code,
    }, carnet.tenant_id ?? 'CI');
    await this.telecom.sendVas(carnet.telephone, smsPause);

    return { pause_fin: fin_pause, pauses_restantes: cfg.max_pauses - carnet.nb_pauses - 1 };
  }

  // ---------------------------------------------------------------------------
  // CARNET COMPLÉTÉ
  // ---------------------------------------------------------------------------
  private async onCarnetComplete(carnet_id: string): Promise<void> {
    const carnet = await this.prisma.yiraSignerCarnet.findUnique({
      where:   { id: carnet_id },
      include: { collecteur_terrain: true, collecteur_principal: true },
    });
    if (!carnet) return;

    if (carnet.collecteur_terrain_id && carnet.collecteur_terrain) {
      await this.prisma.yiraSignerWallet.upsert({
        where:  { merchant_id: carnet.collecteur_terrain_id },
        create: { merchant_id: carnet.collecteur_terrain_id, solde: carnet.mise_jour },
        update: { solde: { increment: carnet.mise_jour } },
      });

      if (carnet.collecteur_principal_id && carnet.collecteur_principal) {
        const reversement = Math.round(carnet.mise_jour * (carnet.collecteur_principal.reversement_pct / 100));
        await this.prisma.yiraSignerWallet.upsert({
          where:  { merchant_id: carnet.collecteur_principal_id },
          create: { merchant_id: carnet.collecteur_principal_id, solde: reversement },
          update: { solde: { increment: reversement } },
        });

        const smsCommission = await this.smsTpl.obtenir('SIGNER_COMMISSION', {
          reference:  carnet.reference,
          commission: String(carnet.mise_jour - reversement),
        }, carnet.tenant_id ?? 'CI');
        await this.telecom.sendVas(carnet.collecteur_terrain.telephone, smsCommission);
      }
      await this.prisma.yiraSignerCarnet.update({ where: { id: carnet_id }, data: { commission_versee: true } });
    }

    await this.genererDossierCredit(carnet_id);

    const smsComplete = await this.smsTpl.obtenir('SIGNER_COMPLETE', {
      reference: carnet.reference,
      epargne:   String(carnet.epargne_cumulee),
    }, carnet.tenant_id ?? 'CI');
    await this.telecom.sendVas(carnet.telephone, smsComplete);

    this.logger.log('[SIGNER] Carnet complete: ' + carnet.reference);
  }

  // ---------------------------------------------------------------------------
  // GÉNÉRER DOSSIER CRÉDIT
  // ---------------------------------------------------------------------------
  async genererDossierCredit(carnet_id: string): Promise<any> {
    const carnet = await this.prisma.yiraSignerCarnet.findUnique({ where: { id: carnet_id } });
    if (!carnet || !carnet.tenant_id) return null;

    const cfg              = await this.yiraConf.getSignerConfig(carnet.tenant_id);
    const carnetsCompletes = await this.prisma.yiraSignerCarnet.count({
      where: { merchant_id: carnet.merchant_id, statut: 'COMPLETE' },
    });

    const merchant       = await this.prisma.yiraMerchant.findUnique({ where: { id: carnet.merchant_id } });
    const anciennetJours = merchant ? Math.round((Date.now() - merchant.created_at.getTime()) / 86400000) : 0;
    const regularite     = (carnet.jours_signes / cfg.jours_epargne) * 100;

    let score = 0;
    score += Math.min(35, (regularite / 100) * 35);
    score += Math.min(20, carnetsCompletes * 10);
    score += Math.min(25, (carnet.epargne_cumulee / (carnet.mise_jour * cfg.jours_epargne)) * 25);
    score += carnet.kyc_niveau >= 1 ? 10 : 0;
    score += Math.min(10, (anciennetJours / 90) * 10);
    score  = Math.min(100, Math.round(score));

    const niveau        = score > 75 ? 'PREMIUM' : score > 50 ? 'CONFIRME' : score > 20 ? 'INTERMEDIAIRE' : 'DEBUTANT';
    const multiplicateur = score >= 80 ? cfg.multiplicateur_or : score >= 60 ? cfg.multiplicateur_argent : cfg.multiplicateur_bronze;
    const montantMax    = Math.min(2000000, carnet.epargne_cumulee * multiplicateur);
    const reco          = score >= 75 ? 'ELIGIBLE' : score >= 50 ? 'ELIGIBLE_AVEC_GARANTIE' : 'NON_ELIGIBLE';

    const dossier = await this.prisma.yiraSignerDossierCredit.upsert({
      where:  { carnet_id },
      create: {
        carnet_id, merchant_id: carnet.merchant_id,
        tenant_id: carnet.tenant_id, telephone: carnet.telephone,
        carnets_completes:  carnetsCompletes,
        jours_signes_total: carnet.jours_signes,
        jours_possibles:    cfg.jours_epargne,
        regularite_pct:     regularite,
        epargne_totale:     carnet.epargne_cumulee,
        capacite_mensuelle: carnet.mise_jour * cfg.jours_epargne,
        canal_dominant:     carnet.canal_dominant,
        kyc_niveau:         carnet.kyc_niveau,
        anciennete_jours:   anciennetJours,
        score_credit:       score, niveau_credit: niveau,
        montant_max_suggere: montantMax,
        multiplicateur, recommandation: reco,
        projet: carnet.projet, type_projet: carnet.type_projet,
        statut: 'ENVOYE_BANQUE',
        mise_remboursement: montantMax > 0 ? Math.round(montantMax * 1.18 / 12 / 30) : 0,
      },
      update: { score_credit: score, statut: 'ENVOYE_BANQUE' },
    });

    this.logger.log('[SIGNER] Dossier credit genere | Score: ' + score + ' | Reco: ' + reco + ' | Max: ' + this.fmt(montantMax) + ' FCFA');
    return dossier;
  }

  // ---------------------------------------------------------------------------
  // GETTERS
  // ---------------------------------------------------------------------------
  async getCarnetByTelephone(telephone: string): Promise<any> {
    const merchant = await this.prisma.yiraMerchant.findUnique({ where: { telephone } });
    if (!merchant) return null;
    return this.prisma.yiraSignerCarnet.findFirst({
      where:   { merchant_id: merchant.id, statut: { in: ['OUVERT', 'EN_COURS', 'PAUSE'] } },
      include: { jours: { orderBy: { numero_jour: 'asc' } } },
    });
  }

  async getHistorique(telephone: string): Promise<any[]> {
    const merchant = await this.prisma.yiraMerchant.findUnique({ where: { telephone } });
    if (!merchant) return [];
    return this.prisma.yiraSignerCarnet.findMany({
      where:   { merchant_id: merchant.id },
      orderBy: { created_at: 'desc' },
      include: { dossier_credit: true },
    });
  }

  async deposerWallet(telephone: string, montant: number): Promise<any> {
    const merchant = await this.prisma.yiraMerchant.upsert({
      where: { telephone }, create: { telephone }, update: {},
    });
    return this.prisma.yiraSignerWallet.upsert({
      where:  { merchant_id: merchant.id },
      create: { merchant_id: merchant.id, solde: montant },
      update: { solde: { increment: montant } },
    });
  }

  async soldeWallet(telephone: string): Promise<number> {
    const merchant = await this.prisma.yiraMerchant.findUnique({ where: { telephone } });
    if (!merchant) return 0;
    const wallet = await this.prisma.yiraSignerWallet.findUnique({ where: { merchant_id: merchant.id } });
    return wallet?.solde ?? 0;
  }

  // ---------------------------------------------------------------------------
  // UTILITAIRES
  // ---------------------------------------------------------------------------
  private getKycRequis(mise: number): number {
    if (mise < 20000)  return 0;
    if (mise < 100000) return 1;
    if (mise < 500000) return 2;
    return 3;
  }

  private fmt(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(Math.round(n));
  }
}