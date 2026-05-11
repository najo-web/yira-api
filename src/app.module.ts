// ============================================================
// YIRA — src/app.module.ts  (Sprint 2 — Auth ajouté)
// ============================================================
import { Module }         from '@nestjs/common';
import { ConfigModule }   from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule }     from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DatabaseModule,
    AuthModule,   // ← nouveau Sprint 2
  ],
})
export class AppModule {}