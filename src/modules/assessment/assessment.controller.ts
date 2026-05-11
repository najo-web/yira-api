// ============================================================
// YIRA — src/modules/assessment/assessment.controller.ts
// ============================================================
import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AssessmentService }    from './assessment.service';
import { JwtAuthGuard }         from '../../auth/jwt-auth.guard';
import { Public, CurrentUser }  from '../../auth/decorators';

@Controller('assessment')
@UseGuards(JwtAuthGuard)
export class AssessmentController {
  constructor(private assessmentService: AssessmentService) {}

  // POST /api/assessment/bigfive
  @Post('bigfive')
  bigfive(
    @Body('reponses') reponses: Record<string, number>,
    @Body('milieu')   milieu: string,
  ) {
    return this.assessmentService.calculerBigFive(reponses, milieu ?? 'URBAIN');
  }

  // POST /api/assessment/valeurs
  @Post('valeurs')
  valeurs(@Body('reponses') reponses: Record<string, number>) {
    return this.assessmentService.calculerValeurs(reponses);
  }

  // POST /api/assessment/aptitudes
  @Post('aptitudes')
  aptitudes(@Body('reponses') reponses: Record<string, number>) {
    return this.assessmentService.calculerAptitudes(reponses);
  }

  // POST /api/assessment/scg — Score de Cohérence Globale
  @Post('scg')
  scg(
    @Body('riasec_dominant')   riasec: string,
    @Body('bigfive_dominant')  bigfive: string,
    @Body('valeurs_dominant')  valeurs: string,
    @Body('aptitudes_global')  aptitudes: number,
  ) {
    const score = this.assessmentService.calculerSCG(riasec, bigfive, valeurs, aptitudes);
    return {
      scg: score,
      interpretation: score >= 80 ? 'TRES_COHERENT'
        : score >= 60 ? 'COHERENT'
        : score >= 40 ? 'MODEREMENT_COHERENT'
        : 'PEU_COHERENT',
    };
  }

  @Get('ping')
  @Public()
  ping() {
    return { module: 'YIRA-Assessment', status: '✅ opérationnel', version: '4B' };
  }
}
