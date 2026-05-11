// ============================================================
// YIRA — src/modules/op/op.service.ts  (Sprint 8)
// Orientation Professionnelle — 5 segments CI
// ============================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService }  from '@nestjs/config';
import { IaService }      from '../../ia/ia.service';
import { PrismaClient }   from '@prisma/client-orientation';

// ── Types ─────────────────────────────────────────────────────

export type SegmentPro =
  | 'SALARIE_FORMEL'
  | 'ENTREPRENEUR_INFORMEL'
  | 'NEET'
  | 'RECONVERSION'
  | 'CADRE_FP_CI';

export interface ProfilPro {
  telephone:    string;
  country_code: string;
  prenom:       string;
  age:          number;
  zone:         string;
  milieu:       string;
  segment:      SegmentPro;
  // Profil RIASEC déjà calculé (depuis OsModule ou passation directe)
  code_holland: string;
  // Expérience
  annees_experience?: number;
  secteur_actuel?:    string;
  niveau_etude?:      string;
}

export interface SessionOpInput {
  profil:  ProfilPro;
  canal:   'APP' | 'WEB' | 'USSD';
}

export interface MetierCI {
  nom:           string;
  secteur:       string;
  compatibilite: number; // 0-100
  salaire_min?:  number; // FCFA/mois
  salaire_max?:  number;
  formation?:    string;
  acteurs_ci?:   string[];
}

export interface PiiEtape {
  delai:    'J+30' | 'J+90' | 'J+180';
  priorite: 'HAUTE' | 'MOYENNE' | 'BASSE';
  action:   string;
  acteur?:  string; // AGEFOP, ANADER, AGEPE...
  lien?:    string;
}

export interface ResultatOp {
  session_id:   string;
  segment:      SegmentPro;
  metiers_ci:   MetierCI[];
  pii:          PiiEtape[];
  rapport_nie:  string;
  sara_eligible: boolean;
  trust_index:  number;
  latency_ms:   number;
}

// ── Métiers CI par profil RIASEC ──────────────────────────────
const METIERS_CI: Record<string, MetierCI[]> = {
  R: [
    { nom:'Technicien BTP', secteur:'Construction', compatibilite:90,
      salaire_min:150000, salaire_max:400000, formation:'BTS Génie Civil',
      acteurs_ci:['AGEFOP','FDFP'] },
    { nom:'Mécanicien Auto', secteur:'Transport', compatibilite:85,
      salaire_min:100000, salaire_max:300000, formation:'CAP Mécanique' },
    { nom:'Électricien', secteur:'Énergie', compatibilite:88,
      salaire_min:120000, salaire_max:350000, formation:'BTS Électrotechnique' },
    { nom:'Agriculteur moderne', secteur:'Agribusiness', compatibilite:80,
      salaire_min:80000, salaire_max:500000, acteurs_ci:['ANADER'] },
  ],
  I: [
    { nom:'Développeur logiciel', secteur:'Tech/Numérique', compatibilite:95,
      salaire_min:300000, salaire_max:800000, formation:'Licence Informatique',
      acteurs_ci:['Hub Ivoire','CIPMEN'] },
    { nom:'Ingénieur data', secteur:'Tech/Numérique', compatibilite:90,
      salaire_min:400000, salaire_max:1000000, formation:'Master Data Science' },
    { nom:'Médecin', secteur:'Santé', compatibilite:88,
      salaire_min:500000, salaire_max:1500000, formation:'Doctorat Médecine' },
    { nom:'Analyste financier', secteur:'Banque-Finance', compatibilite:82,
      salaire_min:350000, salaire_max:900000 },
  ],
  A: [
    { nom:'Designer graphique', secteur:'Communication', compatibilite:92,
      salaire_min:150000, salaire_max:500000, acteurs_ci:['Hub Ivoire'] },
    { nom:'Journaliste', secteur:'Médias', compatibilite:85,
      salaire_min:120000, salaire_max:400000 },
    { nom:'Architecte', secteur:'BTP', compatibilite:88,
      salaire_min:400000, salaire_max:1200000, formation:'Diplôme Architecture' },
  ],
  S: [
    { nom:'Enseignant', secteur:'Éducation', compatibilite:95,
      salaire_min:150000, salaire_max:450000, formation:'CAFOP/INFPé',
      acteurs_ci:['MENET-FP'] },
    { nom:'Conseiller RH', secteur:'Ressources Humaines', compatibilite:90,
      salaire_min:250000, salaire_max:700000 },
    { nom:'Infirmier', secteur:'Santé', compatibilite:88,
      salaire_min:180000, salaire_max:450000, formation:'INFAS' },
    { nom:'Travailleur social', secteur:'ONG/Social', compatibilite:85,
      salaire_min:150000, salaire_max:400000, acteurs_ci:['UNICEF','ONUCI'] },
  ],
  E: [
    { nom:'Commercial/Vendeur', secteur:'Commerce', compatibilite:92,
      salaire_min:100000, salaire_max:600000 },
    { nom:'Chef de projet', secteur:'Management', compatibilite:90,
      salaire_min:350000, salaire_max:900000 },
    { nom:'Entrepreneur', secteur:'Informel/Formel', compatibilite:88,
      salaire_min:0, salaire_max:2000000, acteurs_ci:['CEPICI','BNI','AGEPE'] },
    { nom:'Responsable marketing', secteur:'Communication', compatibilite:85,
      salaire_min:300000, salaire_max:800000 },
  ],
  C: [
    { nom:'Comptable', secteur:'Finance', compatibilite:95,
      salaire_min:200000, salaire_max:600000, formation:'BTS Comptabilité' },
    { nom:'Gestionnaire RH', secteur:'Administration', compatibilite:88,
      salaire_min:250000, salaire_max:650000 },
    { nom:'Agent bancaire', secteur:'Banque', compatibilite:85,
      salaire_min:200000, salaire_max:500000 },
    { nom:'Statisticien', secteur:'Données', compatibilite:82,
      salaire_min:300000, salaire_max:700000 },
  ],
};

