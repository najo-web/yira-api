import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { Public } from '../../auth/decorators';

@Controller('moderation')
export class ModerationController {
  constructor(private moderation: ModerationService) {}

  @Get('en-attente')
  @Public()
  async enAttente(@Query('serviceCode') serviceCode?: string) {
    return this.moderation.listerEnAttente(serviceCode);
  }

  @Get('stats')
  @Public()
  async stats() {
    return this.moderation.statsJour();
  }

  @Post('valider/:id')
  @Public()
  async valider(@Param('id') id: string, @Body() body: { moderateurId: string }) {
    return this.moderation.validerQuestion(id, body.moderateurId ?? 'COMMAND_USER');
  }

  @Post('rejeter/:id')
  @Public()
  async rejeter(@Param('id') id: string, @Body() body: { moderateurId: string; motif: string }) {
    return this.moderation.rejeterQuestion(id, body.moderateurId ?? 'COMMAND_USER', body.motif ?? 'Non conforme');
  }

  @Post('corriger/:id')
  @Public()
  async corriger(@Param('id') id: string, @Body() body: { moderateurId: string; correction: string }) {
    return this.moderation.corrigerQuestion(id, body.moderateurId ?? 'COMMAND_USER', body.correction);
  }

  @Post('auto-valider')
  @Public()
  async autoValiderManuel() {
    await this.moderation.autoValider();
    return { success: true, message: 'Auto-validation déclenchée manuellement' };
  }
}