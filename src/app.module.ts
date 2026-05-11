// ============================================================
// YIRA — src/app.module.ts  (Sprint 5 — USSD ajouté)
// ============================================================
import { Module }               from '@nestjs/common';
import { ConfigModule }         from '@nestjs/config';
import { DatabaseModule }       from './database/database.module';
import { AuthModule }           from './auth/auth.module';
import { IaModule }             from './ia/ia.module';
import { OsModule }             from './modules/os/os.module';
import { AssessmentModule }     from './modules/assessment/assessment.module';
import { UssdModule }           from './modules/ussd/ussd.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    IaModule,
    AuthModule,
    OsModule,
    AssessmentModule,
    UssdModule,   // ← Sprint 5
  ],
})
export class AppModule {}