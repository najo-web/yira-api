import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SignerService } from './signer.service';
import { SignerController } from './signer.controller';
import { TelecomModule } from '../telecom/telecom.module';

@Module({
  imports:     [ConfigModule, TelecomModule],
  providers:   [SignerService],
  controllers: [SignerController],
  exports:     [SignerService],
})
export class SignerModule {}