// ── Acteurs CI par segment ────────────────────────────────────
const ACTEURS_SEGMENT: Record<SegmentPro, string[]> = {
  SALARIE_FORMEL:        ['AGEPE', 'JobnetAfrica', 'LinkedIn CI'],
  ENTREPRENEUR_INFORMEL: ['CEPICI', 'BNI', 'Orange Money', 'Wave CI', 'FDFP'],
  NEET:                  ['AGEFOP', 'FDFP', 'AGEPE', 'Maison de l\'Emploi'],
  RECONVERSION:          ['AGEFOP', 'FDFP', 'CFPA', 'Centre de reconversion'],
  CADRE_FP_CI:           ['MFPE', 'ENA CI', 'CAFOP', 'Formation continue FP'],
};

@Injectable()
export class OpService implements OnModuleInit {
  private readonly logger = new Logger(OpService.name);
  private db: PrismaClient;

  constructor(private iaService: IaService, private config: ConfigService) {}

  async onModuleInit() {
    this.db = new PrismaClient({
      datasources: { db: { url: this.config.get('DATABASE_ORIENTATION_URL') } },
    });
    await this.db.$connect();
    this.logger.log('✅ OpService connecté à base_orientation');
  }

  // ── Point d'entrée principal ──────────────────────────────
  async genererRapportOp(input: SessionOpInput): Promise<ResultatOp> {
    const start      = Date.now();
    const session_id = `OP_${Date.now()}_${Math.random().toString(36).slice(2,7).toUpperCase()}`;

    // 1. Métiers compatibles
    const metiers_ci = this.matcherMetiers(input.profil);

    // 2. Plan d'insertion (PII)
    const pii = this.genererPII(input.profil);

    // 3. Éligibilité SARA (actifs informels / NEET)
    const sara_eligible = this.verifierSaraEligibilite(input.profil);

    // 4. Trust Index
    const trust_index = this.calculerTrust(input.profil);

    // 5. Rapport NIE professionnel
    const iaResult = await this.iaService.generate({
      module: 'YIRAOP', usage: 'NIE_RAPPORT_PRO',
      pays:   input.profil.country_code, canal: input.canal,
      variables: {
        prenom:           input.profil.prenom,
        age:              input.profil.age,
        profil_riasec:    input.profil.code_holland,
        segment:          input.profil.segment,
        zone:             input.profil.zone,
        metiers_top3:     metiers_ci.slice(0,3).map(m=>m.nom).join(', '),
        acteurs_ci:       ACTEURS_SEGMENT[input.profil.segment].join(', '),
        sara_eligible:    sara_eligible,
        trust_index:      trust_index,
      },
    });

    this.logger.log(`✅ Rapport OP généré — ${session_id} — ${input.profil.segment}`);

    return {
      session_id, segment: input.profil.segment,
      metiers_ci, pii, rapport_nie: iaResult.text ?? '',
      sara_eligible, trust_index, latency_ms: Date.now() - start,
    };
  }

  // ── Matcher les métiers selon le profil RIASEC ────────────
  private matcherMetiers(profil: ProfilPro): MetierCI[] {
    const dims  = profil.code_holland.split('');
    const found = new Map<string, MetierCI>();

    for (const dim of dims) {
      for (const metier of (METIERS_CI[dim] ?? [])) {
        if (!found.has(metier.nom)) {
          // Ajuster la compatibilité selon le segment
          let compat = metier.compatibilite;
          if (profil.segment === 'ENTREPRENEUR_INFORMEL' && dim === 'E') compat += 5;
          if (profil.segment === 'NEET') compat = Math.max(50, compat - 10);
          found.set(metier.nom, { ...metier, compatibilite: Math.min(100, compat) });
        }
      }
    }

    return Array.from(found.values())
      .sort((a,b) => b.compatibilite - a.compatibilite)
      .slice(0, 6);
  }

