// =============================================================================
// YIRA V3.0 — OpService (YIRA-OP)
// Sprint 41 — Fix: ::jsonb cast + secteur_cible + plan emploi cohérent
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool }          from 'pg';
import { ConfigService } from '@nestjs/config';
import { IaService }     from '../../ia/ia.service';

export interface ProfilOrientation {
  telephone:       string;
  country_code:    string;
  niveau:          'BEPC' | 'BAC' | 'BAC_PLUS' | 'SANS_DIPLOME';
  serie?:          string;
  moyenne?:        number;
  riasec?:         { r: number; i: number; a: number; s: number; e: number; c: number };
  big_five?:       { o: number; c: number; e: number; a: number; n: number };
  trust_index?:    number;
  region?:         string;
  budget_parents?: number;
  objectif?:       'SCOLAIRE' | 'EMPLOI' | 'RECONVERSION';
  genre?:          'M' | 'F';
  experience_ans?: number;
  secteur_cible?:  string;
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
  cv_genere?:          string;
  lettre_motivation?:  string;
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

  async evaluer(profil: ProfilOrientation): Promise<RapportNIE> {
    this.logger.log('[OP] Evaluation NIE pour ' + profil.telephone);
    const [filieres, metiers, formations] = await Promise.all([
      this.recommanderFilieres(profil),
      this.recommanderMetiers(profil),
      this.recommanderFormations(profil),
    ]);
    const objectif      = profil.objectif ?? 'SCOLAIRE';
    const plan_coaching = objectif === 'EMPLOI'
      ? this.genererPlanEmploi(profil, metiers[0])
      : this.genererPlanCoaching(profil, filieres[0], metiers[0]);
    const budget_parents = this.calculerBudgetParents(formations[0], profil.budget_parents);
    const message        = await this.genererMessageIA(profil, filieres, metiers);
    const rapport: RapportNIE = {
      profil, filieres, metiers, formations,
      plan_coaching, budget_parents,
      message_orientation: message,
      score_confiance: profil.trust_index ?? 75,
    };
    if (objectif === 'EMPLOI') {
      rapport.cv_genere         = await this.genererCV(profil, metiers[0]);
      rapport.lettre_motivation = await this.genererLettre(profil, metiers[0]);
    }
    await this.sauvegarderRapport(rapport);
    return rapport;
  }

  private async recommanderFilieres(profil: ProfilOrientation): Promise<any[]> {
    if (profil.niveau === 'BEPC') return this.recommanderFilieres2nde(profil);
    if (!this.ready) return this.filieresMock(profil);
    try {
      const dominant = profil.riasec ? this.getDominantRiasec(profil.riasec) : ['I', 'S'];
      const d0 = dominant[0];
      const d1 = dominant[1];
      const res = await this.pool.query(`
        SELECT f.*,
          (CASE
            WHEN (f.riasec_vecteur::jsonb->>'${d0}')::int > 60 THEN 3
            WHEN (f.riasec_vecteur::jsonb->>'${d1}')::int > 60 THEN 1
            ELSE 0 END) as score_riasec
        FROM yira_filiere_universite f
        WHERE f.tenant_id = 'CI'
        ORDER BY score_riasec DESC, f.taux_emploi DESC NULLS LAST
        LIMIT 5
      `);
      if (res.rows.length > 0) return res.rows;
    } catch (e: any) {
      this.logger.warn('[OP] Erreur filieres BAC: ' + e.message);
    }
    return this.filieresMock(profil);
  }

