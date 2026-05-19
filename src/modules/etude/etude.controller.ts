import { Controller, Get, Post, Body, Query, Res, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EtudeService } from './etude.service';
import { Public } from '../../auth/decorators';
import type { Response } from 'express';

@ApiTags('ONC-CI Dashboard')
@Controller('etude')
export class EtudeController {
  constructor(private etude: EtudeService) {}

  @Get('dashboard')
  @Public()
  @ApiOperation({ summary: 'Dashboard ONC-CI — KPIs PND + ODD consolidés (B2G)' })
  @ApiQuery({ name: 'tenant', required: false, example: 'CI' })
  @ApiQuery({ name: 'periode', required: false, example: '2025' })
  async dashboard(@Query('tenant') tenant = 'CI', @Query('periode') periode = '2025') {
    return this.etude.obtenirDashboard(tenant, periode);
  }

  @Get('kpis/pnd')
  @Public()
  @ApiOperation({ summary: 'KPIs Plan National de Développement CI' })
  @ApiQuery({ name: 'tenant', required: false })
  @ApiQuery({ name: 'periode', required: false })
  async kpisPND(@Query('tenant') tenant = 'CI', @Query('periode') periode = '2025') {
    return this.etude.obtenirKpisPND(tenant, periode);
  }

  @Get('kpis/odd')
  @Public()
  @ApiOperation({ summary: 'KPIs ODD Nations Unies (ODD 4, 5, 8, 10, 16, 17)' })
  @ApiQuery({ name: 'tenant', required: false })
  @ApiQuery({ name: 'periode', required: false })
  @ApiQuery({ name: 'odd', required: false, example: '8' })
  async kpisODD(
    @Query('tenant') tenant = 'CI',
    @Query('periode') periode = '2025',
    @Query('odd') odd?: string,
  ) {
    return this.etude.obtenirKpisODD(tenant, periode, odd ? parseInt(odd) : undefined);
  }

  @Post('kpis/update')
  @Public()
  @ApiOperation({ summary: 'Mettre à jour valeur réelle d un KPI (terrain ou système)' })
  async updateKPI(@Body() body: any) {
    return this.etude.mettreAJourKPI(body.type, body.indicateur_code, body.valeur_reelle, body.source ?? 'YIRA', body.tenant_id);
  }

  @Get('rapport')
  @Public()
  @ApiOperation({ summary: 'Générer rapport institutionnel ONC-CI (B2G)' })
  @ApiQuery({ name: 'tenant', required: false })
  @ApiQuery({ name: 'periode', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['TRIMESTRIEL', 'ANNUEL', 'SEMESTRIEL'] })
  async rapport(
    @Query('tenant') tenant = 'CI',
    @Query('periode') periode = '2025',
    @Query('type') type = 'TRIMESTRIEL',
  ) {
    return this.etude.genererRapport(tenant, periode, type);
  }

  @Get('export/csv')
  @Public()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="yira-kpis-onc-ci.csv"')
  @ApiOperation({ summary: 'Export CSV KPIs pour ministères (ISO 20252)' })
  async exportCSV(@Query('tenant') tenant = 'CI', @Query('periode') periode = '2025') {
    return this.etude.exporterCSV(tenant, periode);
  }

  @Get('ping')
  @Public()
  ping() {
    return { status: 'ONC-CI OK', kpis: 'PND + ODD Nations Unies', conformite: 'ISO 20252', classification: 'B2G', timestamp: new Date().toISOString() };
  }
}