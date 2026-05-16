import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SaraWalletService } from './sara-wallet.service';
import { Public } from '../../auth/decorators';

@Controller('sara')
export class SaraController {
  constructor(private wallet: SaraWalletService) {}

  @Get('solde/:userId')
  @Public()
  async solde(@Param('userId') userId: string) {
    return this.wallet.solde(userId);
  }

  @Get('historique/:userId')
  @Public()
  async historique(@Param('userId') userId: string) {
    return this.wallet.historique(userId);
  }

  @Post('depot')
  @Public()
  async depot(@Body() body: { userId: string; montant: number; provider: string }) {
    return this.wallet.depot(body.userId, body.montant, body.provider);
  }

  @Post('retrait')
  @Public()
  async retrait(@Body() body: { userId: string; montant: number; provider: string }) {
    return this.wallet.retrait(body.userId, body.montant, body.provider);
  }

  @Post('score/:userId')
  @Public()
  async score(@Param('userId') userId: string) {
    return this.wallet.obtenirScore(userId);
  }

  @Get('ping')
  @Public()
  ping() { return { status: 'SARA OK', timestamp: new Date().toISOString() }; }
}