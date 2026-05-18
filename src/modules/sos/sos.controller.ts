import { Controller, Post, Get, Param, Body, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { SosService } from './sos.service';
import { Public } from '../../auth/decorators';

@ApiTags('SOS')
@Controller('sos')
export class SosController {
  constructor(private sos: SosService) {}

  @Post('signaler')
  @Public()
  @ApiOperation({ summary: 'Créer un signalement SOS (chiffré AES-256)' })
  @ApiBody({ schema: { type:'object', properties: {
    telephone:    { type:'string', example:'+2250708647166' },
    type_urgence: { type:'string', example:'VIOLENCE', enum:['VIOLENCE','DETRESSE','MEDICAL','AUTRE'] },
    description:  { type:'string', example:'Description de la situation' },
    localisation: { type:'string', example:'Cocody Abidjan' },
    tenant_id:    { type:'string', example:'CI' },
  }}})
  async signaler(@Body() body: any) {
    return this.sos.creerSignalement(body);
  }

  @Get('liste')
  @Public()
  @ApiOperation({ summary: 'Lister les signalements (sans déchiffrement — travailleurs sociaux)' })
  @ApiQuery({ name:'tenant', required:false, example:'CI' })
  @ApiQuery({ name:'statut', required:false, example:'NOUVEAU' })
  async lister(@Query('tenant') tenant = 'CI', @Query('statut') statut?: string) {
    return this.sos.listerSignalements(tenant, statut);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lire un signalement déchiffré (accès restreint travailleurs sociaux)' })
  @ApiParam({ name:'id', description:'UUID du signalement' })
  @ApiQuery({ name:'travailleur_id', required:true, example:'TS-001' })
  async lire(
    @Param('id') id: string,
    @Query('travailleur_id') travailleurId: string,
    @Query('tenant') tenant = 'CI',
    @Headers('x-forwarded-for') ip = '127.0.0.1',
  ) {
    return this.sos.lireSignalement(id, travailleurId, ip, tenant);
  }

  @Post(':id/traiter')
  @Public()
  @ApiOperation({ summary: 'Marquer un signalement comme en cours de traitement' })
  @ApiParam({ name:'id' })
  async traiter(
    @Param('id') id: string,
    @Body('travailleur_id') travailleurId: string,
    @Query('tenant') tenant = 'CI',
    @Headers('x-forwarded-for') ip = '127.0.0.1',
  ) {
    const ok = await this.sos.traiterSignalement(id, travailleurId, ip, tenant);
    return { success: ok };
  }

  @Post('anonymiser')
  @Public()
  @ApiOperation({ summary: 'Anonymiser les signalements > 90 jours (CRON manuel)' })
  async anonymiser(@Query('tenant') tenant = 'CI') {
    const nb = await this.sos.anonymiserSignalements(tenant);
    return { success: true, anonymises: nb };
  }

  @Get('ping')
  @Public()
  @ApiOperation({ summary: 'Santé SosService' })
  ping() { return { status: 'SOS OK', chiffrement: 'AES-256-CBC', timestamp: new Date().toISOString() }; }
}