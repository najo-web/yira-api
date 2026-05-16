// =============================================================================
// YIRA V3.0 — OpService (YIRA-OS)
// Niveau 4 (N4) — Orientation Scolaire + Professionnelle
// L3 §4.4 : AIP multi-modèles — IaService (Gemini + Claude)
// L3 §5.4 : Moteur NIE — base_orientation connectée
// Prompt Vieux Père V2 — lu depuis base_core (Zéro Hardcode)
// Guardrails automatiques — 3 niveaux de protection
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool }          from 'pg';
import { ConfigService } from '@nestjs/config';
import { IaService }     from '../../ia/ia.service';

export interface ProfilOrientation {
  telephone:       string;
  country_code:    string;
  niveau:          'BEPC' | 'BAC' | 'BAC_PLUS';
  serie?:          string;
  moyenne?:        number;
  riasec?:         { r: number; i: number; a: number; s: number; e: number; c: number };
  big_five?:       { o: number; c: number; e: number; a: number; n: number };
  trust_index?:    number;
  region?:         string;
  budget_parents?: number;
}

export interface RapportNIE {
  profil:              ProfilOrientation;
  filieres:            any[];
  metiers:             any[];
  formations:          any[];
  plan_coaching:       any;
  budget_parents:      any;
  message_orientation: string;
  score_confiance:     number;
}

@Injectable()
export class OpService implements OnModuleInit {
  private readonly logger = new Logger(OpService.name);
  private pool!:     Pool;
  private poolCore!: Pool;
  private ready = false;

  constructor(
    private config: ConfigService,
    private ia:     IaService,
  ) {}