  // ── Générer le PII (Plan d'Insertion Individualisé) ───────
  private genererPII(profil: ProfilPro): PiiEtape[] {
    const acteurs = ACTEURS_SEGMENT[profil.segment];
    const pii: PiiEtape[] = [];

    switch (profil.segment) {
      case 'SALARIE_FORMEL':
        pii.push(
          { delai:'J+30', priorite:'HAUTE', action:'Mettre à jour son CV et profil LinkedIn CI', acteur:'AGEPE' },
          { delai:'J+30', priorite:'HAUTE', action:`Déposer 5 candidatures dans le secteur ${profil.code_holland[0]}`, acteur:'JobnetAfrica' },
          { delai:'J+90', priorite:'MOYENNE', action:'Passer une certification professionnelle reconnue CI', acteur:'FDFP' },
          { delai:'J+180', priorite:'MOYENNE', action:'Négocier une période d\'essai ou stage qualifiant', acteur:'AGEPE' },
        );
        break;

      case 'ENTREPRENEUR_INFORMEL':
        pii.push(
          { delai:'J+30', priorite:'HAUTE', action:'Formaliser son activité au CEPICI (guichet unique)', acteur:'CEPICI', lien:'cepici.ci' },
          { delai:'J+30', priorite:'HAUTE', action:'Ouvrir un compte Orange Money Business ou Wave Business', acteur:'Orange Money / Wave CI' },
          { delai:'J+90', priorite:'HAUTE', action:'Accéder au financement BNI PME (micro-crédit)', acteur:'BNI', lien:'bni.ci' },
          { delai:'J+90', priorite:'MOYENNE', action:'Formation gestion PME via FDFP (financement possible)', acteur:'FDFP', lien:'fdfp.ci' },
          { delai:'J+180', priorite:'MOYENNE', action:'Rejoindre une coopérative ou groupement professionnel CI' },
        );
        break;

      case 'NEET':
        pii.push(
          { delai:'J+30', priorite:'HAUTE', action:'S\'inscrire à l\'AGEPE pour bénéficier des programmes emploi jeunes', acteur:'AGEPE', lien:'agepe.ci' },
          { delai:'J+30', priorite:'HAUTE', action:'Identifier une formation courte (3-6 mois) à l\'AGEFOP', acteur:'AGEFOP', lien:'agefop.ci' },
          { delai:'J+90', priorite:'HAUTE', action:'Intégrer un programme d\'insertion professionnelle CI', acteur:'FDFP' },
          { delai:'J+90', priorite:'MOYENNE', action:'Développer une compétence numérique de base (bureautique)', acteur:'Hub Ivoire' },
          { delai:'J+180', priorite:'MOYENNE', action:'Viser un emploi ou auto-emploi dans son secteur de compétence' },
        );
        break;

      case 'RECONVERSION':
        pii.push(
          { delai:'J+30', priorite:'HAUTE', action:'Bilan de compétences approfondi avec un conseiller AGEFOP', acteur:'AGEFOP' },
          { delai:'J+30', priorite:'HAUTE', action:'Identifier les passerelles entre ancien et nouveau secteur' },
          { delai:'J+90', priorite:'HAUTE', action:'Formation de reconversion financée par FDFP (CPF CI)', acteur:'FDFP' },
          { delai:'J+180', priorite:'MOYENNE', action:'Stage de transition dans le nouveau secteur visé' },
        );
        break;

      case 'CADRE_FP_CI':
        pii.push(
          { delai:'J+30', priorite:'HAUTE', action:'Identifier les concours administratifs ouverts au MFPE', acteur:'MFPE' },
          { delai:'J+30', priorite:'HAUTE', action:'Préparer le dossier de candidature ENA CI si éligible', acteur:'ENA CI' },
          { delai:'J+90', priorite:'MOYENNE', action:'Formation continue FP dans son domaine de compétence', acteur:'CAFOP' },
          { delai:'J+180', priorite:'MOYENNE', action:'Viser une promotion interne ou changement de corps' },
        );
        break;
    }

    return pii;
  }

  // ── Éligibilité SARA ──────────────────────────────────────
  private verifierSaraEligibilite(profil: ProfilPro): boolean {
    return profil.segment === 'ENTREPRENEUR_INFORMEL' ||
           profil.segment === 'NEET' ||
           (profil.segment === 'SALARIE_FORMEL' && profil.milieu === 'RURAL');
  }

  // ── Trust Index ───────────────────────────────────────────
  private calculerTrust(profil: ProfilPro): number {
    let s = 40;
    s += profil.code_holland ? 20 : 0;
    s += profil.age ? 10 : 0;
    s += profil.zone ? 10 : 0;
    s += profil.annees_experience !== undefined ? 10 : 0;
    s += profil.niveau_etude ? 10 : 0;
    return Math.min(100, s);
  }
}