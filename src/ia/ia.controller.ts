// ============================================================
// YIRA V3.0 — src/ia/ia.controller.ts
// ============================================================
import { Controller, Get, Post, Body } from '@nestjs/common';
import { IaService }    from './ia.service';
import type { IaInput } from './ia.service';
import { Public }       from '../auth/decorators';

@Controller('ia')
export class IaController {
  constructor(private iaService: IaService) {}

  @Get('health')
  @Public()
  health() {
    return {
      gemini:    'Configured',
      claude:    'Configured',
      fallback:  'Automatique si Gemini timeout > 8s',
      message:   'YIRA IA Health Check',
      status:    'OK',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test')
  @Public()
  async tester(@Body() input: IaInput) {
    return this.iaService.generate(input);
  }
}