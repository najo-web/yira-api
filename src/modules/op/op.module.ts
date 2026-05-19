// =============================================================================
// YIRA V3.0 — OpModule
// Sprint 51 — Ajout EvalEngine (Bilan 360° B2G/B2B ISO 10667)
// =============================================================================
import { Module }          from '@nestjs/common';
import { ConfigModule }    from '@nestjs/config';
import { OpService }       from './op.service';
import { OpController }    from './op.controller';
import { JobService }      from './job.service';
import { JobController }   from './job.controller';
import { EvalService }     from './eval.service';
import { EvalController }  from './eval.controller';
import { IaModule }        from '../../ia/ia.module';

@Module({
  imports:     [ConfigModule, IaModule],
  providers:   [OpService, JobService, EvalService],
  controllers: [OpController, JobController, EvalController],
  exports:     [OpService, JobService, EvalService],
})
export class OpModule {}