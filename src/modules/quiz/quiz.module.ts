import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QuizGeneratorService } from './quiz-generator.service';
import { QuizGeneratorController } from './quiz-generator.controller';

@Module({
  imports:     [ConfigModule],
  providers:   [QuizGeneratorService],
  controllers: [QuizGeneratorController],
  exports:     [QuizGeneratorService],
})
export class QuizModule {}