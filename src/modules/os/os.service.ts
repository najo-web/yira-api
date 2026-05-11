// ============================================================
// YIRA — src/modules/os/os.service.ts  (Sprint 7 final)
// Import depuis @prisma/client-orientation
// ============================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService }  from '@nestjs/config';
import { IaService }      from '../../ia/ia.service';
import { PrismaClient }   from '@prisma/client-orientation';

export interface ReponsesRiasec   { [qId: string]: number }
export interface NotesMatieresCI  {
  maths?: number; francais?: number; sciences?: number;
  anglais?: number; histoire?: number; philosophie?: number;
  comptabilite?: number; eps?: number; svt?: number; physique?: number;
}
export interface ContexteBeneficiaire {
  prenom: string; age?: number; zone: string; milieu: string;
  type_etablissement?: string; niveau: string;
  country_code: string; telephone?: string;
}
export interface SessionOsInput {
  beneficiaire: ContexteBeneficiaire;
  reponses_riasec: ReponsesRiasec;
  notes?: NotesMatieresCI;
  canal: 'APP' | 'WEB' | 'USSD';
}
export interface ProfilRiasec {
  R:number; I:number; A:number; S:number; E:number; C:number;
  code_holland: string; dominant: string;
}
export interface ResultatOs {
  session_id: string; profil_riasec: ProfilRiasec;
  mo_calculee?: number; rapport_nie: string;
  filieres_recommandees: string[]; signal_conscience?: string;
  trust_index: number; latency_ms: number; sauvegarde_bdd: boolean;
}

const QUESTIONS_DIM: Record<string,string> = {
  Q1:'R',Q2:'R',Q3:'R',Q4:'R',Q5:'R',
  Q6:'I',Q7:'I',Q8:'I',Q9:'I',Q10:'I',
  Q11:'A',Q12:'A',Q13:'A',Q14:'A',Q15:'A',
  Q16:'S',Q17:'S',Q18:'S',Q19:'S',Q20:'S',
  Q21:'E',Q22:'E',Q23:'E',Q24:'E',Q25:'E',
  Q26:'C',Q27:'C',Q28:'C',Q29:'C',Q30:'C',
};
const COEFFS_DOB: Record<string,number> = {
  maths:3,francais:3,sciences:2,anglais:2,
  histoire:1,philosophie:1,comptabilite:2,eps:1,svt:2,physique:2,
};
const FILIERES: Record<string,string[]> = {
  R:['Génie Civil','Mécanique Industrielle','Électrotechnique','Agriculture CI'],
  I:['Sciences Médicales','Informatique','Mathématiques','Physique-Chimie'],
  A:['Arts et Design','Communication','Lettres Modernes','Architecture'],
  S:['Sciences de l\'Éducation','Psychologie','Travail Social','Infirmier'],
  E:['Commerce International','Gestion Entreprise','Marketing','Droit des Affaires'],
  C:['Comptabilité-Gestion','Banque-Finance','Administration','Statistiques'],
};

@Injectable()
export class OsService implements OnModuleInit {
  private readonly logger = new Logger(OsService.name);
  private db: PrismaClient;

  constructor(private iaService: IaService, private config: ConfigService) {}

  async onModuleInit() {
    this.db = new PrismaClient({
      datasources: { db: { url: this.config.get('DATABASE_ORIENTATION_URL') } },
    });
    await this.db.$connect();
    this.logger.log('✅ OsService connecté à base_orientation');
  }

