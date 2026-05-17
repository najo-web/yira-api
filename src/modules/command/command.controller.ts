import { Controller, Get, Post, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ArtciReportingService } from './artci-reporting.service';
import { YiraConfigService } from '../../core-config/yira-config.service';
import { Public } from '../../auth/decorators';

@Controller('command')
export class CommandController {
  constructor(
    private artci:      ArtciReportingService,
    private yiraConfig: YiraConfigService,
  ) {}

  @Get('kpis')
  @Public()
  async kpis(@Query('tenant') tenant = 'CI') {
    return this.artci.kpisTempsReel(tenant);
  }

  @Get('artci/rapport/:trimestre/:annee')
  @Public()
  async rapport(
    @Param('trimestre') trimestre: string,
    @Param('annee') annee: string,
  ) {
    return this.artci.genererRapportTrimestriel(trimestre, parseInt(annee));
  }

  @Get('artci/export/:trimestre/:annee')
  @Public()
  async exportCsv(
    @Param('trimestre') trimestre: string,
    @Param('annee') annee: string,
    @Res() res: Response,
  ) {
    const csv = await this.artci.exporterCsvArtci(trimestre, parseInt(annee));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=rapport-artci-' + trimestre + '-' + annee + '.csv');
    res.send(csv);
  }

  @Get('config/:tenant')
  @Public()
  async config(@Param('tenant') tenant: string) {
    return this.yiraConfig.getConfig(tenant);
  }

  @Post('config/:tenant/invalider')
  @Public()
  async invaliderCache(@Param('tenant') tenant: string) {
    await this.yiraConfig.invaliderCache(tenant);
    return { message: 'Cache invalide pour ' + tenant };
  }

  @Get('ping')
  @Public()
  ping() { return { status: 'COMMAND OK', timestamp: new Date().toISOString() }; }
}