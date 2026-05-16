import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SignerService } from './signer.service';
import { SignerController } from './signer.controller';

@Module({
  imports:     [ConfigModule],
  providers:   [SignerService],
  controllers: [SignerController],
  exports:     [SignerService],
})
export class SignerModule {}