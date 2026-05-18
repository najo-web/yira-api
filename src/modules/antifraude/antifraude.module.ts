import { Module } from '@nestjs/common';
import { AntifraudeService } from './antifraude.service';
import { AntifraudeController } from './antifraude.controller';

@Module({
  providers:   [AntifraudeService],
  controllers: [AntifraudeController],
  exports:     [AntifraudeService],
})
export class AntifraudeModule {}