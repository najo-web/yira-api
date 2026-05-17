import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SaraWalletService } from './sara-wallet.service';
import { SaraController } from './sara.controller';
import { TelecomModule } from '../telecom/telecom.module';

@Module({
  imports:     [ConfigModule, TelecomModule],
  providers:   [SaraWalletService],
  controllers: [SaraController],
  exports:     [SaraWalletService],
})
export class SaraModule {}