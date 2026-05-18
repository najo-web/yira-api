// =============================================================================
// YIRA V3.0 — AntifraudeService — Triangle de Vérité
// Sprint 39 — L2 §4.2 : Détection fraude psychométrique
// Sommet 1: Cohérence Interne | Sommet 2: Inter-sources | Sommet 3: Comportemental
// =============================================================================
import { Injectable, Logger } from '@nestjs/common';

export interface DonneesEvaluation {
  // Sommet 1 — Cohérence Interne
  riasec_scores?:     Record<string, number>;
  riasec_miroirs?:    Record<string, number>; // Questions miroirs RIASEC
  bigfive_scores?:    Record<string, number>;
  bigfive_miroirs?:   Record<string, number>; // Questions miroirs Big Five

  // Sommet 2 — Cohérence Inter-sources
  riasec_dominant?:   string;
  bigfive_dominant?:  string;
  valeurs_dominant?:  string;
  moyenne_scolaire?:  number;
  aptitudes_global?:  number;

  // Sommet 3 — Pattern Comportemental
  temps_reponses?:    number[];  // ms par question
  nb_retours?:        number;    // nombre de retours en arrière
  nb_questions?:      number;    // total questions
  temps_total_ms?:    number;    // durée totale
}

export interface ResultatTriangle {
  // 3 sommets
  score_coherence_interne:        number; // 0-1
  score_coherence_inter_sources:  number; // 0-1
  score_sincerite_comportementale: number; // 0-1

  // Trust Index final
  trust_index:    number; // 0-1
  niveau_fiabilite: 'TRES_FIABLE' | 'FIABLE' | 'VIGILANCE' | 'INCOHERENT' | 'FRAUDE_SUSPECTEE';
  recommandation: string;

  // Détails
  alertes:        string[];
  action_requise: 'RECOMMANDATION_DIRECTE' | 'SECOND_AVIS' | 'YIRA_RESCUE' | 'VALIDATION_HUMAINE';
}

@Injectable()
export class AntifraudeService {
  private readonly logger = new Logger(AntifraudeService.name);

  // Poids des 3 sommets dans le Trust Index (L2 §4.2)
  private readonly POIDS = {
    coherence_interne:        0.30,
    coherence_inter_sources:  0.40,
    sincerite_comportementale: 0.30,
  };

  // ---------------------------------------------------------------------------
  // ANALYSER — Point d'entrée principal
  // ---------------------------------------------------------------------------
  analyser(donnees: DonneesEvaluation): ResultatTriangle {
    const alertes: string[] = [];

    // Sommet 1 — Cohérence Interne
    const s1 = this.calculerCoherenceInterne(donnees, alertes);

    // Sommet 2 — Cohérence Inter-sources
    const s2 = this.calculerCoherenceInterSources(donnees, alertes);

    // Sommet 3 — Pattern Comportemental
    const s3 = this.calculerSinceriteComportementale(donnees, alertes);

    // Trust Index pondéré
    const trustIndex = Math.round(
      (s1 * this.POIDS.coherence_interne +
       s2 * this.POIDS.coherence_inter_sources +
       s3 * this.POIDS.sincerite_comportementale) * 100
    ) / 100;

    const { niveau, recommandation, action } = this.interpreterTrustIndex(trustIndex);

    this.logger.log('[ANTIFRAUDE] Trust Index: ' + trustIndex + ' | ' + niveau + ' | alertes: ' + alertes.length);

    return {
      score_coherence_interne:         Math.round(s1 * 100) / 100,
      score_coherence_inter_sources:   Math.round(s2 * 100) / 100,
      score_sincerite_comportementale: Math.round(s3 * 100) / 100,
      trust_index:                     trustIndex,
      niveau_fiabilite:                niveau,
      recommandation,
      alertes,
      action_requise:                  action,
    };
  }

