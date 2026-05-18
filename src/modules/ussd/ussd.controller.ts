// =============================================================================
// YIRA V3.0 — UssdController
// Swagger OpenAPI 3.1 (L3 §8.1)
// =============================================================================
import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { UssdService } from './ussd.service';
import { Public } from '../../auth/decorators';

@ApiTags('USSD')
@Controller('ussd')
export class UssdController {
  constructor(private ussd: UssdService) {}

  @Post()
  @Public()
  @ApiOperation({
    summary:     'Webhook USSD AfricasTalking / LAM',
    description: 'Point d\'entrée principal — reçoit les sessions USSD des opérateurs télécom. Format POST form-urlencoded conforme AT et LAM.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sessionId:   { type: 'string', example: 'ATsession123', description: 'ID session opérateur' },
        serviceCode: { type: 'string', example: '*384*54077#',  description: 'Code court USSD' },
        phoneNumber: { type: 'string', example: '+2250708647166', description: 'Numéro appelant' },
        text:        { type: 'string', example: '1*2',           description: 'Saisies cumulées' },
        networkCode: { type: 'string', example: '63902',         description: 'Code réseau opérateur' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Réponse USSD — commence par CON (continue) ou END (termine)' })
  async handleUssd(@Body() body: any): Promise<string> {
    return this.ussd.traiter({
      sessionId:   body.sessionId   ?? body.session_id ?? 'local',
      phoneNumber: body.phoneNumber ?? body.phone_number ?? '',
      serviceCode: body.serviceCode ?? body.service_code ?? '',
      text:        body.text ?? '',
    });
  }

  @Get('simuler')
  @Public()
  @ApiOperation({
    summary:     'Simuler une session USSD (DEV)',
    description: 'Endpoint de simulation pour les tests sans opérateur télécom réel.',
  })
  @ApiQuery({ name: 'tel',  required: true,  example: '+2250708647166', description: 'Numéro simulé' })
  @ApiQuery({ name: 'text', required: false, example: '1*2',            description: 'Saisies cumulées' })
  @ApiResponse({ status: 200, description: 'Réponse USSD simulée' })
  async simuler(
    @Query('tel')  tel:  string,
    @Query('text') text: string = '',
  ): Promise<string> {
    return this.ussd.traiter({
      sessionId:   'sim-' + Date.now(),
      phoneNumber: tel,
      serviceCode: process.env.USSD_SHORTCODE ?? '*384*54077#',
      text,
    });
  }

  @Get('ping')
  @Public()
  @ApiOperation({ summary: 'Santé du module USSD', description: 'Vérifie que le moteur USSD est opérationnel.' })
  @ApiResponse({ status: 200, description: 'Module opérationnel' })
  ping() {
    return {
      module:    'YIRA-USSD',
      status:    '✅ opérationnel',
      shortcode: process.env.USSD_SHORTCODE ?? '*384*54077#',
      env:       process.env.NODE_ENV ?? 'development',
    };
  }
}