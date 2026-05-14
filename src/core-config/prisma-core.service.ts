// =============================================================================
// YIRA V3.0 â€” PrismaCoreService
// Najo Technologies â€” CONFIDENTIEL
// Niveau 2 (N2) â€” Service transverse base_core
// L3 Â§3.1 : Connexion exclusive base_core â€” LECTURE SEULE pour modules mÃ©tier
// L3 Â§3.9 : Positionnement RLS via app.current_tenant sur chaque connexion
// =============================================================================

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '.prisma/client-core';

@Injectable()
export class PrismaCoreService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaCoreService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.getOrThrow<string>('DATABASE_URL_CORE'),
        },
      },
      // Log uniquement les erreurs et les requÃªtes lentes en production
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('PrismaCoreService connectÃ© Ã  base_core âœ…');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('PrismaCoreService dÃ©connectÃ© de base_core');
  }

  // ---------------------------------------------------------------------------
  // setTenantContext â€” Positionne les variables de session RLS
  // Ã€ appeler AVANT toute requÃªte dans une transaction.
  // L3 Â§3.9 : SET app.current_tenant = 'CI' sur chaque connexion.
  // ---------------------------------------------------------------------------
  async setTenantContext(
    tenantId: string,
    operatorId?: string,
    clientIp?: string,
  ): Promise<void> {
    await this.$executeRawUnsafe(
      `SET app.current_tenant = '${tenantId}'`,
    );

    if (operatorId) {
      await this.$executeRawUnsafe(
        `SET app.current_operator_id = '${operatorId}'`,
      );
    }

    if (clientIp) {
      await this.$executeRawUnsafe(
        `SET app.client_ip = '${clientIp}'`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // withTenant â€” ExÃ©cute un callback dans le contexte d'un tenant
  // Pattern sÃ©curisÃ© : le contexte est toujours positionnÃ© avant la requÃªte.
  // Usage : await prismaCore.withTenant('CI', () => prismaCore.iaPrompt.findMany())
  // ---------------------------------------------------------------------------
  async withTenant<T>(
    tenantId: string,
    callback: () => Promise<T>,
    operatorId?: string,
    clientIp?: string,
  ): Promise<T> {
    await this.setTenantContext(tenantId, operatorId, clientIp);
    return callback();
  }
}
