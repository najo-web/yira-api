// ============================================================
// YIRA — src/app.module.ts  (Sprint 4B — AssessmentModule)
// ============================================================
import { Module }               from '@nestjs/common';
import { ConfigModule }         from '@nestjs/config';
import { DatabaseModule }       from './database/database.module';
import { AuthModule }           from './auth/auth.module';
import { IaModule }             from './ia/ia.module';
import { OsModule }             from './modules/os/os.module';
import { AssessmentModule }     from './modules/assessment/assessment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    IaModule,
    AuthModule,
    OsModule,
    AssessmentModule,  // ← Sprint 4B
  ],
})
export class AppModule {}