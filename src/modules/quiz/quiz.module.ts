// =============================================================================
// YIRA V3.0 — QuizModule
// Sprint 51 — Ajout AgentManagerService (L3 §7.1)
// =============================================================================
import { Module }                    from '@nestjs/common';
import { ConfigModule }              from '@nestjs/config';
import { QuizGeneratorService }      from './quiz-generator.service';
import { QuizGeneratorController }   from './quiz-generator.controller';
import { ContentSourceService }      from './content-source/content-source.service';
import { AgentManagerService }       from './agent-manager.service';
import { AgentManagerController }    from './agent-manager.controller';
import { TelecomModule }             from '../telecom/telecom.module';

@Module({
  imports:     [ConfigModule, TelecomModule],
  providers:   [QuizGeneratorService, ContentSourceService, AgentManagerService],
  controllers: [QuizGeneratorController, AgentManagerController],
  exports:     [QuizGeneratorService, ContentSourceService, AgentManagerService],
})
export class QuizModule {}