  private recommanderFilieres2nde(profil: ProfilOrientation): any[] {
    const moyenne = profil.moyenne ?? 10;
    const r = profil.riasec?.r ?? 50;
    const i = profil.riasec?.i ?? 50;
    const a = profil.riasec?.a ?? 50;
    const s = profil.riasec?.s ?? 50;
    const filieres: any[] = [];
    if (moyenne >= 12 && i >= 60)
      filieres.push({ code: '2nde_C', nom: '2nde C — Sciences (vers Bac C/D)', score_match: 90, seuil_min: 12.5, horizon: 'Ingenieur, Medecin, Informaticien', type: 'LYCEE_GEN' });
    if (moyenne >= 10 && (a >= 50 || s >= 50))
      filieres.push({ code: '2nde_A', nom: '2nde A — Lettres (vers Bac A/B)', score_match: 75, seuil_min: 10.0, horizon: 'Juriste, Journaliste, Enseignant', type: 'LYCEE_GEN' });
    if (i >= 50 || r >= 50)
      filieres.push({ code: 'LYCEE_TECH_INFO', nom: 'Lycee Technique Informatique', score_match: 80, seuil_min: 9.0, horizon: 'Dev Junior, Technicien IT', type: 'LYCEE_TECH' });
    if (r >= 60)
      filieres.push({ code: 'LYCEE_TECH_ELEC', nom: 'Lycee Technique Electronique', score_match: 70, seuil_min: 9.0, horizon: 'Technicien SODECI/CIE', type: 'LYCEE_TECH' });
    if (moyenne < 10)
      filieres.push({ code: 'FORMATION_PRO', nom: 'Formation Professionnelle AGEFOP', score_match: 85, seuil_min: 7.5, horizon: 'Metier manuel qualifie — insertion rapide', type: 'FORMATION_PRO' });
    if (filieres.length === 0)
      filieres.push({ code: '2nde_A', nom: '2nde A — Lettres', score_match: 60, seuil_min: 10.0, horizon: 'Enseignant, Juriste', type: 'LYCEE_GEN' });
    return filieres.sort((a, b) => b.score_match - a.score_match).slice(0, 4);
  }

  private async recommanderMetiers(profil: ProfilOrientation): Promise<any[]> {
    if (!this.ready) return this.metiersMock(profil);
    try {
      const dominant      = profil.riasec ? this.getDominantRiasec(profil.riasec) : ['I', 'S'];
      const secteurFilter = profil.secteur_cible ? 'AND m.secteur = $3' : '';
      const params: any[] = [dominant, dominant.slice(0, 1)];
      if (profil.secteur_cible) params.push(profil.secteur_cible);
      const res = await this.pool.query(`
        SELECT m.*,
               CASE WHEN m.riasec_codes && $1 THEN 3
                    WHEN m.riasec_codes && $2 THEN 1
                    ELSE 0 END as score_match
        FROM yira_metier_avenir m
        WHERE m.tenant_id = 'CI' ${secteurFilter}
        ORDER BY score_match DESC, m.demande_2030 DESC
        LIMIT 8
      `, params);
      if (res.rows.length > 0) return res.rows;
    } catch (e: any) {
      this.logger.warn('[OP] Erreur metiers: ' + e.message);
    }
    return this.metiersMock(profil);
  }

  private async recommanderFormations(profil: ProfilOrientation): Promise<any[]> {
    if (!this.ready) return this.formationsMock();
    try {
      const niveauEntree = profil.niveau === 'BAC' ? profil.serie ?? 'BAC' : profil.niveau;
      const res = await this.pool.query(`
        SELECT f.* FROM yira_formation_ci f
        WHERE f.tenant_id = 'CI'
          AND (f.filieres_bac @> $1 OR f.niveau_entree = $2)
        ORDER BY f.cout_annuel ASC LIMIT 6
      `, [[niveauEntree], niveauEntree]);
      if (res.rows.length > 0) return res.rows;
    } catch (e: any) {
      this.logger.warn('[OP] Erreur formations: ' + e.message);
    }
    return this.formationsMock();
  }

  private genererPlanCoaching(profil: ProfilOrientation, filiere: any, metier: any): any {
    const filiereCible = filiere?.nom ?? 'Filiere scientifique';
    const metierCible  = metier?.nom  ?? 'Metier tech';
    const moyenne      = profil.moyenne ?? 12;
    return {
      type: 'SCOLAIRE', filiere_cible: filiereCible, metier_cible: metierCible,
      j30: {
        titre: 'Consolidation scolaire',
        actions: [
          'Renforcement en ' + (moyenne < 12 ? 'Maths et Francais' : 'matieres scientifiques') + ' (2h/semaine)',
          'Inscription aux cours de soutien ONFP',
          'Test de positionnement YIRA-QUIZ ' + filiereCible,
        ],
        objectif: 'Atteindre moyenne ' + Math.min(14, moyenne + 1) + '/20',
      },
      j90: {
        titre: 'Preparation candidature',
        actions: [
          'Concours blanc DREN (inscription avant dec.)',
          'Visite etablissements recommandes',
          'Constitution du dossier inscription',
          'Rencontre professionnel secteur ' + (metier?.secteur ?? 'TECH'),
        ],
        objectif: 'Dossier complet + lettre de motivation redigee',
      },
      j180: {
        titre: 'Inscription et suivi',
        actions: [
          'Depot dossier ' + filiereCible + ' avant date limite',
          'Inscription concours entree si requis',
          'Plan financement valide avec les parents',
          'Ouverture carnet SARA epargne scolarite',
        ],
        objectif: 'Inscription confirmee pour la rentree suivante',
      },
    };
  }

