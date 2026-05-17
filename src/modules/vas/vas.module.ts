import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VasAbonnementService } from './vas-abonnement.service';
import { VasAbonnementController } from './vas-abonnement.controller';
import { TelecomModule } from '../telecom/telecom.module';

@Module({
  imports:     [ConfigModule, TelecomModule],
  providers:   [VasAbonnementService],
  controllers: [VasAbonnementController],
  exports:     [VasAbonnementService],
})
export class VasModule {}