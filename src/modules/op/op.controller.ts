// ============================================================
// YIRA — src/modules/op/op.controller.ts
// ============================================================
import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { OpService }            from './op.service';
import type { SessionOpInput }  from './op.service';
import { JwtAuthGuard }         from '../../auth/jwt-auth.guard';
import { Public, CurrentUser }  from '../../auth/decorators';

@Controller('op')
@UseGuards(JwtAuthGuard)
export class OpController {
  constructor(private opService: OpService) {}

  // POST /api/op/evaluer
  @Post('evaluer')
  async evaluer(@Body() input: SessionOpInput, @CurrentUser() user: any) {
    input.profil.country_code = user.country_code ?? 'CI';
    input.profil.telephone    = user.telephone;
    return this.opService.genererRapportOp(input);
  }

  @Get('ping')
  @Public()
  ping() {
    return { module: 'YIRA-OP', status: '✅ opérationnel', version: '8', segments: 5 };
  }
}