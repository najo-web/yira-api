import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SignerService } from './signer.service';
import { Public } from '../../auth/decorators';

@Controller('signer')
export class SignerController {
  constructor(private signer: SignerService) {}

  @Post('carnet/ouvrir')
  @Public()
  async ouvrirCarnet(@Body() body: any) {
    return this.signer.ouvrirCarnet(body);
  }

  @Post('carnet/signer')
  @Public()
  async signerJour(@Body() body: any) {
    return this.signer.signerJour(body);
  }

  @Post('carnet/pause')
  @Public()
  async pause(@Body() body: { carnet_id: string; jours?: number }) {
    return this.signer.pauseCarnet(body.carnet_id, body.jours);
  }

  @Post('retrait')
  @Public()
  async retrait(@Body() body: { telephone: string; montant: number }) {
    return this.signer.retirerEpargne(body.telephone, body.montant);
  }

  @Post('wallet/depot')
  @Public()
  async depot(@Body() body: { telephone: string; montant: number }) {
    return this.signer.deposerWallet(body.telephone, body.montant);
  }

  @Get('wallet/:telephone')
  @Public()
  async solde(@Param('telephone') telephone: string) {
    const solde = await this.signer.soldeWallet(telephone);
    return { telephone, solde_fcfa: solde };
  }

  @Get('carnet/:telephone')
  @Public()
  async carnet(@Param('telephone') telephone: string) {
    return this.signer.getCarnetByTelephone(telephone);
  }

  @Get('historique/:telephone')
  @Public()
  async historique(@Param('telephone') telephone: string) {
    return this.signer.getHistorique(telephone);
  }

  @Get('ping')
  @Public()
  ping() { return { status: 'SIGNER OK', timestamp: new Date().toISOString() }; }
}