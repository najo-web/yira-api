import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QuizGeneratorService } from './quiz-generator.service';
import { QuizGeneratorController } from './quiz-generator.controller';
import { TelecomModule } from '../telecom/telecom.module';

@Module({
  imports:     [ConfigModule, TelecomModule],
  providers:   [QuizGeneratorService],
  controllers: [QuizGeneratorController],
  exports:     [QuizGeneratorService],
})
export class QuizModule {}