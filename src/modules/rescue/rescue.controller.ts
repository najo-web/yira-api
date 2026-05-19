import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { RescueService } from './rescue.service';
import { Public } from '../../auth/decorators';

@ApiTags('YIRA-RESCUE')
@Controller('rescue')
export class RescueController {
  constructor(private rescue: RescueService) {}

  @Post('auto')
  @Public()
  @ApiOperation({ summary: 'Déclenchement auto RESCUE (Trust Index < 0,6 depuis Antifraude)' })
  async declencherAuto(@Body() body: any) {
    return this.rescue.declencherAuto(body.telephone, body.trust_index, body.genre ?? 'M', body.tenant_id);
  }

  @Post('souscrire')
  @Public()
  @ApiOperation({ summary: 'Souscrire volontairement au coaching RESCUE (2000 FCFA/30j)' })
  async souscrire(@Body() body: any) {
    return this.rescue.souscrire(body.telephone, body.genre ?? 'M', body.tenant_id);
  }

  @Get('message-du-jour')
  @Public()
  @ApiOperation({ summary: 'Obtenir le message de coaching du jour' })
  @ApiQuery({ name: 'telephone', required: true })
  @ApiQuery({ name: 'tenant', required: false })
  async messageDuJour(@Query('telephone') telephone: string, @Query('tenant') tenant = 'CI') {
    return this.rescue.obtenirMessageDuJour(telephone, tenant);
  }

  @Post('repondre')
  @Public()
  @ApiOperation({ summary: 'Soumettre réponse au coaching du jour' })
  @ApiBody({ schema: { type: 'object', properties: {
    telephone: { type: 'string', example: '+2250708647166' },
    reponse:   { type: 'string', example: 'Ma plus grande force est ma perseverance...' },
    tenant_id: { type: 'string', example: 'CI' },
  }}})
  async repondre(@Body() body: any) {
    return this.rescue.repondreJour(body.telephone, body.reponse, body.tenant_id);
  }

  @Get('statut')
  @Public()
  @ApiOperation({ summary: 'Statut du programme RESCUE actif' })
  @ApiQuery({ name: 'telephone', required: true })
  @ApiQuery({ name: 'tenant', required: false })
  async statut(@Query('telephone') telephone: string, @Query('tenant') tenant = 'CI') {
    return this.rescue.obtenirStatut(telephone, tenant);
  }

  @Get('ping')
  @Public()
  ping() { return { status: 'RESCUE OK', coaching: '30 jours', figures: 'Vieux Pere + Grande Soeur', timestamp: new Date().toISOString() }; }
}