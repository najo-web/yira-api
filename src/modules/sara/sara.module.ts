import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SaraWalletService } from './sara-wallet.service';
import { SaraController } from './sara.controller';

@Module({
  imports:     [ConfigModule],
  providers:   [SaraWalletService],
  controllers: [SaraController],
  exports:     [SaraWalletService],
})
export class SaraModule {}