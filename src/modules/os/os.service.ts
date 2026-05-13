// ============================================================
// YIRA — src/modules/os/os.service.ts
// Sprint 10 — Service principal YIRA-OS
// Orchestrateur : délègue à BepcService ou BacService
// selon le niveau de l'utilisateur
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { BepcService, AnalyseBepcInput, AnalyseBepcResult } from './bepc.service';
import { BacService, AnalyseBacInput, AnalyseBacResult } from './bac.service';

export type NiveauOS = 'N1' | 'N2' | 'N3';
export type TypeMoteur = 'BEPC' | 'BAC';

@Injectable()
export class OsService {
  private readonly logger = new Logger('OsService');

  constructor(
    private readonly bepcService: BepcService,
    private readonly bacService: BacService,
  ) {}

  // ── Ping ─────────────────────────────────────────────────
  ping(): string {
    return '✅ YIRA-OS opérationnel — Moteurs BEPC + BAC actifs';
  }

  // ── Dispatcher principal ──────────────────────────────────
  async analyserOrientation(
    type: TypeMoteur,
    input: AnalyseBepcInput | AnalyseBacInput,
  ): Promise<AnalyseBepcResult | AnalyseBacResult> {
    this.logger.log(`Dispatch orientation — type: ${type} — user: ${input.utilisateur_id}`);

    if (type === 'BEPC') {
      return this.bepcService.analyser(input as AnalyseBepcInput);
    } else {
      return this.bacService.analyser(input as AnalyseBacInput);
    }
  }

  // ── Calcul MO rapide (USSD) ───────────────────────────────
  calculerMO(notes: Record<string, number>): number {
    return this.bepcService.calculerMO(notes as any);
  }

  // ── Simulation DOB rapide (USSD) ─────────────────────────
  simulerDOBRapide(mo: number, region: string, voeux: string[]) {
    return this.bepcService.simulerDOB(mo, {
      region,
      type_etablissement: 'PUBLIC',
      milieu: 'URBAIN',
      budget_famille: 'MOYEN',
      voeux,
    });
  }

  // ── Détection niveau par profil ───────────────────────────
  detecterNiveau(data: { niveau_etudes?: string; serie_bac?: string }): NiveauOS {
    const niv = data.niveau_etudes?.toUpperCase() || '';
    if (niv.includes('LICENCE') || niv.includes('MASTER') || niv.includes('BTS')) return 'N3';
    if (niv.includes('BAC') || data.serie_bac) return 'N2';
    return 'N1';
  }
}
