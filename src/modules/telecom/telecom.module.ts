import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelecomService } from './telecom.service';
import { TelecomController } from './telecom.controller';
import { SmsTemplateService } from './sms-template.service';
import { AfricasTalkingProvider } from './providers/africas-talking.provider';

@Module({
  imports:     [ConfigModule],
  providers:   [TelecomService, AfricasTalkingProvider, SmsTemplateService],
  controllers: [TelecomController],
  exports:     [TelecomService, SmsTemplateService],
})
export class TelecomModule {}