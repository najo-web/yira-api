import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JobService } from './job.service';
import { Public } from '../../auth/decorators';

@ApiTags('YIRA-OP JobEngine')
@Controller('job')
export class JobController {

  constructor(private job: JobService) {}

  @Post('offres')
  @Public()
  @ApiOperation({ summary: 'Matcher offres emploi selon profil RIASEC + secteur' })
  async matcherOffres(@Body() body: any) {
    return this.job.matcherOffres(body);
  }

  @Post('postuler')
  @Public()
  @ApiOperation({ summary: 'Postuler à une offre emploi' })
  @ApiBody({ schema: { type: 'object', properties: {
    telephone: { type: 'string', example: '+2250708647166' },
    offre_id:  { type: 'string', example: 'uuid-offre' },
    cv_hash:   { type: 'string', example: 'sha256-cv' },
    tenant_id: { type: 'string', example: 'CI' },
  }}})
  async postuler(@Body() body: any) {
    return this.job.postuler(body.telephone, body.offre_id, body.cv_hash ?? '', body.tenant_id);
  }

  @Post('coaching/demarrer')
  @Public()
  @ApiOperation({ summary: 'Démarrer coaching entretien IA (5 questions Vieux Père/Grande Sœur)' })
  @ApiBody({ schema: { type: 'object', properties: {
    telephone:    { type: 'string', example: '+2250708647166' },
    metier_cible: { type: 'string', example: 'Developpeur Mobile' },
    secteur:      { type: 'string', example: 'TECH' },
    genre:        { type: 'string', example: 'M', enum: ['M', 'F'] },
    tenant_id:    { type: 'string', example: 'CI' },
  }}})
  async demarrerCoaching(@Body() body: any) {
    return this.job.demarrerCoachingEntretien(
      body.telephone, body.metier_cible, body.secteur,
      body.genre ?? 'M', body.tenant_id
    );
  }

  @Post('coaching/:sessionId/repondre')
  @Public()
  @ApiOperation({ summary: 'Soumettre réponse à une question d\'entretien' })
  @ApiParam({ name: 'sessionId' })
  async repondreQuestion(
    @Param('sessionId') sessionId: string,
    @Body() body: any,
  ) {
    return this.job.evaluerReponseEntretien(
      sessionId, body.question_id, body.reponse, body.genre ?? 'M', body.tenant_id
    );
  }

  @Post('suivi/:candidatureId')
  @Public()
  @ApiOperation({ summary: 'Mettre à jour suivi emploi J+30/90/180/365' })
  @ApiParam({ name: 'candidatureId' })
  async mettreAJourSuivi(@Param('candidatureId') candidatureId: string, @Body() body: any) {
    return this.job.mettreAJourSuivi(
      body.telephone, candidatureId, body.etape,
      body.note ?? '', body.emploi_obtenu ?? false,
      body.salaire_obtenu, body.tenant_id
    );
  }

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'KPIs cohorte insertion (ODD 8) — pour bailleurs' })
  @ApiQuery({ name: 'tenant', required: false, example: 'CI' })
  async stats(@Query('tenant') tenant = 'CI') {
    return this.job.statistiquesCohorte(tenant);
  }

  @Get('ping')
  @Public()
  @ApiOperation({ summary: 'Santé JobService' })
  ping() { return { status: 'JOB OK', offres: '8 offres seedees CI', timestamp: new Date().toISOString() }; }
}