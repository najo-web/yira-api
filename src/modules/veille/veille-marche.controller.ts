import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { VeillesMarcheService } from './veille-marche.service';
import { Public } from '../../auth/decorators';

@ApiTags('Veille')
@Controller('veille')
export class VeillesMarcheController {
  constructor(private veille: VeillesMarcheService) {}

  @Post('analyser')
  @Public()
  @ApiOperation({ summary: 'Déclencher analyse de marché manuelle' })
  async analyser(@Query('tenant') tenant = 'CI') {
    const proposition = await this.veille.analyserMaintenant(tenant);
    return { success: !!proposition, proposition };
  }

  @Get('propositions')
  @Public()
  @ApiOperation({ summary: 'Lister les propositions de nouveaux services' })
  @ApiQuery({ name:'tenant', required:false, example:'CI' })
  @ApiQuery({ name:'statut', required:false, example:'EN_ATTENTE_VALIDATION' })
  async lister(@Query('tenant') tenant = 'CI', @Query('statut') statut = 'EN_ATTENTE_VALIDATION') {
    return this.veille.listerPropositions(tenant, statut);
  }

  @Post('propositions/:id/valider')
  @Public()
  @ApiOperation({ summary: 'Valider une proposition → service actif immédiatement' })
  @ApiParam({ name:'id' })
  async valider(
    @Param('id') id: string,
    @Body('admin_id') adminId = 'admin@najo.tech',
    @Query('tenant') tenant = 'CI',
  ) {
    const ok = await this.veille.validerProposition(id, adminId, tenant);
    return { success: ok, message: ok ? 'Service actif — cache invalide' : 'Erreur' };
  }

  @Post('propositions/:id/rejeter')
  @Public()
  @ApiOperation({ summary: 'Rejeter une proposition' })
  @ApiParam({ name:'id' })
  async rejeter(
    @Param('id') id: string,
    @Body('admin_id') adminId = 'admin@najo.tech',
    @Body('raison') raison = 'Non pertinent',
    @Query('tenant') tenant = 'CI',
  ) {
    const ok = await this.veille.rejeterProposition(id, adminId, raison, tenant);
    return { success: ok };
  }

  @Get('ping')
  @Public()
  @ApiOperation({ summary: 'Santé Agent de Veille Marché' })
  ping() { return { status: 'VEILLE OK', agent: 'VEILLE_V1', timestamp: new Date().toISOString() }; }
}