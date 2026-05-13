// ============================================================
// YIRA — src/modules/os/os.module.ts
// Sprint 10 — Module YIRA-OS complet (BEPC + BAC)
// Remplace l'ancien os.module.ts
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
