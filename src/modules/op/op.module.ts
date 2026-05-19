import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpService }     from './op.service';
import { OpController }  from './op.controller';
import { JobService }    from './job.service';
import { JobController } from './job.controller';
import { IaModule }      from '../../ia/ia.module';

@Module({
  imports:     [ConfigModule, IaModule],
  providers:   [OpService, JobService],
  controllers: [OpController, JobController],
  exports:     [OpService, JobService],
})
export class OpModule {}