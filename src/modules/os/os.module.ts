// =============================================================================
// YIRA V3.0 — OsModule
// Sprint 51 — Ajout ConcoursEngine (Factory Pattern L3 §6.1)
// =============================================================================
import { Module }             from '@nestjs/common';
import { ConfigModule }       from '@nestjs/config';
import { OsController }       from './os.controller';
import { OsService }          from './os.service';
import { BepcService }        from './bepc.service';
import { BacService }         from './bac.service';
import { ConcoursService }    from './concours.service';
import { ConcoursController } from './concours.controller';
import { IaModule }           from '../../ia/ia.module';

@Module({
  imports:     [IaModule, ConfigModule],
  controllers: [OsController, ConcoursController],
  providers:   [OsService, BepcService, BacService, ConcoursService],
  exports:     [OsService, BepcService, BacService, ConcoursService],
})
export class OsModule {}