import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PackParentsService }    from './pack-parents.service';
import { PackParentsController } from './pack-parents.controller';
import { TelecomModule }         from '../telecom/telecom.module';
import { IaModule }              from '../../ia/ia.module';

@Module({
  imports:     [ConfigModule, TelecomModule, IaModule],
  providers:   [PackParentsService],
  controllers: [PackParentsController],
  exports:     [PackParentsService],
})
export class PackParentsModule {}