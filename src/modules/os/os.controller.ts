// ============================================================
// YIRA — src/modules/os/os.controller.ts  (fix isolatedModules)
// ============================================================
import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { OsService }            from './os.service';
import type { SessionOsInput }  from './os.service';
import { JwtAuthGuard }         from '../../auth/jwt-auth.guard';
import { Public, CurrentUser }  from '../../auth/decorators';

@Controller('os')
@UseGuards(JwtAuthGuard)
export class OsController {
  constructor(private osService: OsService) {}

  @Post('evaluer')
  async evaluer(@Body() input: SessionOsInput, @CurrentUser() user: any) {
    input.beneficiaire.country_code = user.country_code ?? 'CI';
    return this.osService.genererRapportOs(input);
  }

  @Get('ping')
  @Public()
  ping() {
    return { module: 'YIRA-OS', status: '✅ opérationnel', version: '4A' };
  }
}