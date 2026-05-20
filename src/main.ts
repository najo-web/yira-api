// =============================================================================
// YIRA V3.0 — main.ts
// Sprint 54 — Swagger complet OpenAPI 3.0 (L3 §8.1)
// Documentation : https://api.yira.africa/api/docs
// =============================================================================
import { NestFactory }                    from '@nestjs/core';
import { ValidationPipe }                 from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule }                      from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: '*' });

  // ── Swagger OpenAPI 3.0 (L3 §8.1) ─────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('YIRA API V3.0')
    .setDescription(`
## Plateforme Nationale d'Orientation et d'Insertion — Najo Technologies CI

> **Agrément ARTCI N°57/SVA/3/24** | **ISO 10667:2020** | **RGPD / Loi CI 2013-450**

### Vision
YIRA est une infrastructure nationale d'orientation scolaire et professionnelle, accessible depuis tout terminal mobile (smartphone ou Nokia basique via USSD), couvrant les 14 districts de Côte d'Ivoire et extensible à 18 pays CEDEAO.

### Architecture technique (L3)
- **9 bases PostgreSQL isolées** — base_core, base_sync, base_orientation, base_game, base_etude, base_sos, base_cqci, base_sara, base_signer
- **Multi-tenant CEDEAO** — CI, SN, BF, ML isolés par Row-Level Security (RLS)
- **Zero Hardcode** — tout paramètre métier piloté depuis base_core.yira_config_service
- **31 agents IA éditoriaux** — inculturés CI, quota CRON 05h00 quotidien
- **8 providers psychométriques** — Sigmund SOAP V3.4 + YIRA interne (RIASEC/BigFive/Valeurs)

### Modules disponibles (25 endpoints)

| Module | Route | Description |
|--------|-------|-------------|
| **Auth** | /api/auth | OTP SMS + JWT multi-tenant — 8 rôles RBAC |
| **USSD** | /api/ussd | Moteur *7572# — 5 portes + RIASEC 10Q |
| **Assessment** | /api/assessment | BigFive 40Q + Valeurs 42Q + Aptitudes + SCG |
| **OS** | /api/os | Orientation BEPC + BAC + Simulation DOB MENET |
| **OP** | /api/op | NIE + CV IA + Lettre motivation |
| **Job** | /api/job | Matching emploi + Coaching entretien + J+365 |
| **Concours** | /api/concours | 7 concours CI — éligibilité + plan 90j |
| **Eval** | /api/eval | Bilan 360° B2G/B2B — ISO 10667 |
| **PsyP** | /api/psyp | Multi-providers psychométriques |
| **Quiz** | /api/quiz | 37 services VAS — génération questions IA |
| **Agents** | /api/agents | 31 agents IA — dashboard + monitoring |
| **VAS** | /api/vas | Abonnements + facturation ARTCI |
| **Passeport** | /api/passeport | Passeport Compétences 700 FCFA + PDF |
| **RESCUE** | /api/rescue | Coaching 30j si Trust Index < 0.6 |
| **SOS** | /api/sos | Urgence AES-256-CBC — RGPD strict |
| **Pack Parents** | /api/pack-parents | 1000 FCFA/mois — 10 SMS alertes |
| **CQCI** | /api/cqci | Intelligence Culturelle CI — UFHB/CIRES |
| **Antifraude** | /api/antifraude | Trust Index — Triangle de Vérité |
| **Sara** | /api/sara | Wallet Mobile Money + Score Sara |
| **Signer** | /api/signer | Épargne + Crédit bancaire |
| **Etude** | /api/etude | ONC-CI — KPIs PND/ODD ministères |
| **Veille** | /api/veille | Veille marché emploi CI |
| **Freemium** | /api/freemium | 3 sessions gratuites/semaine |
| **Telecom** | /api/telecom | SMS + USSD — Africa's Talking + LAM |
| **Command** | /api/command | Dashboard YIRA-COMMAND + KPIs ARTCI |
| **Observability** | /api/observability | Métriques + Health check |

### Authentification
Tous les endpoints protégés nécessitent un Bearer JWT obtenu via \`POST /api/auth/otp/verifier\`.

### Conformité ARTCI
- Double opt-in obligatoire avant tout débit VAS
- STOP service effectif < 5 secondes
- Journal des prélèvements 30 jours minimum
- Tarif affiché avant confirmation

### Contact
**Najo Technologies CI** — contact@najotechnologies.com — https://yira.africa
    `)
    .setVersion('3.0')
    .setContact('Najo Technologies CI', 'https://yira.africa', 'contact@najotechnologies.com')
    .setLicense('Confidentiel — NDA requis pour diffusion', 'https://yira.africa/nda')
    .addBearerAuth(
      {
        type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
        description: 'Token JWT YIRA — obtenir via POST /api/auth/otp/verifier',
        name: 'Authorization', in: 'header',
      },
      'JWT',
    )
    // ── Tags organisés par domaine ────────────────────────────────────────────
    .addTag('Auth',             '🔐 Authentification OTP SMS + JWT multi-tenant')
    .addTag('USSD',             '📱 Moteur USSD *7572# — Sessions et menus Nokia')
    .addTag('Orientation Scolaire', '🎓 BEPC + BAC + Simulation DOB MENET')
    .addTag('OP — Orientation Pro',  '💼 NIE + CV IA + Lettre motivation CI')
    .addTag('OP — EvalEngine B2G/B2B', '📊 Bilan 360° cadres — ISO 10667')
    .addTag('OP — JobEngine',   '🔍 Matching emploi + Coaching entretien + J+365')
    .addTag('OP — ConcoursEngine', '🏆 7 concours CI — INFAS/ENS/ENA/Police/Douane')
    .addTag('PsyP',             '🧠 Multi-providers psychométriques RIASEC+BigFive+Sigmund')
    .addTag('Assessment',       '📋 BigFive 40Q + Valeurs 42Q + Aptitudes + SCG')
    .addTag('Quiz — Agent Manager', '🤖 31 agents IA éditoriaux — dashboard YIRA-COMMAND')
    .addTag('Quiz',             '🎯 37 services VAS — génération questions IA inculturées CI')
    .addTag('VAS',              '💰 Abonnements ARTCI + Facturation quotidienne')
    .addTag('Passeport',        '🪪 Passeport Compétences 700 FCFA + PDF certifié')
    .addTag('RESCUE',           '🤝 Coaching 30j — Vieux Père / Grande Sœur')
    .addTag('SOS',              '🆘 Urgence psychologique — AES-256-CBC')
    .addTag('Pack Parents',     '👨‍👩‍👧 1000 FCFA/mois — 10 SMS alertes + QR rapport')
    .addTag('CQ-CI',            '🌍 Intelligence Culturelle CI — UFHB/CIRES N=2847')
    .addTag('Antifraude',       '🛡️ Trust Index — Triangle de Vérité 3 sommets')
    .addTag('Sara',             '💳 Wallet Mobile Money + Score Sara')
    .addTag('Signer',           '🏦 Épargne + Crédit bancaire micro-finance CI')
    .addTag('ONC-CI',           '📈 Observatoire National Compétences — KPIs PND/ODD')
    .addTag('Veille',           '🔭 Veille marché emploi CI')
    .addTag('Freemium',         '🆓 3 sessions gratuites/semaine + consentement')
    .addTag('Telecom',          '📡 SMS + USSD — Africa\'s Talking + L\'Africa Mobile')
    .addTag('YIRA-COMMAND',     '⚙️ Dashboard opérateur + KPIs ARTCI + Config Zero Hardcode')
    .addTag('Observability',    '📊 Health check + Métriques Prometheus')
    .addTag('Ia',               '🧬 Moteur IA — Gemini/Claude inculturation CI')
    .addTag('Moderation',       '✅ Validation questions + Push SMS abonnés')
    // ── Serveurs ──────────────────────────────────────────────────────────────
    .addServer('https://api.yira.africa', '🌍 Production OVH — Côte d\'Ivoire')
    .addServer('http://localhost:3000',   '💻 Local DEV')
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
      tryItOutEnabled:      true,
    },
    customSiteTitle: 'YIRA API V3.0 — Documentation Officielle',
    customfavIcon:   'https://yira.africa/favicon.ico',
    customCss: `
      .swagger-ui .topbar { background: #1F3864; padding: 10px 0; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #1F3864; font-size: 2em; }
      .swagger-ui .info .description { font-size: 14px; }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px; border-radius: 4px; }
      .swagger-ui .opblock-tag { font-size: 16px; font-weight: bold; }
      .swagger-ui .opblock.opblock-get { border-color: #1E8449; }
      .swagger-ui .opblock.opblock-post { border-color: #E67E22; }
      .swagger-ui .opblock.opblock-delete { border-color: #C0392B; }
      .swagger-ui .btn.authorize { background: #1F3864; border-color: #1F3864; color: white; }
      .swagger-ui .btn.authorize svg { fill: white; }
      .swagger-ui .info { margin: 20px 0; }
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