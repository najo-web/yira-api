// ============================================================
// YIRA — src/main.ts
// ============================================================
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validation globale des DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Prefix API global
  app.setGlobalPrefix('api');

  // CORS (pour le frontend Next.js)
  app.enableCors({ origin: 'http://localhost:3001' });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 YIRA API démarrée sur http://localhost:${port}/api`);
}
bootstrap();