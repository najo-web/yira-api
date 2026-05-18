import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UssdService } from './ussd.service';
import { UssdController } from './ussd.controller';
import { UssdSessionService } from './ussd-session.service';
import { UssdVasRouterService } from './ussd-vas-router.service';
import { AssessmentUssdService } from './assessment-ussd.service';
import { OsModule } from '../os/os.module';
import { TelecomModule } from '../telecom/telecom.module';
import { OpModule } from '../op/op.module';

@Module({
  imports:     [OsModule, ConfigModule, TelecomModule, OpModule],
  controllers: [UssdController],
  providers:   [UssdService, UssdSessionService, UssdVasRouterService, AssessmentUssdService],
  exports:     [UssdService, UssdSessionService, UssdVasRouterService, AssessmentUssdService],
})
export class UssdModule {}