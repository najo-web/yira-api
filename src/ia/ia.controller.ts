// ============================================================
// YIRA — src/ia/ia.controller.ts  (fix isolatedModules)
// ============================================================
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { IaService }    from './ia.service';
import type { IaInput } from './ia.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public }       from '../auth/decorators';

@Controller('ia')
export class IaController {
  constructor(private iaService: IaService) {}

  @Get('health')
  @Public()
  async health() {
    const status = await this.iaService.testerConnexion();
    return {
      gemini:  status.gemini ? '✅ OK' : '❌ KO',
      claude:  status.claude ? '✅ OK' : '❌ KO',
      message: 'YIRA IA Health Check',
    };
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async tester(@Body() input: IaInput) {
    return this.iaService.generate(input);
  }
}