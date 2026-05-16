import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { Public } from '../../auth/decorators';
import { PushSmsService } from './push-sms.service';

// Définition d'interfaces pour typer proprement les corps de requêtes (DTOs)
interface ValiderBody {
  moderateurId?: string;
}

interface RejeterBody {
  moderateurId?: string;
  motif?: string;
}

interface CorrigerBody {
  moderateurId?: string;
  correction: string;
}

@Controller('moderation')
export class ModerationController {
  constructor(
    private readonly moderation: ModerationService, // Ajout de readonly (bonne pratique)
    private readonly pushSmsService: PushSmsService, // Renommé pour éviter le conflit de nom
  ) {}

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
  async valider(@Param('id') id: string, @Body() body: ValiderBody) {
    return this.moderation.validerQuestion(id, body.moderateurId ?? 'COMMAND_USER');
  }

  @Post('rejeter/:id')
  @Public()
  async rejeter(@Param('id') id: string, @Body() body: RejeterBody) {
    return this.moderation.rejeterQuestion(id, body.moderateurId ?? 'COMMAND_USER', body.motif ?? 'Non conforme');
  }

  @Post('corriger/:id')
  @Public()
  async corriger(@Param('id') id: string, @Body() body: CorrigerBody) {
    return this.moderation.corrigerQuestion(id, body.moderateurId ?? 'COMMAND_USER', body.correction);
  }

  @Post('auto-valider')
  @Public()
  async autoValiderManuel() {
    await this.moderation.autoValider();
    return { success: true, message: 'Auto-validation déclenchée manuellement' };
  }

  @Post('push-sms')
  @Public()
  async declencherPushSms() { // CORRECTION : Nom de méthode modifié
    const resultats = await this.pushSmsService.pusherMaintenant();
    return { success: true, resultats };
  }

  @Get('abonnes/stats')
  @Public()
  async statsAbonnes() {
    return this.pushSmsService.statsAbonnes();
  }
}