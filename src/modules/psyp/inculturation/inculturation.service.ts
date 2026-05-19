// =============================================================================
// YIRA V3.0 — InculturisationService
// Sprint 48 — Reformulation questions psychométriques pour contexte CI
// PRINCIPE : Même construct + Même format + Vocabulaire ivoirien
// OPTIMISATION : Max 5 appels IA par session + cache mémoire
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { IaService } from '../../../ia/ia.service';
import { QuestionPsyP } from '../adapters/psyp.adapter';

@Injectable()
export class InculturisationService {
  private readonly logger = new Logger(InculturisationService.name);
  private cache: Map<string, string> = new Map();

  // Limite appels IA par session (évite quota Gemini dépassé)
  private readonly MAX_APPELS_IA = 5;

  constructor(private ia: IaService) {}

  // ---------------------------------------------------------------------------
  // INCULTURER un lot de questions
  // ---------------------------------------------------------------------------
  async inculturerQuestions(
    questions: QuestionPsyP[],
    provider:  string,
    tenantId = 'CI',
  ): Promise<QuestionPsyP[]> {
    this.logger.log('[INCULT] Inculturation ' + questions.length + ' questions ' + provider + ' → CI');

    const questionsInculturees: QuestionPsyP[] = [];
    let nbAppelsIA = 0;

    for (const q of questions) {
      const cacheKey = provider + '_' + q.numero + '_' + tenantId;

      // 1. Déjà en cache → utiliser directement
      if (this.cache.has(cacheKey)) {
        questionsInculturees.push({ ...q, libelle_incult: this.cache.get(cacheKey) });
        continue;
      }

      // 2. Quota IA atteint → garder l'original (pas d'appel IA)
      if (nbAppelsIA >= this.MAX_APPELS_IA) {
        questionsInculturees.push({ ...q, libelle_incult: q.libelle_original });
        continue;
      }

      // 3. Appel IA pour les premières questions
      try {
        nbAppelsIA++;
        const libelleCi = await this.reformulerQuestion(q, tenantId);
        this.cache.set(cacheKey, libelleCi);
        questionsInculturees.push({ ...q, libelle_incult: libelleCi });
      } catch (e: any) {
        this.logger.warn('[INCULT] Erreur Q' + q.numero + ': ' + e.message);
        questionsInculturees.push({ ...q, libelle_incult: q.libelle_original });
      }
    }

    const nbIncult = questionsInculturees.filter(q => q.libelle_incult !== q.libelle_original).length;
    this.logger.log('[INCULT] Terminé — ' + nbIncult + '/' + questions.length + ' reformulées (IA: ' + nbAppelsIA + ' appels)');
    return questionsInculturees;
  }

  // ---------------------------------------------------------------------------
  // REFORMULER UNE QUESTION — IA
  // RÈGLES STRICTES :
  //   ✅ Même construct psychométrique
  //   ✅ Même format de réponse
  //   ✅ Même niveau de difficulté
  //   ✅ Vocabulaire ivoirien / ouest-africain
  //   ❌ Ne PAS changer le sens profond
  //   ❌ Ne PAS ajouter de biais culturel
  // ---------------------------------------------------------------------------
  private async reformulerQuestion(q: QuestionPsyP, tenantId: string): Promise<string> {
    const prompt =
      'Tu es psychologue du travail ivoirien. ' +
      'Reformule cette question psychométrique pour le contexte de la Côte d\'Ivoire. ' +
      'RÈGLES ABSOLUES : ' +
      '1. Le construct mesuré ne change PAS (même dimension psychologique). ' +
      '2. Le format de réponse ne change PAS. ' +
      '3. Le niveau de difficulté ne change PAS. ' +
      '4. Utilise le vocabulaire de la vie quotidienne ivoirienne. ' +
      '5. Tu peux mentionner des réalités CI : AGEFOP, Orange Money, Cocody, marché, maquis, etc. ' +
      '6. Reste neutre — pas de biais selon ethnie, région ou religion. ' +
      '7. Retourne UNIQUEMENT la question reformulée, rien d\'autre, sans guillemets. ' +
      '\n\nQuestion originale : ' + q.libelle_original;

    const result = await this.ia.generate({
      module:       'YIRA_PSYP',
      usage:        'INCULTURATION_QUESTION',
      pays:         tenantId,
      canal:        'APP',
      variables:    {},
      customPrompt: prompt,
    });

    const reformulee = (result.text ?? q.libelle_original).trim();
    if (reformulee.length < 10) return q.libelle_original;
    return reformulee;
  }

  // ---------------------------------------------------------------------------
  // INCULTURATION EN BATCH — Pour pré-générer toutes les questions
  // (à appeler depuis un CRON, pas depuis une requête utilisateur)
  // ---------------------------------------------------------------------------
  async inculturerBatch(
    questions: QuestionPsyP[],
    provider:  string,
    tenantId = 'CI',
    batchSize = 10,
  ): Promise<number> {
    let nbTraites = 0;
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      for (const q of batch) {
        const cacheKey = provider + '_' + q.numero + '_' + tenantId;
        if (!this.cache.has(cacheKey)) {
          try {
            const libelleCi = await this.reformulerQuestion(q, tenantId);
            this.cache.set(cacheKey, libelleCi);
            nbTraites++;
          } catch (e: any) {
            this.logger.warn('[INCULT] Batch erreur Q' + q.numero + ': ' + e.message);
          }
        }
      }
      // Pause entre batches pour respecter les quotas
      await new Promise(r => setTimeout(r, 1000));
    }
    this.logger.log('[INCULT] Batch terminé — ' + nbTraites + ' questions inculturées');
    return nbTraites;
  }

  // Vider le cache
  viderCache(): void {
    this.cache.clear();
    this.logger.log('[INCULT] Cache vidé');
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}