import { Controller, Post, Get, Body } from '@nestjs/common';
import { OpService, ProfilOrientation } from './op.service';
import { Public } from '../../auth/decorators';

@Controller('op')
export class OpController {
  constructor(private op: OpService) {}

  @Post('evaluer')
  @Public()
  async evaluer(@Body() profil: ProfilOrientation) {
    return this.op.evaluer(profil);
  }

  @Get('ping')
  @Public()
  async ping() {
    return this.op.ping();
  }
}