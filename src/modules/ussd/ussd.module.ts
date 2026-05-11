// ============================================================
// YIRA — src/modules/ussd/ussd.module.ts
// ============================================================
import { Module }         from '@nestjs/common';
import { UssdService }    from './ussd.service';
import { UssdController } from './ussd.controller';
import { OsModule }       from '../os/os.module';

@Module({
  imports:     [OsModule],
  controllers: [UssdController],
  providers:   [UssdService],
  exports:     [UssdService],
})
export class UssdModule {}