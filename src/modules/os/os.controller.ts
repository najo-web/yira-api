// =============================================================================
// YIRA V3.0 — OsController
// Routes YIRA-OS : BEPC + BAC + Simulation DOB
// =============================================================================
import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { OsService }   from './os.service';
import { BepcService } from './bepc.service';
import { BacService }  from './bac.service';

@ApiTags('Orientation Scolaire')
@Controller('')
export class OsController {
  private readonly logger = new Logger('OsController');

  constructor(
    private readonly osService:   OsService,
    private readonly bepcService: BepcService,
    private readonly bacService:  BacService,
  ) {}

  @Get('os/ping')
  @Public()
  @ApiOperation({ summary: 'Santé YIRA-OS' })
  ping() {
    return { status: 'ok', message: this.osService.ping() };
  }

  // ── BEPC ────────────────────────────────────────────────────────────────────

  @Post('bepc/analyze')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyse orientation post-BEPC (BepcEngine + Simulation DOB)' })
  @ApiBody({ schema: { type: 'object', properties: {
    utilisateur_id: { type: 'string', example: 'test-001' },
    notes: { type: 'object', example: { maths: 14, francais: 12, anglais: 11, svt: 13, physique: 12, histoire_geo: 10, eps: 15 } },
    riasec: { type: 'object', example: { R: 20, I: 80, A: 30, S: 40, E: 50, C: 60 } },
    contexte: { type: 'object', example: { region: 'ABIDJAN_COCODY', type_etablissement: 'PUBLIC', milieu: 'URBAIN', budget_famille: 'MOYEN', voeux: ['2nde_C', '2nde_A', 'LYCEE_TECH_INFO'] } },
  }}})
  async analyserBepc(@Body() body: any) {
    this.logger.log('POST /api/bepc/analyze — utilisateur: ' + body.utilisateur_id);
    const result = await this.bepcService.analyser({
      ...body,
      utilisateur_id: body.utilisateur_id ?? 'anonymous',
    });
    try {
      const raw     = result.rapport_nie ?? '';
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed  = JSON.parse(cleaned);
      const rp      = parsed?.rapport_personnalise;
      result.rapport_nie = rp?.contenu ?? rp?.contenu_principal ?? rp?.valorisation ?? raw;
    } catch { /* texte pur */ }
    return { success: true, data: result, moteur: 'YIRA-OS-BEPC-v3' };
  }

  @Post('bepc/simulate-dob')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simulation DOB rapide (sans bilan complet)' })
  async simulerDOB(@Body() body: { notes: any; region: string; voeux: string[] }) {
    const mo         = this.bepcService.calculerMO(body.notes);
    const simulation = this.bepcService.simulerDOB(mo, {
      region:             body.region || 'ABIDJAN_YOPOUGON',
      type_etablissement: 'PUBLIC',
      milieu:             'URBAIN',
      budget_famille:     'MOYEN',
      voeux:              body.voeux || ['2nde_C', '2nde_A', 'LYCEE_TECH'],
    });
    return { success: true, data: { mo, simulation } };
  }

  @Get('bepc/projection/:filiere')
  @Public()
  @ApiOperation({ summary: 'Projection réussite par filière BEPC' })
  @ApiParam({ name: 'filiere', example: '2nde_C' })
  async projectionBepc(@Param('filiere') filiere: string, @Body() body: { notes: any }) {
    const mo         = this.bepcService.calculerMO(body.notes || {});
    const projection = this.bepcService.projeterReussite(mo, body.notes || {}, filiere);
    return { success: true, data: projection };
  }

  @Post('bepc/feedback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Feedback post-affectation BEPC (calibration YIRA)' })
  async feedbackBepc(@Body() body: any) {
    const result = await this.bepcService.enregistrerFeedback({
      ...body,
      utilisateur_id: body.utilisateur_id ?? 'anonymous',
    });
    return { success: true, data: result };
  }

  // ── BAC ─────────────────────────────────────────────────────────────────────

  @Post('bac/analyze')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyse orientation post-BAC (BacEngine + ROI éducatif)' })
  async analyserBac(@Body() body: any) {
    this.logger.log('POST /api/bac/analyze — serie: ' + (body.notes?.serie ?? 'N/A'));
    const result = await this.bacService.analyser({
      ...body,
      notes:          { ...body.notes, serie: body.serie ?? body.notes?.serie },
      utilisateur_id: body.utilisateur_id ?? 'anonymous',
    });
    try {
      const raw2    = result.rapport_nie ?? '';
      const cleaned2 = raw2.replace(/```json|```/g, '').trim();
      const parsed2  = JSON.parse(cleaned2);
      const rp2      = parsed2?.rapport_orientation ?? parsed2?.rapport_personnalise;
      result.rapport_nie = rp2?.felicitations
        ? (rp2.felicitations + ' ' + (rp2?.fili_re_1_recommandee?.pourquoi ?? '') + ' ' + (rp2?.mot_encouragement ?? '')).trim()
        : cleaned2;
    } catch { /* texte pur */ }
    return { success: true, data: result, moteur: 'YIRA-OS-BAC-v3' };
  }

  @Get('bac/careers/:filiere')
  @Public()
  @ApiOperation({ summary: 'Débouchés et projection carrière par filière BAC' })
  @ApiParam({ name: 'filiere', example: 'MEDECINE' })
  async carriereFiliere(@Param('filiere') filiere: string) {
    const minimalRec: any = { nom: filiere, code: filiere, roi: { salaire_moy_fcfa: 500000 } };
    const data = this.bacService.projeterCarriere(minimalRec);
    return { success: true, data };
  }

  @Post('bac/feedback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Feedback post-orientation BAC' })
  async feedbackBac(@Body() body: any) {
    return { success: true, message: 'Feedback enregistre — merci pour la calibration YIRA CI' };
  }

  @Get('ia/health')
  @Public()
  @ApiOperation({ summary: 'Santé NIE (Nohama Intelligence Engine)' })
  healthNIE() {
    return { status: 'OK', nie: 'Nohama Intelligence Engine', primaire: 'Gemini 2.5 Flash', fallback: 'Claude Sonnet', sprint: '40', timestamp: new Date().toISOString() };
  }
}