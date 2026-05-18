import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FreemiumService } from './freemium.service';
import { FreemiumController } from './freemium.controller';
import { TelecomModule } from '../telecom/telecom.module';

@Module({
  imports:     [ConfigModule, TelecomModule],
  providers:   [FreemiumService],
  controllers: [FreemiumController],
  exports:     [FreemiumService],
})
export class FreemiumModule {}