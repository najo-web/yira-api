import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VeillesMarcheService } from './veille-marche.service';
import { VeillesMarcheController } from './veille-marche.controller';
import { TelecomModule } from '../telecom/telecom.module';

@Module({
  imports:     [ConfigModule, TelecomModule],
  providers:   [VeillesMarcheService],
  controllers: [VeillesMarcheController],
  exports:     [VeillesMarcheService],
})
export class VeilleModule {}