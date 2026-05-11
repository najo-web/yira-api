// ============================================================
// YIRA — src/modules/os/os.module.ts
// ============================================================
import { Module }      from '@nestjs/common';
import { OsService }   from './os.service';
import { OsController } from './os.controller';

@Module({
  controllers: [OsController],
  providers:   [OsService],
  exports:     [OsService],
})
export class OsModule {}