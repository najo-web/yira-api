// ============================================================
// YIRA â€” src/modules/ussd/ussd.controller.ts
// LAfricaMobile envoie les requÃªtes USSD ici
// Format : POST avec body form-urlencoded ou JSON
// ============================================================
import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { UssdService } from './ussd.service';
import { Public }      from '../../auth/decorators';

@Controller('ussd')
export class UssdController {
  constructor(private ussdService: UssdService) {}

  // POST /api/ussd â€” endpoint principal LAfricaMobile
  // Pas de JWT â€” LAfricaMobile n'envoie pas de token
  @Post()
  @Public()
  async traiter(
    @Body('sessionId')   sessionId: string,
    @Body('phoneNumber') phoneNumber: string,
    @Body('serviceCode') serviceCode: string,
    @Body('text')        text: string,
  ) {
    const reponse = await this.ussdService.traiter({
      sessionId:   sessionId ?? `SIM_${Date.now()}`,
      phoneNumber: phoneNumber ?? '0000000000',
      serviceCode: serviceCode ?? '*7572#',
      text:        text ?? '',
    });
    // LAfricaMobile attend une rÃ©ponse texte plain
    return reponse;
  }

  // GET /api/ussd/simuler â€” simulateur USSD pour tests
  // Utiliser dans le navigateur ou Postman
  @Get('simuler')
  @Public()
  async simuler(
    @Query('tel')    tel: string,
    @Query('texte')  texte: string,
    @Query('sessId') sessId: string,
  ) {
    const reponse = await this.ussdService.traiter({
      sessionId:   sessId ?? `TEST_${Date.now()}`,
      phoneNumber: tel ?? '0701000099',
      serviceCode: '*7572#',
      text:        texte ?? '',
    });
    // Formatter pour affichage dans navigateur
    return {
      ecran_ussd: reponse,
      type:       reponse.startsWith('CON') ? 'CONTINUER' : 'TERMINER',
      longueur:   reponse.length,
      nokia_ok:   reponse.length <= 182,
    };
  }

  // GET /api/ussd/ping
  @Get('ping')
  @Public()
  ping() {
    return { module: 'YIRA-USSD', status: 'âœ… opÃ©rationnel', shortcode: '*7572#' };
  }
}