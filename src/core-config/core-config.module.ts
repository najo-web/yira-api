import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaCoreService } from './prisma-core.service';
import { CoreConfigService } from './core-config.service';
import { YiraConfigService } from './yira-config.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ttl: 3600,
        max: 500,
      }),
    }),
  ],
  providers: [PrismaCoreService, CoreConfigService, YiraConfigService],
  exports: [CoreConfigService, YiraConfigService, CacheModule],
})
export class CoreConfigModule {}