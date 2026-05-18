import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { OrangeMoneyProvider } from './providers/orange-money.provider';
import { MtnMomoProvider } from './providers/mtn-momo.provider';
import { MockPaymentProvider } from './providers/mock.provider';

@Global()
@Module({
  imports:   [ConfigModule],
  providers: [PaymentService, OrangeMoneyProvider, MtnMomoProvider, MockPaymentProvider],
  exports:   [PaymentService],
})
export class PaymentModule {}