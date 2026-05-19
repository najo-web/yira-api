import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';
import { PsyPService } from './psyp.service';
import { SigmundAdapter } from './adapters/sigmund.adapter';
import { Public } from '../../auth/decorators';

@ApiTags('PsyP — Psychometric Provider')
@Controller('psyp')
export class PsyPController {
  constructor(private psyp: PsyPService) {}

  @Post('bilan/demarrer')
  @Public()
  @ApiOperation({ summary: 'Démarrer un bilan psychométrique (Sigmund ou autre provider)' })
  async demarrerBilan(@Body() body: any) {
    const candidat = {
      telephone:       body.telephone,
      prenom:          body.prenom ?? 'Candidat',
      nom:             body.nom    ?? 'YIRA',
      genre:           body.genre  ?? 'M',
      age_code:        SigmundAdapter.mapAgeCI(body.age ?? 20),
      diplome_code:    SigmundAdapter.mapDiplomeCI(body.niveau ?? 'BAC'),
      experience_code: body.experience_code ?? 1,
      formation_code:  body.formation_code  ?? 4,
      statut_code:     body.statut_code     ?? 7,
      tenant_id:       body.tenant_id       ?? 'CI',
    };
    return this.psyp.demarrerBilan(candidat, body.provider ?? 'SIGMUND');
  }

  @Post('bilan/:sessionId/repondre')
  @Public()
  @ApiOperation({ summary: 'Soumettre les réponses et obtenir le profil YIRA certifié' })
  @ApiParam({ name: 'sessionId' })
  async soumettreReponses(@Param('sessionId') sessionId: string, @Body() body: any) {
    return this.psyp.soumettreReponses(
      sessionId, body.telephone, body.reponses ?? [],
      body.provider ?? 'SIGMUND',
      body.tranche_age ?? '18-25',
      body.genre ?? 'M',
      body.tenant_id ?? 'CI',
    );
  }

  @Get('providers')
  @Public()
  @ApiOperation({ summary: 'Lister les providers PsyP disponibles' })
  providers() {
    return { providers: this.psyp.getProviders(), certification: 'YIRA-V3-CI-2026' };
  }

  @Get('ping')
  @Public()
  ping() { return this.psyp.ping(); }
}