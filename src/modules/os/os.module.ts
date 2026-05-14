// ============================================================
// YIRA — src/modules/os/os.module.ts
// Sprint 11 — Module YIRA-OS avec injection Prisma
//
// CHANGEMENT Sprint 11 :
//   BepcService et BacService ont maintenant besoin du
//   PrismaOrientationService (token PRISMA_ORIENTATION).
//   DatabaseModule est Global → auto-injectable, pas besoin
//   de l'importer ici. L'injection se fait via @Inject().
// ============================================================

import { Module }        from '@nestjs/common';
import { OsController }  from './os.controller';
import { OsService }     from './os.service';
import { BepcService }   from './bepc.service';
import { BacService }    from './bac.service';
import { IaModule }      from '../../ia/ia.module';

@Module({
  imports: [IaModule],
  controllers: [OsController],
  providers: [OsService, BepcService, BacService],
  exports: [OsService, BepcService, BacService],
})
export class OsModule {}