import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelecomService } from './telecom.service';
import { TelecomController } from './telecom.controller';
import { AfricasTalkingProvider } from './providers/africas-talking.provider';

@Module({
  imports:     [ConfigModule],
  providers:   [TelecomService, AfricasTalkingProvider],
  controllers: [TelecomController],
  exports:     [TelecomService],
})
export class TelecomModule {}