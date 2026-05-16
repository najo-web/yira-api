import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpService } from './op.service';
import { OpController } from './op.controller';
import { IaModule } from '../../ia/ia.module';

@Module({
  imports:     [ConfigModule, IaModule],
  controllers: [OpController],
  providers:   [OpService],
  exports:     [OpService],
})
export class OpModule {}