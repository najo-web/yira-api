// ============================================================
// YIRA — src/modules/op/op.module.ts
// ============================================================
import { Module }      from '@nestjs/common';
import { OpService }   from './op.service';
import { OpController } from './op.controller';

@Module({
  controllers: [OpController],
  providers:   [OpService],
  exports:     [OpService],
})
export class OpModule {}