import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient as PrismaClientSync }        from '.prisma/client-sync';
import { PrismaClient as PrismaClientOrientation } from '.prisma/client-orientation';
import { PrismaClient as PrismaClientGame }        from '.prisma/client-game';
import { PrismaClient as PrismaClientEtude }       from '.prisma/client-etude';
import { PrismaClient as PrismaClientSos }         from '.prisma/client-sos';

export class PrismaSyncService extends PrismaClientSync implements OnModuleInit {
  private readonly logger = new Logger('PrismaSync');
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.get('DATABASE_URL_SYNC') } } });
  }
  async onModuleInit() { await this.$connect(); this.logger.log('base_sync connectee'); }
}

export class PrismaOrientationService extends PrismaClientOrientation implements OnModuleInit {
  private readonly logger = new Logger('PrismaOrientation');
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.get('DATABASE_URL_ORIENTATION') } } });
  }
  async onModuleInit() { await this.$connect(); this.logger.log('base_orientation connectee'); }
}

export class PrismaGameService extends PrismaClientGame implements OnModuleInit {
  private readonly logger = new Logger('PrismaGame');
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.get('DATABASE_URL_GAME') } } });
  }
  async onModuleInit() { await this.$connect(); this.logger.log('base_game connectee'); }
}

export class PrismaEtudeService extends PrismaClientEtude implements OnModuleInit {
  private readonly logger = new Logger('PrismaEtude');
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.get('DATABASE_URL_ETUDE') } } });
  }
  async onModuleInit() { await this.$connect(); this.logger.log('base_etude connectee'); }
}

export class PrismaSosService extends PrismaClientSos implements OnModuleInit {
  private readonly logger = new Logger('PrismaSos');
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.get('DATABASE_URL_SOS') } } });
  }
  async onModuleInit() { await this.$connect(); this.logger.log('base_sos connectee'); }
}

export const PRISMA_SYNC        = 'PRISMA_SYNC';
export const PRISMA_ORIENTATION = 'PRISMA_ORIENTATION';
export const PRISMA_GAME        = 'PRISMA_GAME';
export const PRISMA_ETUDE       = 'PRISMA_ETUDE';
export const PRISMA_SOS         = 'PRISMA_SOS';

@Global()
@Module({
  providers: [
    { provide: PRISMA_SYNC,        inject: [ConfigService], useFactory: (c: ConfigService) => new PrismaSyncService(c) },
    { provide: PRISMA_ORIENTATION, inject: [ConfigService], useFactory: (c: ConfigService) => new PrismaOrientationService(c) },
    { provide: PRISMA_GAME,        inject: [ConfigService], useFactory: (c: ConfigService) => new PrismaGameService(c) },
    { provide: PRISMA_ETUDE,       inject: [ConfigService], useFactory: (c: ConfigService) => new PrismaEtudeService(c) },
    { provide: PRISMA_SOS,         inject: [ConfigService], useFactory: (c: ConfigService) => new PrismaSosService(c) },
  ],
  exports: [PRISMA_SYNC, PRISMA_ORIENTATION, PRISMA_GAME, PRISMA_ETUDE, PRISMA_SOS],
})
export class DatabaseModule {}
