import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { PushSmsService } from './push-sms.service';

@Module({
  imports:     [ConfigModule],
  providers:   [ModerationService, PushSmsService],
  controllers: [ModerationController],
  exports:     [ModerationService, PushSmsService],
})
export class ModerationModule {}