  private genererPlanEmploi(profil: ProfilOrientation, metier: any): any {
    const metierCible = metier?.nom ?? 'Technicien';
    const secteur     = profil.secteur_cible ?? metier?.secteur ?? 'TECH';
    return {
      type: 'EMPLOI', metier_cible: metierCible, secteur,
      j7: {
        titre: 'CV + Lettre de motivation',
        actions: [
          'Generer votre CV YIRA (profil composite inclus)',
          'Generer votre lettre de motivation inculturee CI',
          'Creer un profil LinkedIn/Jumia Jobs',
          'Identifier 5 entreprises cibles secteur ' + secteur + ' a ' + (profil.region ?? 'Abidjan'),
        ],
        objectif: 'CV + Lettre prets pour candidature',
      },
      j30: {
        titre: 'Candidatures actives',
        actions: [
          'Deposer 10 candidatures minimum (AGEPE + Jumia Jobs + LinkedIn)',
          'Coaching entretien YIRA (simulation)',
          'Inscription AGEPE (Agence Emploi Jeunes CI)',
          'Rejoindre groupes WhatsApp emploi ' + secteur + ' ' + (profil.region ?? 'Abidjan'),
        ],
        objectif: 'Au moins 3 entretiens obtenus',
      },
      j90: {
        titre: 'Suivi insertion',
        actions: [
          'Relance candidatures en attente',
          'Elargir secteurs cibles si necessaire',
          'Formation complementaire courte (AGEFOP si disponible)',
          'Mise a jour profil YIRA avec competences acquises',
        ],
        objectif: 'Premier contrat ou stage signe',
      },
      j180: {
        titre: 'Consolidation emploi',
        actions: [
          'Bilan mi-parcours avec conseiller YIRA',
          'Negociation salaire si CDD -> CDI',
          'Ouverture epargne SARA sur salaire',
          'Identification formation complementaire metier',
        ],
        objectif: 'Contrat stable + epargne demarree',
      },
      j365: {
        titre: 'Bilan annuel insertion',
        actions: [
          'Evaluation Trust Index post-emploi',
          'Mise a jour Passeport de Competences YIRA',
          'Validation KPI cohorte pour bailleurs',
          'Orientation vers YIRA-EVAL si promotion',
        ],
        objectif: 'Insertion durable confirmee + KPI ODD 8 valide',
      },
    };
  }

  async genererCV(profil: ProfilOrientation, metier: any): Promise<string> {
    const secteur = profil.secteur_cible ?? metier?.secteur ?? 'TECH';
    const prompt  =
      'Tu es l\'agent CV YIRA pour la Cote d\'Ivoire. ' +
      'Genere un CV professionnel court (max 250 mots) adapte au marche ivoirien. ' +
      'Format: NOM PRENOM | Telephone | Objectif | Competences | Formation | Langues. ' +
      'Profil: niveau ' + profil.niveau + ', region ' + (profil.region ?? 'Abidjan') + ', ' +
      'secteur cible: ' + secteur + ', ' +
      'metier cible: ' + (metier?.nom ?? 'Technicien') + ', ' +
      'RIASEC dominant: ' + (profil.riasec ? this.getDominantRiasec(profil.riasec)[0] : 'I') + '. ' +
      'Ton: professionnel adapte aux recruteurs ivoiriens. Utilise [A COMPLETER] pour donnees personnelles.';
    try {
      const result = await this.ia.generate({ module: 'YIRA_OP', usage: 'CV_GENERATION', pays: profil.country_code ?? 'CI', canal: 'APP', variables: {}, customPrompt: prompt });
      return result.text ?? this.cvMock(profil, metier);
    } catch (e: any) {
      this.logger.warn('[OP] Erreur CV: ' + e.message);
      return this.cvMock(profil, metier);
    }
  }

