import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelecomService } from './telecom.service';
import { AfricasTalkingProvider } from './providers/africas-talking.provider';

@Global()
@Module({
  imports:   [ConfigModule],
  providers: [AfricasTalkingProvider, TelecomService],
  exports:   [TelecomService],
})
export class TelecomModule {}