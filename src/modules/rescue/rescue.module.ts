import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RescueService }    from './rescue.service';
import { RescueController } from './rescue.controller';
import { TelecomModule }    from '../telecom/telecom.module';
import { IaModule }         from '../../ia/ia.module';

@Module({
  imports:     [ConfigModule, TelecomModule, IaModule],
  providers:   [RescueService],
  controllers: [RescueController],
  exports:     [RescueService],
})
export class RescueModule {}