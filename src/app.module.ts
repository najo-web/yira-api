// ============================================================
// YIRA — src/app.module.ts  (Sprint 1)
// On ajoute les modules au fur et à mesure
// ============================================================
import { Module }         from '@nestjs/common';
import { ConfigModule }   from '@nestjs/config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    // ① Config — TOUJOURS EN PREMIER
    ConfigModule.forRoot({
      isGlobal: true,
      cache:    true,
    }),

    // ② Les 5 bases PostgreSQL isolées
    DatabaseModule,

    // La suite arrive sprint par sprint :
    // ③ RedisModule
    // ④ IaModule
    // ⑤ AuthModule
    // ...
  ],
})
export class AppModule {}