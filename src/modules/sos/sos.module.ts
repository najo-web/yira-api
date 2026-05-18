import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SosService } from './sos.service';
import { SosController } from './sos.controller';

@Module({
  imports:     [ConfigModule],
  providers:   [SosService],
  controllers: [SosController],
  exports:     [SosService],
})
export class SosModule {}