// ============================================================
// YIRA — src/app.module.ts  (Sprint 8 — OpModule ajouté)
// ============================================================
import { Module }           from '@nestjs/common';
import { ConfigModule }     from '@nestjs/config';
import { DatabaseModule }   from './database/database.module';
import { AuthModule }       from './auth/auth.module';
import { IaModule }         from './ia/ia.module';
import { OsModule }         from './modules/os/os.module';
import { OpModule }         from './modules/op/op.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { UssdModule }       from './modules/ussd/ussd.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    IaModule,
    AuthModule,
    OsModule,
    OpModule,         // ← Sprint 8
    AssessmentModule,
    UssdModule,
  ],
})
export class AppModule {}