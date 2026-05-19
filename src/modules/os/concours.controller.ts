// =============================================================================
// YIRA V3.0 — ConcoursController
// Sprint 51 — Routes ConcoursEngine
// =============================================================================
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConcoursService, CandidatConcours } from './concours.service';
import { Public } from '../../auth/decorators';

@ApiTags('OS — ConcoursEngine')
@Controller('concours')
export class ConcoursController {
  constructor(private concours: ConcoursService) {}

  @Get('ping')
  @Public()
  ping() { return { status: this.concours.ping(), certification: 'YIRA-CONCOURS-CI-2026' }; }

  @Get('liste')
  @Public()
  @ApiOperation({ summary: 'Lister tous les concours CI disponibles' })
  lister() { return { concours: this.concours.getConcoursList() }; }

  @Post('analyser/:code')
  @Public()
  @ApiOperation({ summary: 'Analyser éligibilité + ranking pour un concours CI' })
  async analyser(@Param('code') code: string, @Body() candidat: CandidatConcours) {
    return this.concours.analyser(candidat, code);
  }

  @Post('eligibles')
  @Public()
  @ApiOperation({ summary: 'Lister tous les concours CI éligibles pour un candidat' })
  async listerEligibles(@Body() candidat: CandidatConcours) {
    return this.concours.listerConcoursEligibles(candidat);
  }
}