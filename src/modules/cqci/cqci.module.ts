import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CQCIService }    from './cqci.service';
import { CQCIController } from './cqci.controller';

@Module({
  imports:     [ConfigModule],
  providers:   [CQCIService],
  controllers: [CQCIController],
  exports:     [CQCIService],
})
export class CQCIModule {}