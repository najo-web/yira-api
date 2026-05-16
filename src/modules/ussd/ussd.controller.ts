// =============================================================================
// YIRA V3.0 — UssdController
// Shortcode lu depuis base_core.country_config (Zéro Hardcode L2)
// =============================================================================
import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { UssdService } from './ussd.service';
import { Public } from '../../auth/decorators';
import { Pool } from 'pg';

@Controller('ussd')
export class UssdController {
  private poolCore     = new Pool({ connectionString: process.env.DATABASE_URL_CORE });
  private shortcodeCache: string | null = null;

  constructor(private ussd: UssdService) {}

  // ---------------------------------------------------------------------------
  // Lire shortcode depuis base_core (Zéro Hardcode)
  // ---------------------------------------------------------------------------
  private async getShortcode(): Promise<string> {
    if (this.shortcodeCache) return this.shortcodeCache;
    try {
      const tenantId = process.env.NODE_ENV === 'production' ? 'CI' : 'NAJO_DEV';
      const res = await this.poolCore.query(
        `SELECT ussd_short_code FROM core.country_config WHERE tenant_id = $1`,
        [tenantId],
      );
      const code = res.rows[0]?.ussd_short_code;
      if (code) this.shortcodeCache = code;
      return code ?? (process.env.NODE_ENV === 'production' ? '*7572#' : '*384*54077#');
    } catch {
      return process.env.NODE_ENV === 'production' ? '*7572#' : '*384*54077#';
    }
  }

  // ---------------------------------------------------------------------------
  // POST /api/ussd — Callback AfricasTalking
  // ---------------------------------------------------------------------------
  @Post()
  @Public()
  async handleUssd(@Body() body: any) {
    const shortcode = await this.getShortcode();
    return this.ussd.traiter({
      sessionId:   body.sessionId,
      serviceCode: body.serviceCode ?? shortcode,
      phoneNumber: body.phoneNumber,
      text:        body.text ?? '',
    });
  }

  // ---------------------------------------------------------------------------
  // GET /api/ussd/simuler — Test local
  // ---------------------------------------------------------------------------
  @Get('simuler')
  @Public()
  async simuler(
    @Query('tel') tel = '+2250700000001',
    @Query('text') text = '',
  ) {
    const shortcode = await this.getShortcode();
    return this.ussd.traiter({
      sessionId:   'sim-' + Date.now(),
      serviceCode: shortcode,
      phoneNumber: tel,
      text,
    });
  }

  // ---------------------------------------------------------------------------
  // GET /api/ussd/ping
  // ---------------------------------------------------------------------------
  @Get('ping')
  @Public()
  async ping() {
    const shortcode = await this.getShortcode();
    return {
      module:    'YIRA-USSD',
      status:    '✅ opérationnel',
      shortcode,
      env:       process.env.NODE_ENV ?? 'development',
    };
  }
}