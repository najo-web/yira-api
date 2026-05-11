// ============================================================
// YIRA — src/modules/op/op.service.ts  (v2 + freemium)
// ============================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService }     from '@nestjs/config';
import { IaService }         from '../../ia/ia.service';
import { FreemiumService }   from '../freemium/freemium.service';
import { PrismaClient }      from '@prisma/client-orientation';

export type SegmentPro = 'SALARIE_FORMEL' | 'ENTREPRENEUR_INFORMEL' | 'NEET' | 'RECONVERSION' | 'CADRE_FP_CI';

export interface ProfilPro {
  telephone: string; country_code: string; prenom: string; age: number;
  zone: string; milieu: string; segment: SegmentPro; code_holland: string;
  annees_experience?: number; secteur_actuel?: string; niveau_etude?: string;
  niveau_acces?: string; // FREE · BASIC · PREMIUM
}
export interface SessionOpInput { profil: ProfilPro; canal: 'APP' | 'WEB' | 'USSD' }
export interface MetierCI {
  nom: string; secteur: string; compatibilite: number;
  salaire_min?: number; salaire_max?: number;
  formation?: string; acteurs_ci?: string[];
}
export interface PiiEtape {
  delai: 'J+30' | 'J+90' | 'J+180'; priorite: string;
  action: string; acteur?: string; lien?: string;
}
export interface ResultatOp {
  session_id: string; segment: SegmentPro;
  metiers_ci: MetierCI[]; pii: PiiEtape[];
  rapport_nie: string; sara_eligible?: boolean;
  trust_index: number | string; latency_ms: number;
  _upgrade_message?: string; _upgrade_lien?: string;
}

const METIERS_CI: Record<string, MetierCI[]> = {
  R:[
    {nom:'Technicien BTP',secteur:'Construction',compatibilite:90,salaire_min:150000,salaire_max:400000,formation:'BTS Génie Civil',acteurs_ci:['AGEFOP','FDFP']},
    {nom:'Mécanicien Auto',secteur:'Transport',compatibilite:85,salaire_min:100000,salaire_max:300000},
    {nom:'Électricien',secteur:'Énergie',compatibilite:88,salaire_min:120000,salaire_max:350000},
    {nom:'Agriculteur moderne',secteur:'Agribusiness',compatibilite:80,salaire_min:80000,salaire_max:500000,acteurs_ci:['ANADER']},
  ],
  I:[
    {nom:'Développeur logiciel',secteur:'Tech',compatibilite:95,salaire_min:300000,salaire_max:800000,acteurs_ci:['Hub Ivoire']},
    {nom:'Ingénieur data',secteur:'Tech',compatibilite:90,salaire_min:400000,salaire_max:1000000},
    {nom:'Médecin',secteur:'Santé',compatibilite:88,salaire_min:500000,salaire_max:1500000},
    {nom:'Analyste financier',secteur:'Finance',compatibilite:82,salaire_min:350000,salaire_max:900000},
  ],
  A:[
    {nom:'Designer graphique',secteur:'Communication',compatibilite:92,salaire_min:150000,salaire_max:500000,acteurs_ci:['Hub Ivoire']},
    {nom:'Journaliste',secteur:'Médias',compatibilite:85,salaire_min:120000,salaire_max:400000},
    {nom:'Architecte',secteur:'BTP',compatibilite:88,salaire_min:400000,salaire_max:1200000},
  ],
  S:[
    {nom:'Enseignant',secteur:'Éducation',compatibilite:95,salaire_min:150000,salaire_max:450000,formation:'CAFOP/INFPé',acteurs_ci:['MENET-FP']},
    {nom:'Conseiller RH',secteur:'RH',compatibilite:90,salaire_min:250000,salaire_max:700000},
    {nom:'Infirmier',secteur:'Santé',compatibilite:88,salaire_min:180000,salaire_max:450000,formation:'INFAS'},
    {nom:'Travailleur social',secteur:'ONG',compatibilite:85,salaire_min:150000,salaire_max:400000,acteurs_ci:['UNICEF']},
  ],
  E:[
    {nom:'Commercial/Vendeur',secteur:'Commerce',compatibilite:92,salaire_min:100000,salaire_max:600000},
    {nom:'Chef de projet',secteur:'Management',compatibilite:90,salaire_min:350000,salaire_max:900000},
    {nom:'Entrepreneur',secteur:'Informel/Formel',compatibilite:88,salaire_min:0,salaire_max:2000000,acteurs_ci:['CEPICI','BNI','AGEPE']},
    {nom:'Responsable marketing',secteur:'Communication',compatibilite:85,salaire_min:300000,salaire_max:800000},
  ],
  C:[
    {nom:'Comptable',secteur:'Finance',compatibilite:95,salaire_min:200000,salaire_max:600000,formation:'BTS Comptabilité'},
    {nom:'Gestionnaire RH',secteur:'Administration',compatibilite:88,salaire_min:250000,salaire_max:650000},
    {nom:'Agent bancaire',secteur:'Banque',compatibilite:85,salaire_min:200000,salaire_max:500000},
    {nom:'Statisticien',secteur:'Données',compatibilite:82,salaire_min:300000,salaire_max:700000},
  ],
};

