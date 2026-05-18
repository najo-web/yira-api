import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { VasAbonnementService } from './vas-abonnement.service';
import { Public } from '../../auth/decorators';

@ApiTags('VAS')
@Controller('vas')
export class VasAbonnementController {
  constructor(private vas: VasAbonnementService) {}

  @Post('optin')
  @Public()
  @ApiOperation({ summary: 'Opt-in service VAS (double opt-in ARTCI)', description: 'Abonnement à un service VAS avec confirmation SMS automatique. Conforme ARTCI Art.4.1.' })
  @ApiBody({ schema: { type:'object', properties: { telephone: { type:'string', example:'+2250708647166' }, serviceCode: { type:'string', example:'ZOUGLOU' }, tenantId: { type:'string', example:'CI' } } } })
  @ApiResponse({ status:200, description:'Abonnement créé ou existant' })
  async optIn(@Body() body: { telephone: string; serviceCode: string; tenantId?: string }) {
    return this.vas.optIn(body.telephone, body.serviceCode, body.tenantId);
  }

  @Post('optout')
  @Public()
  @ApiOperation({ summary: 'Opt-out service VAS (STOP < 5s ARTCI)', description: 'Désabonnement immédiat conforme ARTCI — effectif en moins de 5 secondes.' })
  @ApiBody({ schema: { type:'object', properties: { telephone: { type:'string', example:'+2250708647166' }, serviceCode: { type:'string', example:'ZOUGLOU' } } } })
  async optOut(@Body() body: { telephone: string; serviceCode: string; tenantId?: string }) {
    return this.vas.optOut(body.telephone, body.serviceCode, body.tenantId);
  }

  @Get('statut/:telephone/:serviceCode')
  @Public()
  @ApiOperation({ summary: 'Statut abonnement VAS' })
  @ApiParam({ name:'telephone', example:'+2250708647166' })
  @ApiParam({ name:'serviceCode', example:'ZOUGLOU' })
  async statut(@Param('telephone') telephone: string, @Param('serviceCode') serviceCode: string) {
    return this.vas.verifierStatut(telephone, serviceCode);
  }

  @Post('facturer')
  @Public()
  @ApiOperation({ summary: 'Facturer un abonné (débit Mobile Money)', description: 'Lance le débit quotidien d\'un abonné via le Payment Provider du pays.' })
  async facturer(@Body() body: { telephone: string; serviceCode: string }) {
    return this.vas.facturerAbonne(body.telephone, body.serviceCode);
  }

  @Post('facturer-tous')
  @Public()
  @ApiOperation({ summary: 'Lancer facturation quotidienne manuelle', description: 'Déclenche manuellement le CRON de facturation 06h00.' })
  async facturerTous() {
    await this.vas.facturerQuotidien();
    return { message: 'Facturation lancee' };
  }

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Statistiques abonnements VAS par pays' })
  @ApiQuery({ name:'tenant', required:false, example:'CI' })
  async stats(@Query('tenant') tenant = 'CI') {
    return this.vas.stats(tenant);
  }

  @Get('ping')
  @Public()
  @ApiOperation({ summary: 'Santé du module VAS' })
  ping() { return { status: 'VAS OK', timestamp: new Date().toISOString() }; }
}