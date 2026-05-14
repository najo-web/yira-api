import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UssdService } from './ussd.service';
import { UssdController } from './ussd.controller';
import { UssdSessionService } from './ussd-session.service';
import { OsModule } from '../os/os.module';

@Module({
  imports:     [OsModule, ConfigModule],
  controllers: [UssdController],
  providers:   [UssdService, UssdSessionService],
  exports:     [UssdService, UssdSessionService],
})
export class UssdModule {}