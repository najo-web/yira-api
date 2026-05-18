// =============================================================================
// YIRA V3.0 — MockPaymentProvider
// Niveau 2 (N2) — Provider de paiement MOCK pour DEV/TEST
// Simule Orange Money + MTN Mobile Money sans appel API réel
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';

export interface PaymentResult {
  success:       boolean;
  provider:      string;
  transaction_id?: string;
  montant:       number;
  telephone:     string;
  statut:        'SUCCES' | 'ECHEC' | 'SOLDE_INSUFFISANT' | 'TIMEOUT' | 'PENDING';
  error?:        string;
  timestamp:     string;
}

@Injectable()
export class MockPaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  async debiter(telephone: string, montant: number, description: string): Promise<PaymentResult> {
    this.logger.warn('[MOCK-PAY] Debit simule → ' + telephone + ' | ' + montant + ' FCFA | ' + description);
    // Simulation : 95% succès en mode mock
    const success = Math.random() > 0.05;
    return {
      success,
      provider:       'MOCK',
      transaction_id: 'MOCK-' + Date.now(),
      montant,
      telephone,
      statut:         success ? 'SUCCES' : 'SOLDE_INSUFFISANT',
      error:          success ? undefined : 'Solde insuffisant (simulation)',
      timestamp:      new Date().toISOString(),
    };
  }

  async verifierSolde(telephone: string): Promise<number> {
    this.logger.warn('[MOCK-PAY] Solde simule → ' + telephone);
    return 5000; // 5000 FCFA simulé
  }

  isReady(): boolean { return true; }
}