  async genererLettre(profil: ProfilOrientation, metier: any): Promise<string> {
    const secteur = profil.secteur_cible ?? metier?.secteur ?? 'TECH';
    const prompt  =
      'Tu es l\'agent Lettre YIRA pour la Cote d\'Ivoire. ' +
      'Genere une lettre de motivation courte (max 200 mots) adaptee au marche ivoirien. ' +
      'Profil: niveau ' + profil.niveau + ', region ' + (profil.region ?? 'Abidjan') + ', ' +
      'secteur: ' + secteur + ', metier cible: ' + (metier?.nom ?? 'Technicien') + '. ' +
      'Structure: Accroche CI | Motivation poste | Valeur ajoutee | Conclusion. ' +
      'Utilise [NOM], [ENTREPRISE], [DATE] comme variables.';
    try {
      const result = await this.ia.generate({ module: 'YIRA_OP', usage: 'LETTRE_GENERATION', pays: profil.country_code ?? 'CI', canal: 'APP', variables: {}, customPrompt: prompt });
      return result.text ?? this.lettreMock(profil, metier);
    } catch (e: any) {
      this.logger.warn('[OP] Erreur Lettre: ' + e.message);
      return this.lettreMock(profil, metier);
    }
  }

  private calculerBudgetParents(formation: any, budgetDisponible?: number): any {
    const coutAnnuel     = formation?.cout_annuel ?? 500000;
    const duree          = formation?.duree_ans   ?? 3;
    const totalFormation = coutAnnuel * duree;
    const fraisVie       = 150000 * 12 * duree;
    const totalEstime    = totalFormation + fraisVie;
    const epargne_mensuelle = Math.ceil(totalEstime / (duree * 12));
    const epargne_sara_jour = Math.ceil(epargne_mensuelle / 30);
    return {
      formation: formation?.nom ?? 'Formation recommandee',
      cout_annuel: coutAnnuel, duree_ans: duree,
      total_formation: totalFormation, frais_vie: fraisVie, total_estime: totalEstime,
      budget_disponible: budgetDisponible ?? 0,
      deficit: Math.max(0, totalEstime - (budgetDisponible ?? 0)),
      plan_epargne: {
        mensuel_recommande: epargne_mensuelle, sara_jour: epargne_sara_jour,
        message: 'Ouvrir un carnet SARA de ' + epargne_sara_jour + ' FCFA/jour',
      },
      roi: {
        salaire_median_apres: 450000,
        mois_remboursement:   Math.ceil(totalEstime / 450000),
        message: 'ROI estime: ' + Math.ceil(totalEstime / 450000) + ' mois apres insertion',
      },
    };
  }

