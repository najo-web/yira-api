import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AntifraudeService, DonneesEvaluation } from './antifraude.service';
import { Public } from '../../auth/decorators';

@ApiTags('Antifraude')
@Controller('antifraude')
export class AntifraudeController {
  constructor(private antifraude: AntifraudeService) {}

  @Post('analyser')
  @Public()
  @ApiOperation({
    summary: 'Triangle de Vérité — Analyser la fiabilité d\'un profil psychométrique',
    description: 'Calcule le Trust Index (0-1) sur 3 sommets : Cohérence Interne, Inter-sources, Comportementale.'
  })
  @ApiBody({ schema: { type:'object', properties: {
    riasec_scores:    { type:'object', example: { R:1, I:4, A:2, S:3, E:2, C:1 } },
    riasec_dominant:  { type:'string', example: 'I' },
    bigfive_dominant: { type:'string', example: 'Ouverture' },
    valeurs_dominant: { type:'string', example: 'Impact Social' },
    aptitudes_global: { type:'number', example: 72 },
    moyenne_scolaire: { type:'number', example: 13.5 },
    temps_reponses:   { type:'array',  example: [8000, 12000, 9000, 7000, 15000] },
    nb_retours:       { type:'number', example: 2 },
    nb_questions:     { type:'number', example: 10 },
  }}})
  analyser(@Body() body: DonneesEvaluation) {
    return this.antifraude.analyser(body);
  }

  @Post('dual-sms')
  @Public()
  @ApiOperation({ summary: 'Générer messages Dual SMS (profil incohérent)' })
  dualSms(@Body() body: { resultat: any; telephone_mineur: string }) {
    return this.antifraude.genererMessageDualSms(body.resultat, body.telephone_mineur);
  }
}