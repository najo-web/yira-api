import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArtciReportingService } from './artci-reporting.service';
import { CommandController } from './command.controller';

@Module({
  imports:     [ConfigModule],
  providers:   [ArtciReportingService],
  controllers: [CommandController],
  exports:     [ArtciReportingService],
})
export class CommandModule {}