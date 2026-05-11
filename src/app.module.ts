// ============================================================
// YIRA — src/app.module.ts  (Sprint 4A — OsModule ajouté)
// ============================================================
import { Module }         from '@nestjs/common';
import { ConfigModule }   from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule }     from './auth/auth.module';
import { IaModule }       from './ia/ia.module';
import { OsModule }       from './modules/os/os.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,   // ② 5 bases PostgreSQL
    IaModule,         // ③ Gemini + Claude
    AuthModule,       // ④ JWT + OTP
    OsModule,         // ⑤ Orientation Scolaire ← nouveau
  ],
})
export class AppModule {}