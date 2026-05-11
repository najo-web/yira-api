// ============================================================
// YIRA — src/app.module.ts  (Sprint 8B — Freemium ajouté)
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
import { FreemiumModule }   from './modules/freemium/freemium.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    IaModule,
    FreemiumModule,   // ← Global — disponible partout
    AuthModule,
    OsModule,
    OpModule,
    AssessmentModule,
    UssdModule,
  ],
})
export class AppModule {}