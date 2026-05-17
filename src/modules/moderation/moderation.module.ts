import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModerationService } from './moderation.service';
import { PushSmsService } from './push-sms.service';
import { ModerationController } from './moderation.controller';
import { TelecomModule } from '../telecom/telecom.module';

@Module({
  imports:     [ConfigModule, TelecomModule],
  providers:   [ModerationService, PushSmsService],
  controllers: [ModerationController],
  exports:     [ModerationService, PushSmsService],
})
export class ModerationModule {}