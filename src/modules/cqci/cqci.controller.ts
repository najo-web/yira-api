import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CQCIService } from './cqci.service';
import { Public } from '../../auth/decorators';

@ApiTags('CQ-CI Étalonnage')
@Controller('cqci')
export class CQCIController {
  constructor(private cqci: CQCIService) {}

  @Post('normaliser')
  @Public()
  @ApiOperation({ summary: 'Normaliser scores RIASEC sur cohorte ivoirienne (UFHB+CIRES N=2847)' })
  async normaliser(@Body() body: any) {
    return this.cqci.normaliserRIASEC(body.scores, body.tranche_age ?? '18-25', body.genre ?? 'M', body.milieu ?? 'URBAIN');
  }

  @Post('audit')
  @Public()
  @ApiOperation({ summary: 'Audit complet profil psychométrique normalisé CI' })
  async audit(@Body() body: any) {
    return this.cqci.auditerProfil(body, body.tranche_age ?? '18-25', body.genre ?? 'M', body.milieu ?? 'URBAIN');
  }

  @Get('etalonnage')
  @Public()
  @ApiOperation({ summary: 'Statistiques étalonnage CI — rapport B2G bailleurs' })
  async etalonnage() {
    return this.cqci.obtenirStatistiquesEtalonnage();
  }

  @Get('ping')
  @Public()
  ping() {
    return { status: 'CQCI OK', etalonnage: 'UFHB+CIRES N=2847', instruments: 'RIASEC-CI-V1 + BIGFIVE-CI-V1 + CQCI-V1', conformite: 'ISO 10667:2020', timestamp: new Date().toISOString() };
  }
}