const ACTEURS_SEGMENT: Record<SegmentPro, string[]> = {
  SALARIE_FORMEL:        ['AGEPE','JobnetAfrica','LinkedIn CI'],
  ENTREPRENEUR_INFORMEL: ['CEPICI','BNI','Orange Money','Wave CI','FDFP'],
  NEET:                  ['AGEFOP','FDFP','AGEPE','Maison de l\'Emploi'],
  RECONVERSION:          ['AGEFOP','FDFP','CFPA'],
  CADRE_FP_CI:           ['MFPE','ENA CI','CAFOP'],
};

@Injectable()
export class OpService implements OnModuleInit {
  private readonly logger = new Logger(OpService.name);
  private db: PrismaClient;

  constructor(
    private iaService:       IaService,
    private config:          ConfigService,
    private freemiumService: FreemiumService,
  ) {}

  async onModuleInit() {
    this.db = new PrismaClient({
      datasources: { db: { url: this.config.get('DATABASE_ORIENTATION_URL') } },
    });
    await this.db.$connect();
    this.logger.log('✅ OpService connecté à base_orientation');
  }

  async genererRapportOp(input: SessionOpInput): Promise<ResultatOp> {
    const start      = Date.now();
    const session_id = `OP_${Date.now()}_${Math.random().toString(36).slice(2,7).toUpperCase()}`;

    const metiers_ci    = this.matcherMetiers(input.profil);
    const pii           = this.genererPII(input.profil);
    const sara_eligible = this.verifierSara(input.profil);
    const trust_index   = this.calculerTrust(input.profil);

    const iaResult = await this.iaService.generate({
      module: 'YIRAOP', usage: 'NIE_RAPPORT_PRO',
      pays: input.profil.country_code, canal: input.canal,
      variables: {
        prenom: input.profil.prenom, age: input.profil.age,
        profil_riasec: input.profil.code_holland, segment: input.profil.segment,
        zone: input.profil.zone,
        metiers_top3: metiers_ci.slice(0,3).map(m=>m.nom).join(', '),
        acteurs_ci: ACTEURS_SEGMENT[input.profil.segment].join(', '),
        sara_eligible, trust_index,
      },
    });

    const resultat: ResultatOp = {
      session_id, segment: input.profil.segment,
      metiers_ci, pii, rapport_nie: iaResult.text ?? '',
      sara_eligible, trust_index,
      latency_ms: Date.now() - start,
    };

    // ── Appliquer le filtre freemium ───────────────────────
    const niveau  = (input.profil.niveau_acces ?? 'FREE') as any;
    const filtre  = await this.freemiumService.obtenirFiltre(
      input.profil.country_code, niveau
    );
    return this.freemiumService.filtrerResultatOp(resultat, filtre) as ResultatOp;
  }

