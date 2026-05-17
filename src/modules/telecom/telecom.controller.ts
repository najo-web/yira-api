// =============================================================================
// YIRA V3.0 — TelecomController
// Endpoints SMS test + delivery webhook AT
// =============================================================================
import { Controller, Post, Body, Get } from '@nestjs/common';
import { TelecomService } from './telecom.service';
import { Public } from '../../auth/decorators';

@Controller('telecom')
export class TelecomController {
  constructor(private telecom: TelecomService) {}

  // ---------------------------------------------------------------------------
  // POST /api/telecom/sms/envoyer — Envoi SMS direct
  // ---------------------------------------------------------------------------
  @Post('sms/envoyer')
  @Public()
  async envoyerSms(@Body() body: { telephone: string; message: string }) {
    const result = await this.telecom.sendVas(body.telephone, body.message);
    return { success: result.success, detail: result };
  }

  // ---------------------------------------------------------------------------
  // POST /api/telecom/sms/test — SMS de test sandbox AT
  // ---------------------------------------------------------------------------
  @Post('sms/test')
  @Public()
  async testSms(@Body() body: { telephone: string; message?: string }) {
    const msg = body.message ?? 'YIRA V3.0 — Test SMS sandbox. Si vous recevez ce message, le systeme fonctionne!';
    const result = await this.telecom.sendVas(body.telephone, msg);
    return {
      success:   result.success,
      telephone: body.telephone,
      message:   msg,
      provider:  'AfricasTalking',
      env:       process.env.AFRICASTALKING_ENV ?? 'sandbox',
      detail:    result,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /api/telecom/sms/delivery — Webhook livraison AT
  // ---------------------------------------------------------------------------
  @Post('sms/delivery')
  @Public()
  async deliveryReport(@Body() body: any) {
    return { received: true, data: body };
  }

  // ---------------------------------------------------------------------------
  // GET /api/telecom/ping
  // ---------------------------------------------------------------------------
  @Get('ping')
  @Public()
  ping() {
    return {
      status:   'TELECOM OK',
      provider: 'AfricasTalking',
      env:      process.env.AFRICASTALKING_ENV ?? 'sandbox',
      username: process.env.AFRICASTALKING_USERNAME ?? 'sandbox',
    };
  }
}
