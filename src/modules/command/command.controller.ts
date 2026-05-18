import { Controller, Get, Post, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ArtciReportingService } from './artci-reporting.service';
import { YiraConfigService } from '../../core-config/yira-config.service';
import { Public } from '../../auth/decorators';

@ApiTags('Command')
@Controller('command')
export class CommandController {
  constructor(
    private artci:      ArtciReportingService,
    private yiraConfig: YiraConfigService,
  ) {}

  @Get('kpis')
  @Public()
  @ApiOperation({ summary: 'KPIs temps réel YIRA-COMMAND', description: 'Tableau de bord temps réel : abonnés, revenus, sessions USSD, SMS.' })
  @ApiQuery({ name:'tenant', required:false, example:'CI' })
  async kpis(@Query('tenant') tenant = 'CI') {
    return this.artci.kpisTempsReel(tenant);
  }

  @Get('artci/rapport/:trimestre/:annee')
  @Public()
  @ApiOperation({ summary: 'Rapport trimestriel ARTCI', description: 'Génère le rapport ARTCI obligatoire (Art. 4.1) pour le trimestre et l\'année spécifiés.' })
  @ApiParam({ name:'trimestre', example:'Q2' })
  @ApiParam({ name:'annee', example:'2026' })
  async rapport(@Param('trimestre') trimestre: string, @Param('annee') annee: string) {
    return this.artci.genererRapportTrimestriel(trimestre, parseInt(annee));
  }

  @Get('artci/export/:trimestre/:annee')
  @Public()
  @ApiOperation({ summary: 'Export CSV rapport ARTCI', description: 'Exporte le rapport ARTCI au format CSV pour soumission à l\'autorité de régulation.' })
  @ApiParam({ name:'trimestre', example:'Q2' })
  @ApiParam({ name:'annee', example:'2026' })
  async exportCsv(@Param('trimestre') trimestre: string, @Param('annee') annee: string, @Res() res: Response) {
    const csv = await this.artci.exporterCsvArtci(trimestre, parseInt(annee));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=rapport-artci-' + trimestre + '-' + annee + '.csv');
    res.send(csv);
  }

  @Get('config/:tenant')
  @Public()
  @ApiOperation({ summary: 'Configuration complète d\'un pays', description: 'Retourne tous les paramètres métier du pays : tarifs VAS, config ARTCI, Mobile Money, scores SARA, paramètres Signer.' })
  @ApiParam({ name:'tenant', example:'CI', description:'Code pays tenant (CI, SN, BF, ML...)' })
  async config(@Param('tenant') tenant: string) {
    return this.yiraConfig.getConfig(tenant);
  }

  @Post('config/:tenant/invalider')
  @Public()
  @ApiOperation({ summary: 'Invalider le cache config d\'un pays', description: 'Force le rechargement de la configuration depuis base_core (après modification dans YIRA-COMMAND).' })
  @ApiParam({ name:'tenant', example:'CI' })
  async invaliderCache(@Param('tenant') tenant: string) {
    await this.yiraConfig.invaliderCache(tenant);
    return { message: 'Cache invalide pour ' + tenant };
  }

  @Get('ping')
  @Public()
  @ApiOperation({ summary: 'Santé du module Command' })
  ping() { return { status: 'COMMAND OK', timestamp: new Date().toISOString() }; }
}