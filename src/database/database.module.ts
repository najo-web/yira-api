// ============================================================
// YIRA — src/database/database.module.ts
// 5 clients Prisma — un par base PostgreSQL
// RÈGLE : jamais de jointure cross-base
// ============================================================
import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService }                         from '@nestjs/config';
import { PrismaClient }                          from '@prisma/client';

// ── 5 Services Prisma isolés ─────────────────────────────────

export class PrismaSyncService
  extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('PrismaSync');
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.get('DATABASE_SYNC_URL') } } });
  }
  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ base_sync connectée');
  }
}

export class PrismaOrientationService
  extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('PrismaOrientation');
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.get('DATABASE_ORIENTATION_URL') } } });
  }
  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ base_orientation connectée');
  }
}

export class PrismaGameService
  extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('PrismaGame');
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.get('DATABASE_GAME_URL') } } });
  }
  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ base_game connectée');
  }
}

export class PrismaEtudeService
  extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('PrismaEtude');
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.get('DATABASE_ETUDE_URL') } } });
  }
  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ base_etude connectée');
  }
}

export class PrismaSosService
  extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('PrismaSos');
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.get('DATABASE_SOS_URL') } } });
  }
  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ base_sos connectée (SOS_ADMIN uniquement)');
  }
}

// ── Tokens d'injection ────────────────────────────────────────
export const PRISMA_SYNC        = 'PRISMA_SYNC';
export const PRISMA_ORIENTATION = 'PRISMA_ORIENTATION';
export const PRISMA_GAME        = 'PRISMA_GAME';
export const PRISMA_ETUDE       = 'PRISMA_ETUDE';
export const PRISMA_SOS         = 'PRISMA_SOS';

// ── Module Global ─────────────────────────────────────────────
@Global()
@Module({
  providers: [
    {
      provide:    PRISMA_SYNC,
      inject:     [ConfigService],
      useFactory: (c: ConfigService) => new PrismaSyncService(c),
    },
    {
      provide:    PRISMA_ORIENTATION,
      inject:     [ConfigService],
      useFactory: (c: ConfigService) => new PrismaOrientationService(c),
    },
    {
      provide:    PRISMA_GAME,
      inject:     [ConfigService],
      useFactory: (c: ConfigService) => new PrismaGameService(c),
    },
    {
      provide:    PRISMA_ETUDE,
      inject:     [ConfigService],
      useFactory: (c: ConfigService) => new PrismaEtudeService(c),
    },
    {
      provide:    PRISMA_SOS,
      inject:     [ConfigService],
      useFactory: (c: ConfigService) => new PrismaSosService(c),
    },
  ],
  exports: [
    PRISMA_SYNC, PRISMA_ORIENTATION,
    PRISMA_GAME, PRISMA_ETUDE, PRISMA_SOS,
  ],
})
export class DatabaseModule {}