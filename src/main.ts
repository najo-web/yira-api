// =============================================================================
// YIRA V3.0 — main.ts
// Bootstrap NestJS + Swagger OpenAPI 3.1 (L3 §8.1)
// Documentation : http://localhost:3000/api/docs
// =============================================================================
import { NestFactory }     from '@nestjs/core';
import { ValidationPipe }  from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule }       from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validation globale des DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Prefix API global
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({ origin: '*' });

  // ── Swagger OpenAPI 3.1 (L3 §8.1) ─────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('YIRA API V3.0')
    .setDescription(`
## Plateforme Nationale d'Orientation et d'Insertion — Najo Technologies CI

**Agrément ARTCI N°57/SVA/3/24**

### Architecture
- 9 bases PostgreSQL isolées (base_core, base_sync, base_orientation, base_game, base_etude, base_sos, base_cqci, base_sara, base_signer)
- Multi-tenant CEDEAO (CI, SN, BF, ML...)
- Row-Level Security (RLS) par pays
- Zéro Hardcode — tout piloté depuis base_core

### Modules
| Module | Description |
|--------|-------------|
| USSD | Moteur USSD *7572# + Quiz Orientation |
| Assessment | RIASEC + Big Five OCEAN + Valeurs + SCG |
| OS | Orientation Scolaire BEPC + BAC |
| OP | Orientation Professionnelle + NIE |
| VAS | 37 services à valeur ajoutée |
| SARA | Wallet Mobile Money + Score |
| Signer | Carnet épargne + Crédit bancaire |
| SOS | Protection sociale urgente |
| Command | Dashboard YIRA-COMMAND + KPIs ARTCI |

### Conformité
- ARTCI : double opt-in, STOP < 5s, journal 30j
- RGPD / Loi 2013-450 CI
- ISO 10667:2020 (psychométrie)
    `)
    .setVersion('3.0')
    .setContact('Najo Technologies', 'https://yira.africa', 'izyworkinfo@gmail.com')
    .setLicense('Confidentiel — NDA requis', '')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token JWT YIRA' },
      'JWT',
    )
    .addTag('USSD',        'Moteur USSD *7572# — Sessions et menus')
    .addTag('Assessment',  'Évaluation psychométrique RIASEC + Big Five')
    .addTag('Auth',        'Authentification OTP + JWT')
    .addTag('OS',          'Orientation Scolaire BEPC + BAC + DOB')
    .addTag('OP',          'Orientation Professionnelle NIE')
    .addTag('VAS',         'Services VAS — Abonnements + Facturation')
    .addTag('Telecom',     'SMS + Airtime — AfricasTalking + LAM')
    .addTag('SARA',        'Wallet Mobile Money + SARA Score')
    .addTag('Signer',      'Carnet épargne + Crédit bancaire')
    .addTag('Command',     'Dashboard YIRA-COMMAND + KPIs ARTCI')
    .addTag('IA',          'Agents IA inculturés — Vieux Père + Quiz')
    .addTag('Quiz',        'Génération questions VAS — 24 agents')
    .addTag('Moderation',  'Validation questions + Push SMS')
    .addTag('Assessment',  'Instruments psychométriques')
    .addTag('Freemium',    'Gestion sessions gratuites')
    .addTag('Health',      'Santé et monitoring')
    .addServer('http://localhost:3000', 'Local DEV')
    .addServer('https://gem-shortness-operate.ngrok-free.dev', 'ngrok Public')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter:           'alpha',
      operationsSorter:     'alpha',
      docExpansion:         'none',
      filter:               true,
      showRequestDuration:  true,
    },
    customSiteTitle: 'YIRA API V3.0 — Docs',
    customfavIcon:   'https://yira.africa/favicon.ico',
    customCss: `
      .swagger-ui .topbar { background: #1a472a; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #1a472a; }
    `,
  });

  // ── Démarrage ──────────────────────────────────────────────────────────────
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log('🚀 YIRA API démarrée sur http://localhost:' + port + '/api');
  console.log('📚 Swagger docs  : http://localhost:' + port + '/api/docs');
  console.log('🌍 Multi-tenant  : CI | SN | BF | ML');
}
bootstrap();