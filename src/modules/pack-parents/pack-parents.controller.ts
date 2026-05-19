import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PackParentsService } from './pack-parents.service';
import { Public } from '../../auth/decorators';

@ApiTags('Pack Parents')
@Controller('pack-parents')
export class PackParentsController {
  constructor(private packParents: PackParentsService) {}

  @Post('souscrire')
  @Public()
  @ApiOperation({ summary: 'Souscrire au Pack Parents 1000 FCFA (10 SMS + QR rapport)' })
  @ApiBody({ schema: { type: 'object', properties: {
    telephone_parent: { type: 'string', example: '+2250707654321' },
    telephone_enfant: { type: 'string', example: '+2250505123456' },
    nom_enfant:       { type: 'string', example: 'Kouame Junior' },
    niveau_enfant:    { type: 'string', example: 'BEPC' },
    type_pack:        { type: 'string', enum: ['MENSUEL','TRIMESTRIEL'], example: 'MENSUEL' },
    tenant_id:        { type: 'string', example: 'CI' },
  }}})
  async souscrire(@Body() body: any) {
    return this.packParents.souscrire(
      body.telephone_parent, body.telephone_enfant,
      body.nom_enfant ?? 'Mon enfant', body.niveau_enfant ?? 'BEPC',
      body.type_pack ?? 'MENSUEL', body.tenant_id
    );
  }

  @Post(':packId/sms/envoyer')
  @Public()
  @ApiOperation({ summary: 'Envoyer le prochain SMS d alerte au parent' })
  @ApiParam({ name: 'packId' })
  async envoyerSMS(@Param('packId') packId: string, @Query('tenant') tenant = 'CI') {
    return this.packParents.envoyerProchainSMS(packId, tenant);
  }

  @Post(':packId/rapport')
  @Public()
  @ApiOperation({ summary: 'Générer rapport mensuel IA pour les parents' })
  @ApiParam({ name: 'packId' })
  async genererRapport(@Param('packId') packId: string, @Body() body: any, @Query('tenant') tenant = 'CI') {
    return this.packParents.genererRapport(packId, body.profil_enfant, tenant);
  }

  @Post(':packId/renouveler')
  @Public()
  @ApiOperation({ summary: 'Renouveler Pack Parents (500 FCFA)' })
  @ApiParam({ name: 'packId' })
  async renouveler(@Param('packId') packId: string, @Body() body: any, @Query('tenant') tenant = 'CI') {
    return this.packParents.renouveler(packId, body.telephone_parent, tenant);
  }

  @Get('statut')
  @Public()
  @ApiOperation({ summary: 'Statut packs actifs pour un parent' })
  @ApiQuery({ name: 'telephone', required: true })
  @ApiQuery({ name: 'tenant', required: false })
  async statut(@Query('telephone') telephone: string, @Query('tenant') tenant = 'CI') {
    return this.packParents.obtenirStatut(telephone, tenant);
  }

  @Get('ping')
  @Public()
  ping() {
    return { status: 'PACK-PARENTS OK', tarif: '1000 FCFA/mois', sms: '10 alertes', renouvellement: '500 FCFA', timestamp: new Date().toISOString() };
  }
}