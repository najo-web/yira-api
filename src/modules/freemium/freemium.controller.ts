import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FreemiumService } from './freemium.service';
import { Public } from '../../auth/decorators';

@ApiTags('Freemium')
@Controller('freemium')
export class FreemiumController {
  constructor(private freemium: FreemiumService) {}

  @Post('session')
  @Public()
  @ApiOperation({ summary: 'Vérifier et incrémenter session freemium (3/semaine)' })
  @ApiBody({ schema: { type:'object', properties: { telephone: { type:'string', example:'+2250708647166' }, serviceCode: { type:'string', example:'ZOUGLOU' }, tenantId: { type:'string', example:'CI' } } } })
  async session(@Body() body: { telephone: string; serviceCode: string; tenantId?: string }) {
    return this.freemium.verifierEtIncrementer(body.telephone, body.serviceCode, body.tenantId);
  }

  @Get('statut/:telephone/:serviceCode')
  @Public()
  @ApiOperation({ summary: 'Consulter le statut freemium sans incrémenter' })
  @ApiParam({ name:'telephone', example:'+2250708647166' })
  @ApiParam({ name:'serviceCode', example:'ZOUGLOU' })
  async statut(
    @Param('telephone') telephone: string,
    @Param('serviceCode') serviceCode: string,
    @Query('tenant') tenant = 'CI',
  ) {
    return this.freemium.verifierStatut(telephone, serviceCode, tenant);
  }

  @Post('consentement/demander')
  @Public()
  @ApiOperation({ summary: 'Demander consentement parental (OTP au parent)' })
  @ApiBody({ schema: { type:'object', properties: { telephoneMineur: { type:'string', example:'+2250708647166' }, telephoneParent: { type:'string', example:'+2250707417187' }, tenantId: { type:'string', example:'CI' } } } })
  async demanderConsentement(@Body() body: { telephoneMineur: string; telephoneParent: string; tenantId?: string }) {
    return this.freemium.demanderConsentementParental(body.telephoneMineur, body.telephoneParent, body.tenantId);
  }

  @Post('consentement/valider')
  @Public()
  @ApiOperation({ summary: 'Valider consentement parental avec OTP' })
  @ApiBody({ schema: { type:'object', properties: { telephoneMineur: { type:'string' }, otp: { type:'string', example:'123456' }, tenantId: { type:'string', example:'CI' } } } })
  async validerConsentement(@Body() body: { telephoneMineur: string; otp: string; tenantId?: string }) {
    return this.freemium.validerConsentementParental(body.telephoneMineur, body.otp, body.tenantId);
  }

  @Get('consentement/:telephone')
  @Public()
  @ApiOperation({ summary: 'Vérifier si consentement parental valide' })
  @ApiParam({ name:'telephone', example:'+2250708647166' })
  async consentementValide(@Param('telephone') telephone: string, @Query('tenant') tenant = 'CI') {
    const valide = await this.freemium.estConsentementValide(telephone, tenant);
    return { telephone, consentement_valide: valide };
  }

  @Get('ping')
  @Public()
  @ApiOperation({ summary: 'Santé FreemiumService' })
  ping() { return { status: 'FREEMIUM OK', timestamp: new Date().toISOString() }; }
}