  private matcherMetiers(p: ProfilPro): MetierCI[] {
    const found = new Map<string,MetierCI>();
    for (const d of p.code_holland.split('')) {
      for (const m of (METIERS_CI[d]??[])) {
        if (!found.has(m.nom)) {
          let c = m.compatibilite;
          if (p.segment==='ENTREPRENEUR_INFORMEL' && d==='E') c+=5;
          if (p.segment==='NEET') c=Math.max(50,c-10);
          found.set(m.nom,{...m,compatibilite:Math.min(100,c)});
        }
      }
    }
    return Array.from(found.values()).sort((a,b)=>b.compatibilite-a.compatibilite).slice(0,6);
  }

  private genererPII(p: ProfilPro): PiiEtape[] {
    const plans: Record<SegmentPro,PiiEtape[]> = {
      SALARIE_FORMEL:[
        {delai:'J+30',priorite:'HAUTE',action:'Mettre à jour CV et profil LinkedIn CI',acteur:'AGEPE'},
        {delai:'J+30',priorite:'HAUTE',action:'Déposer 5 candidatures ciblées',acteur:'JobnetAfrica'},
        {delai:'J+90',priorite:'MOYENNE',action:'Certification professionnelle CI',acteur:'FDFP'},
        {delai:'J+180',priorite:'MOYENNE',action:'Négocier période d\'essai ou stage qualifiant'},
      ],
      ENTREPRENEUR_INFORMEL:[
        {delai:'J+30',priorite:'HAUTE',action:'Formaliser au CEPICI (guichet unique)',acteur:'CEPICI',lien:'cepici.ci'},
        {delai:'J+30',priorite:'HAUTE',action:'Ouvrir compte Orange Money / Wave Business'},
        {delai:'J+90',priorite:'HAUTE',action:'Accéder financement BNI PME',acteur:'BNI',lien:'bni.ci'},
        {delai:'J+90',priorite:'MOYENNE',action:'Formation gestion PME via FDFP',acteur:'FDFP',lien:'fdfp.ci'},
        {delai:'J+180',priorite:'MOYENNE',action:'Rejoindre coopérative professionnelle CI'},
      ],
      NEET:[
        {delai:'J+30',priorite:'HAUTE',action:'S\'inscrire à l\'AGEPE (emploi jeunes)',acteur:'AGEPE',lien:'agepe.ci'},
        {delai:'J+30',priorite:'HAUTE',action:'Formation courte 3-6 mois AGEFOP',acteur:'AGEFOP',lien:'agefop.ci'},
        {delai:'J+90',priorite:'HAUTE',action:'Programme insertion professionnelle CI',acteur:'FDFP'},
        {delai:'J+180',priorite:'MOYENNE',action:'Viser emploi ou auto-emploi dans son secteur'},
      ],
      RECONVERSION:[
        {delai:'J+30',priorite:'HAUTE',action:'Bilan compétences avec conseiller AGEFOP',acteur:'AGEFOP'},
        {delai:'J+30',priorite:'HAUTE',action:'Identifier passerelles ancien → nouveau secteur'},
        {delai:'J+90',priorite:'HAUTE',action:'Formation reconversion financée FDFP',acteur:'FDFP'},
        {delai:'J+180',priorite:'MOYENNE',action:'Stage transition nouveau secteur visé'},
      ],
      CADRE_FP_CI:[
        {delai:'J+30',priorite:'HAUTE',action:'Identifier concours administratifs MFPE',acteur:'MFPE'},
        {delai:'J+30',priorite:'HAUTE',action:'Préparer dossier ENA CI si éligible',acteur:'ENA CI'},
        {delai:'J+90',priorite:'MOYENNE',action:'Formation continue FP',acteur:'CAFOP'},
        {delai:'J+180',priorite:'MOYENNE',action:'Viser promotion interne ou changement corps'},
      ],
    };
    return plans[p.segment] ?? [];
  }

  private verifierSara(p: ProfilPro): boolean {
    return p.segment==='ENTREPRENEUR_INFORMEL' || p.segment==='NEET' ||
           (p.segment==='SALARIE_FORMEL' && p.milieu==='RURAL');
  }

  private calculerTrust(p: ProfilPro): number {
    let s=40;
    s+=p.code_holland?20:0; s+=p.age?10:0; s+=p.zone?10:0;
    s+=p.annees_experience!==undefined?10:0; s+=p.niveau_etude?10:0;
    return Math.min(100,s);
  }
}