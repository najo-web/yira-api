import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EtudeService }    from './etude.service';
import { EtudeController } from './etude.controller';

@Module({
  imports:     [ConfigModule],
  providers:   [EtudeService],
  controllers: [EtudeController],
  exports:     [EtudeService],
})
export class EtudeModule {}