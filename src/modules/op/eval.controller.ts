// =============================================================================
// YIRA V3.0 — EvalController
// Sprint 51 — Routes EvalEngine B2G/B2B
// =============================================================================
import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery }    from '@nestjs/swagger';
import { EvalService, ProfilCadre, Evaluation360 } from './eval.service';
import { Public } from '../../auth/decorators';

@ApiTags('OP — EvalEngine B2G/B2B')
@Controller('eval')
export class EvalController {
  constructor(private evalSvc: EvalService) {}

  @Get('ping')
  @Public()
  ping() { return { status: this.evalSvc.ping(), certification: 'YIRA-EVAL-ISO10667-CI-2026' }; }

  @Post('bilan360')
  @Public()
  @ApiOperation({ summary: 'Réaliser un bilan 360° B2G/B2B (cadres supérieurs CI)' })
  @ApiQuery({ name: 'type', enum: ['B2G','B2B','B2G_BAILLEURS'], required: false })
  async bilan360(
    @Body() body: { profil: ProfilCadre; evaluation_360: Evaluation360 },
    @Query('type') type: 'B2G' | 'B2B' | 'B2G_BAILLEURS' = 'B2G',
  ) {
    return this.evalSvc.realiserBilan360(body.profil, body.evaluation_360, type);
  }
}