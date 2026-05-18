import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QuizGeneratorService } from './quiz-generator.service';
import { QuizGeneratorController } from './quiz-generator.controller';
import { ContentSourceService } from './content-source/content-source.service';
import { TelecomModule } from '../telecom/telecom.module';

@Module({
  imports:     [ConfigModule, TelecomModule],
  providers:   [QuizGeneratorService, ContentSourceService],
  controllers: [QuizGeneratorController],
  exports:     [QuizGeneratorService, ContentSourceService],
})
export class QuizModule {}