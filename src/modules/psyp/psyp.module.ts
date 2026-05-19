import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PsyPService }            from './psyp.service';
import { PsyPController }         from './psyp.controller';
import { InculturisationService } from './inculturation/inculturation.service';
import { CQCIModule }             from '../cqci/cqci.module';
import { IaModule }               from '../../ia/ia.module';

@Module({
  imports:     [ConfigModule, CQCIModule, IaModule],
  providers:   [PsyPService, InculturisationService],
  controllers: [PsyPController],
  exports:     [PsyPService, InculturisationService],
})
export class PsyPModule {}