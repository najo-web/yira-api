import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { VasAbonnementService } from './vas-abonnement.service';
import { Public } from '../../auth/decorators';

@Controller('vas')
export class VasAbonnementController {
  constructor(private vas: VasAbonnementService) {}

  @Post('optin')
  @Public()
  async optIn(@Body() body: { telephone: string; serviceCode: string; tenantId?: string }) {
    return this.vas.optIn(body.telephone, body.serviceCode, body.tenantId);
  }

  @Post('optout')
  @Public()
  async optOut(@Body() body: { telephone: string; serviceCode: string; tenantId?: string }) {
    return this.vas.optOut(body.telephone, body.serviceCode, body.tenantId);
  }

  @Get('statut/:telephone/:serviceCode')
  @Public()
  async statut(
    @Param('telephone') telephone: string,
    @Param('serviceCode') serviceCode: string,
  ) {
    return this.vas.verifierStatut(telephone, serviceCode);
  }

  @Post('facturer')
  @Public()
  async facturer(@Body() body: { telephone: string; serviceCode: string }) {
    return this.vas.facturerAbonne(body.telephone, body.serviceCode);
  }

  @Post('facturer-tous')
  @Public()
  async facturerTous() {
    await this.vas.facturerQuotidien();
    return { message: 'Facturation lancee' };
  }

  @Get('stats')
  @Public()
  async stats(@Query('tenant') tenant = 'CI') {
    return this.vas.stats(tenant);
  }

  @Get('ping')
  @Public()
  ping() { return { status: 'VAS OK', timestamp: new Date().toISOString() }; }
}