  async onModuleInit() {
    try {
      this.pool     = new Pool({ connectionString: this.config.get('DATABASE_URL_ORIENTATION') });
      this.poolCore = new Pool({ connectionString: this.config.get('DATABASE_URL_CORE') });
      const client  = await this.pool.connect();
      client.release();
      this.ready = true;
      this.logger.log('[OP] OpService connecte a base_orientation + base_core');
    } catch (e: any) {
      this.logger.warn('[OP] base_orientation non disponible: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // EVALUER — Point d'entrée principal YIRA-OS
  // ---------------------------------------------------------------------------
  async evaluer(profil: ProfilOrientation): Promise<RapportNIE> {
    this.logger.log('[OP] Evaluation NIE pour ' + profil.telephone);

    const [filieres, metiers, formations] = await Promise.all([
      this.recommanderFilieres(profil),
      this.recommanderMetiers(profil),
      this.recommanderFormations(profil),
    ]);

    const plan_coaching  = this.genererPlanCoaching(profil, filieres[0], metiers[0]);
    const budget_parents = this.calculerBudgetParents(formations[0], profil.budget_parents);
    const message        = await this.genererMessageIA(profil, filieres, metiers);

    const rapport: RapportNIE = {
      profil, filieres, metiers, formations,
      plan_coaching, budget_parents,
      message_orientation: message,
      score_confiance: profil.trust_index ?? 75,
    };

    await this.sauvegarderRapport(rapport);
    return rapport;
  }

  // ---------------------------------------------------------------------------
  // RECOMMANDER FILIÈRES
  // ---------------------------------------------------------------------------
  private async recommanderFilieres(profil: ProfilOrientation): Promise<any[]> {
    if (!this.ready) return this.filieresMock(profil);
    try {
      const res = await this.pool.query(`
        SELECT f.*
        FROM yira_filiere_universite f
        WHERE f.tenant_id = 'CI'
        LIMIT 5
      `);
      if (res.rows.length > 0) return res.rows;
    } catch (e: any) {
      this.logger.warn('[OP] Erreur filieres: ' + e.message);
    }
    return this.filieresMock(profil);
  }

  // ---------------------------------------------------------------------------
  // RECOMMANDER MÉTIERS — Alignés RIASEC
  // ---------------------------------------------------------------------------
  private async recommanderMetiers(profil: ProfilOrientation): Promise<any[]> {
    if (!this.ready) return this.metiersMock(profil);
    try {
      const dominant = profil.riasec ? this.getDominantRiasec(profil.riasec) : ['I', 'S'];
      const res = await this.pool.query(`
        SELECT m.*,
               CASE WHEN m.riasec_codes && $1 THEN 3
                    WHEN m.riasec_codes && $2 THEN 1
                    ELSE 0 END as score_match
        FROM yira_metier_avenir m
        WHERE m.tenant_id = 'CI'
        ORDER BY score_match DESC, m.demande_2030 DESC
        LIMIT 8
      `, [dominant, dominant.slice(0, 1)]);
      if (res.rows.length > 0) return res.rows;
    } catch (e: any) {
      this.logger.warn('[OP] Erreur metiers: ' + e.message);
    }
    return this.metiersMock(profil);
  }

  // ---------------------------------------------------------------------------
  // RECOMMANDER FORMATIONS
  // ---------------------------------------------------------------------------
  private async recommanderFormations(profil: ProfilOrientation): Promise<any[]> {
    if (!this.ready) return this.formationsMock();
    try {
      const niveauEntree = profil.niveau === 'BAC' ? profil.serie ?? 'BAC' : profil.niveau;
      const res = await this.pool.query(`
        SELECT f.*
        FROM yira_formation_ci f
        WHERE f.tenant_id = 'CI'
          AND (f.filieres_bac @> $1 OR f.niveau_entree = $2)
        ORDER BY f.cout_annuel ASC
        LIMIT 6
      `, [[niveauEntree], niveauEntree]);
      if (res.rows.length > 0) return res.rows;
    } catch (e: any) {
      this.logger.warn('[OP] Erreur formations: ' + e.message);
    }
    return this.formationsMock();
  }

  // ---------------------------------------------------------------------------
  // PLAN COACHING J+30/J+90/J+180
  // ---------------------------------------------------------------------------
  private genererPlanCoaching(profil: ProfilOrientation, filiere: any, metier: any): any {
    const filiereCible = filiere?.nom ?? 'Filiere scientifique';
    const metierCible  = metier?.nom  ?? 'Metier tech';
    const moyenne      = profil.moyenne ?? 12;
    return {
      filiere_cible: filiereCible,
      metier_cible:  metierCible,
      j30: {
        titre:    'Consolidation scolaire',
        actions:  [
          'Renforcement en ' + (moyenne < 12 ? 'Maths et Francais' : 'matieres scientifiques') + ' (2h/semaine)',
          'Inscription aux cours de soutien ONFP',
          'Test de positionnement YIRA-QUIZ ' + filiereCible,
        ],
        objectif: 'Atteindre moyenne ' + Math.min(14, moyenne + 1) + '/20',
      },
      j90: {
        titre:    'Preparation candidature',
        actions:  [
          'Concours blanc DREN (inscription avant dec.)',
          'Visite etablissements recommandes',
          'Constitution du dossier inscription',
          'Rencontre professionnel secteur ' + (metier?.secteur ?? 'TECH'),
        ],
        objectif: 'Dossier complet + lettre de motivation redigee',
      },
      j180: {
        titre:    'Inscription et suivi',
        actions:  [
          'Depot dossier ' + filiereCible + ' avant date limite',
          'Inscription concours entree si requis',
          'Plan financement valide avec les parents',
          'Ouverture carnet SARA epargne scolarite',
        ],
        objectif: 'Inscription confirmee pour la rentree suivante',
      },
    };
  }

  // ---------------------------------------------------------------------------
  // BUDGET PARENTS
  // ---------------------------------------------------------------------------
  private calculerBudgetParents(formation: any, budgetDisponible?: number): any {
    const coutAnnuel     = formation?.cout_annuel ?? 500000;
    const duree          = formation?.duree_ans   ?? 3;
    const totalFormation = coutAnnuel * duree;
    const fraisVie       = 150000 * 12 * duree;
    const totalEstime    = totalFormation + fraisVie;
    const epargne_mensuelle = Math.ceil(totalEstime / (duree * 12));
    const epargne_sara_jour = Math.ceil(epargne_mensuelle / 30);
    return {
      formation:         formation?.nom ?? 'Formation recommandee',
      cout_annuel:       coutAnnuel,
      duree_ans:         duree,
      total_formation:   totalFormation,
      frais_vie:         fraisVie,
      total_estime:      totalEstime,
      budget_disponible: budgetDisponible ?? 0,
      deficit:           Math.max(0, totalEstime - (budgetDisponible ?? 0)),
      plan_epargne: {
        mensuel_recommande: epargne_mensuelle,
        sara_jour:          epargne_sara_jour,
        message:            'Ouvrir un carnet SARA de ' + epargne_sara_jour + ' FCFA/jour pour couvrir la scolarite',
      },
      roi: {
        salaire_median_apres: 450000,
        mois_remboursement:   Math.ceil(totalEstime / 450000),
        message:              'Retour sur investissement estime: ' + Math.ceil(totalEstime / 450000) + ' mois apres insertion',
      },
    };
  }

  // ---------------------------------------------------------------------------
  // MESSAGE IA — Prompt lu depuis base_core (Zéro Hardcode L3)
  // ---------------------------------------------------------------------------
  private async genererMessageIA(
    profil: ProfilOrientation,
    filieres: any[],
    metiers: any[],
  ): Promise<string> {
    try {
      const promptData = await this.obtenirPromptBaseCore('VIEUX_PERE_ORIENTATION_V2');
      const guardrails = promptData?.guardrails ?? {};

      const promptUser = promptData?.prompt_user_template
        ? promptData.prompt_user_template
            .replace('{{niveau}}',  profil.niveau ?? '')
            .replace('{{serie}}',   profil.serie  ?? 'non precise')
            .replace('{{moyenne}}', String(profil.moyenne ?? 'non precisee'))
            .replace('{{filiere}}', filieres[0]?.nom ?? 'Sciences')
            .replace('{{metier}}',  metiers[0]?.nom  ?? 'Tech')
            .replace('{{region}}',  profil.region    ?? 'Abidjan')
        : 'Eleve niveau ' + profil.niveau + ', filiere ' + (filieres[0]?.nom ?? 'Sciences') +
          ', metier ' + (metiers[0]?.nom ?? 'Tech') + '. Genere le message Vieux Pere. Max 280 chars.';

      const promptSysteme = promptData?.prompt_system ??
        'Tu es le Vieux Pere bienveillant de YIRA CI. Regles: jamais de references religieuses ou ethniques. Ancrer dans la realite ivoirienne. Max 280 caracteres. Texte simple.';

      const result = await this.ia.generate({
        module:       'YIRA_OS',
        usage:        'ORIENTATION_NIE',
        pays:         profil.country_code ?? 'CI',
        canal:        'APP',
        variables:    {},
        customPrompt: promptSysteme + '\n\n' + promptUser,
      });

      const message = result.text ?? this.messageMock(profil, filieres, metiers);
      return this.appliquerGuardrails(message, guardrails);

    } catch (e: any) {
      this.logger.warn('[OP] Erreur IA message: ' + e.message);
      return this.messageMock(profil, filieres, metiers);
    }
  }

  // ---------------------------------------------------------------------------
  // LIRE PROMPT DEPUIS base_core (Zéro Hardcode)
  // ---------------------------------------------------------------------------
  private async obtenirPromptBaseCore(promptKey: string): Promise<any> {
    try {
      const res = await this.poolCore.query(`
        SELECT prompt_system, prompt_user_template, guardrails, cqci_filters
        FROM core.ia_prompts
        WHERE prompt_key = $1
          AND tenant_id  = 'CI'
          AND status     = 'ACTIVE'
        ORDER BY version DESC
        LIMIT 1
      `, [promptKey]);
      if (res.rows.length > 0) {
        this.logger.log('[OP] Prompt ' + promptKey + ' charge depuis base_core');
        return res.rows[0];
      }
    } catch (e: any) {
      this.logger.warn('[OP] Erreur lecture prompt base_core: ' + e.message);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // GUARDRAILS — 3 niveaux de protection (L3 §7.2)
  // ---------------------------------------------------------------------------
  private appliquerGuardrails(message: string, guardrails: any): string {
    const forbidden: string[]   = guardrails?.forbidden_words ?? [];
    const maxChars: number      = guardrails?.max_chars ?? 280;
    const sosKeywords: string[] = guardrails?.sos_keywords ?? ['desespoir', 'mourir', 'suicide'];

    if (sosKeywords.some(mot => message.toLowerCase().includes(mot))) {
      this.logger.error('[OP][GUARDRAIL][SOS] Trigger SOS detecte');
      return 'YIRA est la pour toi. Si tu traverses une periode difficile, compose le *7572*5# pour parler a quelqu un. Tu n es pas seul(e).';
    }

    const motsTrouves = forbidden.filter(mot => message.toLowerCase().includes(mot.toLowerCase()));
    if (motsTrouves.length > 0) {
      this.logger.warn('[OP][GUARDRAIL] Mots interdits: ' + motsTrouves.join(', '));
      return 'Mon enfant, avec ta moyenne et ton profil, tu as de vraies opportunites en Cote d Ivoire. Inscris-toi aux cours de renforcement ONFP et prepare ton dossier. YIRA t accompagne!';
    }

    if (message.length > maxChars) {
      const tronque      = message.slice(0, maxChars - 3).trim();
      const dernierPoint = Math.max(tronque.lastIndexOf('.'), tronque.lastIndexOf('!'), tronque.lastIndexOf('?'));
      return dernierPoint > maxChars * 0.7 ? tronque.slice(0, dernierPoint + 1) : tronque + '...';
    }

    return message;
  }

  // ---------------------------------------------------------------------------
  // SAUVEGARDE RAPPORT — colonnes réelles de yira_analyse_os
  // ---------------------------------------------------------------------------
  private async sauvegarderRapport(rapport: RapportNIE): Promise<void> {
    if (!this.ready) return;
    try {
      const dominantRiasec = rapport.profil.riasec
        ? Object.entries(rapport.profil.riasec)
            .sort(([, a], [, b]) => (b as number) - (a as number))[0][0].toUpperCase()
        : 'I';

      await this.pool.query(`
        INSERT INTO yira_analyse_os (
          id, utilisateur_id, type_moteur,
          code_riasec, top1_filiere_code,
          top1_score_global, plan_action, trust_index_ajout
        ) VALUES (
          gen_random_uuid()::text, $1, 'YIRA-OS-V3',
          $2, $3, $4, $5, $6
        )
      `, [
        rapport.profil.telephone,
        dominantRiasec,
        rapport.filieres[0]?.code ?? 'SEC_D',
        rapport.filieres[0]?.score_match ?? 75,
        JSON.stringify(rapport.plan_coaching),
        rapport.profil.trust_index ?? 75,
      ]);
    } catch (e: any) {
      this.logger.warn('[OP] Erreur sauvegarde rapport: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // UTILITAIRES
  // ---------------------------------------------------------------------------
  private getDominantRiasec(riasec: any): string[] {
    return Object.entries(riasec)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 2)
      .map(([k]) => k.toUpperCase());
  }

  private messageMock(profil: ProfilOrientation, filieres: any[], metiers: any[]): string {
    return 'Bravo pour ton parcours! Avec ton profil, la filiere ' +
      (filieres[0]?.nom ?? 'scientifique') + ' et le metier de ' +
      (metiers[0]?.nom ?? 'technicien') + ' sont faits pour toi. YIRA croit en toi!';
  }

  private filieresMock(profil: ProfilOrientation): any[] {
    return [
      { code: 'SEC_D', nom: 'Terminale D - Sciences de la Vie', score_match: 90, seuil_min: 11 },
      { code: 'SEC_C', nom: 'Terminale C - Mathematiques',      score_match: 75, seuil_min: 13 },
    ];
  }

  private metiersMock(profil: ProfilOrientation): any[] {
    return [
      { code: 'DEV_WEB_MOBILE',     nom: 'Developpeur Web/Mobile', secteur: 'TECH',        salaire_median: 450000, demande_2030: 580 },
      { code: 'DATA_SCIENTIST',     nom: 'Data Scientist',          secteur: 'TECH',        salaire_median: 700000, demande_2030: 650 },
      { code: 'INGENIEUR_AGRONOME', nom: 'Ingenieur Agronome',      secteur: 'AGRICULTURE', salaire_median: 500000, demande_2030: 460 },
    ];
  }

  private formationsMock(): any[] {
    return [
      { code: 'BTS_INFO_IUT',         nom: 'BTS Informatique',      etablissement: 'IUT Abidjan', cout_annuel: 250000, duree_ans: 2 },
      { code: 'INGENIEUR_INFO_INPHB', nom: 'Ingenieur Informatique', etablissement: 'INPHB',       cout_annuel: 350000, duree_ans: 5 },
    ];
  }

  async ping(): Promise<any> {
    const nbMetiers    = this.ready ? (await this.pool.query('SELECT COUNT(*) FROM yira_metier_avenir')).rows[0].count    : '?';
    const nbFormations = this.ready ? (await this.pool.query('SELECT COUNT(*) FROM yira_formation_ci')).rows[0].count     : '?';
    return { status: 'YIRA-OS OK', connected: this.ready, metiers: nbMetiers, formations: nbFormations, timestamp: new Date().toISOString() };
  }
}