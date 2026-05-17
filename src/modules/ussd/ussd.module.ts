import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UssdService } from './ussd.service';
import { UssdController } from './ussd.controller';
import { UssdSessionService } from './ussd-session.service';
import { UssdVasRouterService } from './ussd-vas-router.service';
import { OsModule } from '../os/os.module';
import { TelecomModule } from '../telecom/telecom.module';

@Module({
  imports:     [OsModule, ConfigModule, TelecomModule],
  controllers: [UssdController],
  providers:   [UssdService, UssdSessionService, UssdVasRouterService],
  exports:     [UssdService, UssdSessionService, UssdVasRouterService],
})
export class UssdModule {}