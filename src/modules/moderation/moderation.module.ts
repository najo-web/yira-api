import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';

@Module({
  imports:     [ConfigModule],
  providers:   [ModerationService],
  controllers: [ModerationController],
  exports:     [ModerationService],
})
export class ModerationModule {}