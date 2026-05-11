// ============================================================
// YIRA — src/app.module.ts  (Sprint 3 — IaModule ajouté)
// ============================================================
import { Module }         from '@nestjs/common';
import { ConfigModule }   from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule }     from './auth/auth.module';
import { IaModule }       from './ia/ia.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,   // ② 5 bases PostgreSQL
    IaModule,         // ③ Gemini + Claude
    AuthModule,       // ④ JWT + OTP
  ],
})
export class AppModule {}