  // ---------------------------------------------------------------------------
  // SOMMET 1 — Cohérence Interne (questions miroirs)
  // Questions miroirs = même dimension, formulées différemment
  // Si réponses contradictoires → score bas
  // ---------------------------------------------------------------------------
  private calculerCoherenceInterne(donnees: DonneesEvaluation, alertes: string[]): number {
    let score      = 0.80; // Base neutre
    let nbVerifies = 0;

    // Vérifier cohérence RIASEC ↔ miroirs
    if (donnees.riasec_scores && donnees.riasec_miroirs) {
      const dimensions = Object.keys(donnees.riasec_scores);
      let nbCoherents  = 0;

      for (const dim of dimensions) {
        const score1 = donnees.riasec_scores[dim] ?? 0;
        const score2 = donnees.riasec_miroirs[dim] ?? 0;
        const ecart  = Math.abs(score1 - score2);

        if (ecart <= 1) nbCoherents++;
        else if (ecart >= 3) {
          alertes.push('RIASEC ' + dim + ': ecart important entre questions miroirs (' + ecart + ')');
        }
        nbVerifies++;
      }

      if (nbVerifies > 0) {
        const tauxCoherence = nbCoherents / nbVerifies;
        score = score * 0.5 + tauxCoherence * 0.5;
      }
    }

    // Vérifier cohérence Big Five ↔ miroirs
    if (donnees.bigfive_scores && donnees.bigfive_miroirs) {
      const dimensions = ['O', 'C', 'E', 'A', 'N'];
      let nbCoherents  = 0;

      for (const dim of dimensions) {
        const score1 = donnees.bigfive_scores[dim] ?? 50;
        const score2 = donnees.bigfive_miroirs[dim] ?? 50;
        const ecart  = Math.abs(score1 - score2);

        if (ecart <= 15) nbCoherents++;
        else {
          alertes.push('BigFive ' + dim + ': ecart important entre questions miroirs (' + ecart + ')');
        }
        nbVerifies++;
      }

      if (nbVerifies > 0) {
        const tauxCoherence = nbCoherents / dimensions.length;
        score = score * 0.7 + tauxCoherence * 0.3;
      }
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  // ---------------------------------------------------------------------------
  // SOMMET 2 — Cohérence Inter-sources
  // Convergence RIASEC ↔ Big Five ↔ Valeurs ↔ Notes scolaires
  // ---------------------------------------------------------------------------
  private calculerCoherenceInterSources(donnees: DonneesEvaluation, alertes: string[]): number {
    let score      = 0.75;
    let nbVerifies = 0;

    // Cohérence RIASEC ↔ Big Five (L2 §4.1)
    if (donnees.riasec_dominant && donnees.bigfive_dominant) {
      const coherences: Record<string, string[]> = {
        'I': ['Ouverture', 'ConscienciositÃ©', 'Conscienciosite'],
        'E': ['Extraversion', 'AgrÃ©abilitÃ©', 'Agreabilite'],
        'S': ['AgrÃ©abilitÃ©', 'Agreabilite', 'Extraversion'],
        'A': ['Ouverture'],
        'R': ['ConscienciositÃ©', 'Conscienciosite'],
        'C': ['ConscienciositÃ©', 'Conscienciosite'],
      };

      const attendus = coherences[donnees.riasec_dominant] ?? [];
      if (attendus.some(a => donnees.bigfive_dominant?.includes(a) || a.includes(donnees.bigfive_dominant ?? ''))) {
        score += 0.15;
      } else {
        alertes.push('RIASEC ' + donnees.riasec_dominant + ' peu coherent avec BigFive ' + donnees.bigfive_dominant);
        score -= 0.10;
      }
      nbVerifies++;
    }

    // Cohérence avec aptitudes
    if (donnees.aptitudes_global !== undefined) {
      if (donnees.aptitudes_global >= 70) score += 0.10;
      else if (donnees.aptitudes_global < 40) {
        alertes.push('Aptitudes faibles (' + donnees.aptitudes_global + ') — incoherence possible');
        score -= 0.05;
      }
      nbVerifies++;
    }

    // Cohérence avec moyenne scolaire
    if (donnees.moyenne_scolaire !== undefined) {
      if (donnees.riasec_dominant === 'I' && donnees.moyenne_scolaire < 10) {
        alertes.push('Profil Investigateur mais moyenne scolaire faible (' + donnees.moyenne_scolaire + ')');
        score -= 0.08;
      } else if (donnees.moyenne_scolaire >= 14) {
        score += 0.05;
      }
      nbVerifies++;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  // ---------------------------------------------------------------------------
  // SOMMET 3 — Pattern Comportemental
  // Vitesse réponse, retours en arrière, séquence des réponses
  // ---------------------------------------------------------------------------
  private calculerSinceriteComportementale(donnees: DonneesEvaluation, alertes: string[]): number {
    let score = 0.80;

    if (!donnees.temps_reponses || donnees.temps_reponses.length === 0) {
      return score; // Pas de données comportementales → score neutre
    }

    const temps        = donnees.temps_reponses;
    const tempsMoyen   = temps.reduce((a, b) => a + b, 0) / temps.length;
    const nbQuestions  = donnees.nb_questions ?? temps.length;
    const nbRetours    = donnees.nb_retours ?? 0;

    // Vérification vitesse — trop rapide = suspect (< 2 secondes/question)
    if (tempsMoyen < 2000) {
      alertes.push('Reponses trop rapides (moy: ' + Math.round(tempsMoyen / 1000) + 's) — possible remplissage aleatoire');
      score -= 0.25;
    }
    // Trop lent — possible aide extérieure (> 5 minutes/question)
    else if (tempsMoyen > 300000) {
      alertes.push('Reponses tres lentes (moy: ' + Math.round(tempsMoyen / 60000) + 'min) — possible aide exterieure');
      score -= 0.10;
    }
    // Vitesse normale — bonus
    else if (tempsMoyen >= 5000 && tempsMoyen <= 60000) {
      score += 0.10;
    }

    // Trop de retours en arrière
    const tauxRetours = nbRetours / nbQuestions;
    if (tauxRetours > 0.3) {
      alertes.push('Taux retours arriere eleve (' + Math.round(tauxRetours * 100) + '%) — indecision ou correction');
      score -= 0.10;
    }

    // Variance des temps — trop uniforme = suspect (robot)
    const variance = temps.reduce((acc, t) => acc + Math.pow(t - tempsMoyen, 2), 0) / temps.length;
    const ecartType = Math.sqrt(variance);
    if (ecartType < 500 && temps.length > 5) {
      alertes.push('Variance temps de reponse trop faible — comportement non naturel');
      score -= 0.15;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  // ---------------------------------------------------------------------------
  // INTERPRÉTER LE TRUST INDEX
  // ---------------------------------------------------------------------------
  private interpreterTrustIndex(trustIndex: number): {
    niveau:        ResultatTriangle['niveau_fiabilite'];
    recommandation: string;
    action:        ResultatTriangle['action_requise'];
  } {
    if (trustIndex >= 0.80) {
      return {
        niveau:         'TRES_FIABLE',
        recommandation: 'Profil hautement fiable. Recommandation directe certifiable.',
        action:         'RECOMMANDATION_DIRECTE',
      };
    } else if (trustIndex >= 0.60) {
      return {
        niveau:         'FIABLE',
        recommandation: 'Profil fiable avec mention de vigilance. Second avis conseiller recommande.',
        action:         'SECOND_AVIS',
      };
    } else if (trustIndex >= 0.40) {
      return {
        niveau:         'INCOHERENT',
        recommandation: 'Profil incoherent detecte. Redirection vers YIRA-RESCUE (coaching IA 30 jours).',
        action:         'YIRA_RESCUE',
      };
    } else {
      return {
        niveau:         'FRAUDE_SUSPECTEE',
        recommandation: 'Suspicion forte de fraude ou profil hautement perturbe. Validation humaine obligatoire.',
        action:         'VALIDATION_HUMAINE',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // DUAL SMS — Alerter utilisateur + tuteur si profil incohérent (L2 §4.2)
  // ---------------------------------------------------------------------------
  genererMessageDualSms(resultat: ResultatTriangle, telephoneMineur: string): {
    sms_utilisateur: string;
    sms_tuteur:      string;
    envoyer_tuteur:  boolean;
  } {
    const envoyer = resultat.trust_index < 0.60;

    return {
      sms_utilisateur: 'YIRA: Votre bilan necessite un suivi personnalise. Un conseiller vous contactera sous 48h.',
      sms_tuteur:      envoyer
        ? 'YIRA-Parents: Le bilan de ' + telephoneMineur + ' necessite attention. Contactez un conseiller YIRA.'
        : '',
      envoyer_tuteur: envoyer,
    };
  }
}