  private async genererMessageIA(profil: ProfilOrientation, filieres: any[], metiers: any[]): Promise<string> {
    const figure   = profil.genre === 'F' ? 'GRANDE_SOEUR_ORIENTATION_V1' : 'VIEUX_PERE_ORIENTATION_V2';
    const objectif = profil.objectif ?? 'SCOLAIRE';
    try {
      const promptData = await this.obtenirPromptBaseCore(figure);
      const guardrails = promptData?.guardrails ?? {};
      const contexte   = objectif === 'EMPLOI'
        ? 'secteur: ' + (profil.secteur_cible ?? metiers[0]?.secteur ?? 'TECH') + ', metier: ' + (metiers[0]?.nom ?? 'Tech')
        : 'filiere: ' + (filieres[0]?.nom ?? 'Sciences') + ', horizon metier: ' + (metiers[0]?.nom ?? 'Tech');
      const promptUser = promptData?.prompt_user_template
        ? promptData.prompt_user_template
            .replace('{{niveau}}',  profil.niveau ?? '')
            .replace('{{serie}}',   profil.serie  ?? 'non precise')
            .replace('{{moyenne}}', String(profil.moyenne ?? 'non precisee'))
            .replace('{{filiere}}', filieres[0]?.nom ?? 'Sciences')
            .replace('{{metier}}',  metiers[0]?.nom  ?? 'Tech')
            .replace('{{region}}',  profil.region    ?? 'Abidjan')
        : 'Jeune niveau ' + profil.niveau + ', objectif ' + objectif + ', ' + contexte + ', region ' + (profil.region ?? 'Abidjan') + '. Max 280 chars.';
      const promptSysteme = promptData?.prompt_system ?? (
        profil.genre === 'F'
          ? 'Tu es la Grande Soeur bienveillante de YIRA CI. Ton chaleureux, references ivoiriennes, sans emojis excessifs. Max 280 chars. Coherente avec la filiere ou le secteur recommande.'
          : 'Tu es le Vieux Pere bienveillant de YIRA CI. Ton mentorat, references ivoiriennes. Max 280 chars. Coherent avec la filiere ou le secteur recommande.'
      );
      const result = await this.ia.generate({ module: 'YIRA_OP', usage: 'ORIENTATION_NIE', pays: profil.country_code ?? 'CI', canal: 'APP', variables: {}, customPrompt: promptSysteme + '\n\n' + promptUser });
      return this.appliquerGuardrails(result.text ?? this.messageMock(profil, filieres, metiers), guardrails);
    } catch (e: any) {
      this.logger.warn('[OP] Erreur IA message: ' + e.message);
      return this.messageMock(profil, filieres, metiers);
    }
  }

  private async obtenirPromptBaseCore(promptKey: string): Promise<any> {
    try {
      const res = await this.poolCore.query(
        'SELECT prompt_system, prompt_user_template, guardrails, cqci_filters FROM core.ia_prompts WHERE prompt_key = $1 AND tenant_id = $2 AND status = $3 ORDER BY version DESC LIMIT 1',
        [promptKey, 'CI', 'ACTIVE']
      );
      if (res.rows.length > 0) { this.logger.log('[OP] Prompt ' + promptKey + ' charge'); return res.rows[0]; }
    } catch (e: any) { this.logger.warn('[OP] Erreur prompt: ' + e.message); }
    return null;
  }

  private appliquerGuardrails(message: string, guardrails: any): string {
    const forbidden:   string[] = guardrails?.forbidden_words ?? [];
    const maxChars:    number   = guardrails?.max_chars ?? 280;
    const sosKeywords: string[] = guardrails?.sos_keywords ?? ['desespoir', 'mourir', 'suicide'];
    if (sosKeywords.some(mot => message.toLowerCase().includes(mot))) {
      this.logger.error('[OP][GUARDRAIL][SOS] Trigger detecte');
      return 'YIRA est la pour toi. Compose le *7572*5# si tu traverses une periode difficile. Tu n es pas seul(e).';
    }
    const motsTrouves = forbidden.filter(mot => message.toLowerCase().includes(mot.toLowerCase()));
    if (motsTrouves.length > 0) {
      this.logger.warn('[OP][GUARDRAIL] Mots interdits: ' + motsTrouves.join(', '));
      return 'Mon enfant, avec ton profil, tu as de vraies opportunites en Cote d Ivoire. YIRA t accompagne!';
    }
    if (message.length > maxChars) {
      const tronque      = message.slice(0, maxChars - 3).trim();
      const dernierPoint = Math.max(tronque.lastIndexOf('.'), tronque.lastIndexOf('!'), tronque.lastIndexOf('?'));
      return dernierPoint > maxChars * 0.7 ? tronque.slice(0, dernierPoint + 1) : tronque + '...';
    }
    return message;
  }

  private async sauvegarderRapport(rapport: RapportNIE): Promise<void> {
    if (!this.ready) return;
    try {
      const dominantRiasec = rapport.profil.riasec
        ? Object.entries(rapport.profil.riasec).sort(([, a], [, b]) => (b as number) - (a as number))[0][0].toUpperCase()
        : 'I';
      await this.pool.query(
        'INSERT INTO yira_analyse_os (id, utilisateur_id, type_moteur, code_riasec, top1_filiere_code, top1_score_global, plan_action, trust_index_ajout) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)',
        [rapport.profil.telephone, 'YIRA-OP-V41', dominantRiasec, rapport.filieres[0]?.code ?? 'SEC_D', rapport.filieres[0]?.score_match ?? 75, JSON.stringify(rapport.plan_coaching), rapport.profil.trust_index ?? 75]
      );
    } catch (e: any) { this.logger.warn('[OP] Erreur sauvegarde: ' + e.message); }
  }