  async genererRapportOs(input: SessionOsInput): Promise<ResultatOs> {
    const start      = Date.now();
    const session_id = `OS_${Date.now()}_${Math.random().toString(36).slice(2,7).toUpperCase()}`;
    const profil     = this.calculerRiasec(input.reponses_riasec, input.beneficiaire);
    const mo         = input.notes ? this.calculerMO(input.notes) : undefined;
    const filieres   = this.recommanderFilieres(profil);
    const signal     = this.detecterSignal(profil, mo, input.beneficiaire);
    const trust      = this.calculerTrust(input);

    const iaResult = await this.iaService.generate({
      module: 'YIRAOS', usage: 'NIE_RAPPORT',
      pays: input.beneficiaire.country_code, canal: input.canal,
      variables: {
        prenom: input.beneficiaire.prenom, profil_riasec: profil.code_holland,
        dominant: profil.dominant, zone: input.beneficiaire.zone,
        milieu: input.beneficiaire.milieu, mo: mo ?? 'non fournie',
        filieres: filieres.join(', '), signal_conscience: signal, trust_index: trust,
      },
    });

    let sauvegarde = false;
    try {
      const tel = input.beneficiaire.telephone ?? 'anonymous';
      const cc  = input.beneficiaire.country_code;

      await this.db.yiraSession.create({
        data: { id: session_id, beneficiaire_id: tel, telephone: tel,
          country_code: cc, canal: input.canal, statut: 'COMPLETE', completed_at: new Date() },
      });
      await this.db.yiraProfilRiasec.create({
        data: { session_id, telephone: tel, country_code: cc,
          score_r: profil.R, score_i: profil.I, score_a: profil.A,
          score_s: profil.S, score_e: profil.E, score_c: profil.C,
          code_holland: profil.code_holland, dominant: profil.dominant,
          mo_calculee: mo, scg: 75, trust_index: trust, signal_conscience: signal },
      });
      await this.db.yiraRapportNie.create({
        data: { session_id, telephone: tel, country_code: cc,
          contenu: iaResult.text ?? '', filieres_recommandees: filieres,
          model_used: iaResult.model_used, latency_ms: Date.now() - start,
          restitution_faite: false },
      });
      sauvegarde = true;
      this.logger.log(`✅ Session ${session_id} sauvegardée en BDD`);
    } catch (err: any) {
      this.logger.warn(`⚠️ BDD : ${err.message}`);
    }

    return { session_id, profil_riasec: profil, mo_calculee: mo,
      rapport_nie: iaResult.text ?? '', filieres_recommandees: filieres,
      signal_conscience: signal, trust_index: trust,
      latency_ms: Date.now() - start, sauvegarde_bdd: sauvegarde };
  }

  private calculerRiasec(rep: ReponsesRiasec, ctx: ContexteBeneficiaire): ProfilRiasec {
    const scores: Record<string,number> = {R:0,I:0,A:0,S:0,E:0,C:0};
    const counts: Record<string,number> = {R:0,I:0,A:0,S:0,E:0,C:0};
    for (const [q,v] of Object.entries(rep)) {
      const d = QUESTIONS_DIM[q]; if (d) { scores[d]+=v; counts[d]++; }
    }
    const n: Record<string,number> = {};
    for (const d of ['R','I','A','S','E','C'])
      n[d] = Math.round((scores[d]/((counts[d]||5)*6))*100);
    if (ctx.milieu==='RURAL') { n['S']=Math.min(100,n['S']+15); n['R']=Math.min(100,n['R']+10); }
    n['S'] = Math.min(100,Math.round(n['S']*1.15));
    const sorted = Object.entries(n).sort((a,b)=>b[1]-a[1]);
    const code   = sorted.slice(0,3).map(([d])=>d).join('');
    const noms: Record<string,string> = {
      R:'Réaliste',I:'Investigateur',A:'Artistique',
      S:'Social',E:'Entreprenant',C:'Conventionnel'
    };
    return { R:n['R'],I:n['I'],A:n['A'],S:n['S'],E:n['E'],C:n['C'],
      code_holland:code, dominant:noms[sorted[0][0]] };
  }

  private calculerMO(notes: NotesMatieresCI): number {
    let total=0, coeff=0;
    for (const [m,c] of Object.entries(COEFFS_DOB)) {
      const v=(notes as any)[m]; if (v!=null){total+=v*c;coeff+=c;}
    }
    return coeff>0 ? Math.round((total/coeff)*100)/100 : 0;
  }

  private recommanderFilieres(p: ProfilRiasec): string[] {
    const set = new Set<string>();
    for (const d of p.code_holland.split(''))
      for (const f of (FILIERES[d]??[]).slice(0,2)) set.add(f);
    return Array.from(set).slice(0,5);
  }

  private detecterSignal(p: ProfilRiasec, mo?: number, ctx?: ContexteBeneficiaire): string {
    const max = Math.max(p.R,p.I,p.A,p.S,p.E,p.C);
    if (max>70 && ctx?.milieu==='RURAL' && mo!==undefined && mo<12) return 'POTENTIEL_CACHE';
    if (max<55 && mo!==undefined && mo>14) return 'EFFORT_COMPENSATOIRE';
    if (ctx?.type_etablissement==='SOUS_EQUIPE' && mo!==undefined && mo<11) return 'OBSTACLE_ENV';
    return 'COHERENT';
  }

  private calculerTrust(input: SessionOsInput): number {
    let s=0;
    s += Object.keys(input.reponses_riasec).length>=30 ? 40 : 20;
    s += input.notes ? 20 : 0;
    s += input.beneficiaire.zone ? 10 : 0;
    s += input.beneficiaire.milieu ? 10 : 0;
    s += input.canal==='APP'||input.canal==='WEB' ? 20 : 10;
    return Math.min(100,s);
  }
}