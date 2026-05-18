import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PasseportService } from './passeport.service';
import { PasseportController } from './passeport.controller';
import { TelecomModule } from '../telecom/telecom.module';
import { OpModule } from '../op/op.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports:     [ConfigModule, TelecomModule, OpModule, AssessmentModule, PaymentModule],
  providers:   [PasseportService],
  controllers: [PasseportController],
  exports:     [PasseportService],
})
export class PasseportModule {}