  private getDominantRiasec(riasec: any): string[] {
    return Object.entries(riasec).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 2).map(([k]) => k.toUpperCase());
  }

  private messageMock(profil: ProfilOrientation, filieres: any[], metiers: any[]): string {
    const figure = profil.genre === 'F' ? 'Ma fille' : 'Mon enfant';
    const contexte = profil.objectif === 'EMPLOI'
      ? 'dans le secteur ' + (profil.secteur_cible ?? metiers[0]?.secteur ?? 'TECH') + ' a Abidjan'
      : 'en ' + (filieres[0]?.nom ?? 'Sciences');
    return figure + ', ton profil YIRA est clair. Tu as de vraies opportunites ' + contexte + '. YIRA croit en toi!';
  }

  private cvMock(profil: ProfilOrientation, metier: any): string {
    const secteur = profil.secteur_cible ?? metier?.secteur ?? 'TECH';
    return '[NOM PRENOM] | [TELEPHONE] | ' + (profil.region ?? 'Abidjan') + '\n' +
      'OBJECTIF: Poste de ' + (metier?.nom ?? 'Technicien') + ' — ' + secteur + '\n' +
      'FORMATION: ' + profil.niveau + (profil.serie ? ' serie ' + profil.serie : '') + '\n' +
      'COMPETENCES: [A COMPLETER]\nLANGUES: Francais (courant), [autres]';
  }

  private lettreMock(profil: ProfilOrientation, metier: any): string {
    const secteur = profil.secteur_cible ?? metier?.secteur ?? 'TECH';
    return '[NOM], le [DATE]\nObjet: Candidature ' + (metier?.nom ?? 'Technicien') + '\n\n' +
      'Madame, Monsieur,\nPassionne(e) par le secteur ' + secteur + ' en Cote d\'Ivoire, ' +
      'je souhaite integrer [ENTREPRISE].\nMon profil YIRA (' + profil.niveau + ') correspond au poste.\n' +
      'Cordialement,\n[NOM PRENOM]';
  }

  private filieresMock(profil: ProfilOrientation): any[] {
    return [
      { code: 'SEC_D', nom: 'Terminale D — Sciences de la Vie', score_match: 90, seuil_min: 11 },
      { code: 'SEC_C', nom: 'Terminale C — Mathematiques',      score_match: 75, seuil_min: 13 },
    ];
  }

  private metiersMock(profil: ProfilOrientation): any[] {
    return [
      { code: 'DEV_WEB_MOBILE', nom: 'Developpeur Web/Mobile', secteur: 'TECH',   salaire_median: 450000, demande_2030: 580 },
      { code: 'DATA_SCIENTIST', nom: 'Data Scientist',          secteur: 'TECH',   salaire_median: 700000, demande_2030: 650 },
      { code: 'COMPTABLE',      nom: 'Comptable',               secteur: 'FINANCE', salaire_median: 350000, demande_2030: 400 },
    ];
  }

  private formationsMock(): any[] {
    return [
      { code: 'BTS_INFO_IUT',         nom: 'BTS Informatique',      etablissement: 'IUT Abidjan', cout_annuel: 250000, duree_ans: 2 },
      { code: 'INGENIEUR_INFO_INPHB', nom: 'Ingenieur Informatique', etablissement: 'INPHB',       cout_annuel: 350000, duree_ans: 5 },
    ];
  }

  async ping(): Promise<any> {
    const nbMetiers    = this.ready ? (await this.pool.query('SELECT COUNT(*) FROM yira_metier_avenir')).rows[0].count : '?';
    const nbFormations = this.ready ? (await this.pool.query('SELECT COUNT(*) FROM yira_formation_ci')).rows[0].count  : '?';
    return { status: 'YIRA-OP OK', connected: this.ready, metiers: nbMetiers, formations: nbFormations, timestamp: new Date().toISOString() };
  }
}