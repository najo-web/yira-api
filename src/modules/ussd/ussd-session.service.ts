// =============================================================================
// YIRA V3.0 — UssdSessionService
// Niveau 2 (N2) — Gestion sessions USSD Redis + Code de Reprise L2 §3.2
// TTL session : 3 minutes (3GPP TS 22.090)
// TTL code reprise : 30 jours (L2 §3.2)
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface UssdSession {
  telephone:  string;
  tenant_id:  string;
  etape:      string;
  qNum:       number;
  reponses:   number[];
  data:       Record<string, any>;
  createdAt:  number;
}

@Injectable()
export class UssdSessionService implements OnModuleInit {
  private readonly logger     = new Logger(UssdSessionService.name);
  private redis!:              Redis;
  private readonly TTL_SECONDS         = 180;           // 3 minutes session USSD
  private readonly TTL_REPRISE_SECONDS = 30 * 24 * 3600; // 30 jours code reprise

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.redis = new Redis(this.config.getOrThrow<string>('REDIS_URL'));
    this.redis.on('connect', () => this.logger.log('UssdSessionService connecte a Redis'));
    this.redis.on('error',   (e) => this.logger.error('Redis erreur: ' + e.message));
  }

  // ---------------------------------------------------------------------------
  // SESSIONS USSD
  // ---------------------------------------------------------------------------
  private key(sessionId: string): string {
    return 'ussd:session:' + sessionId;
  }

  async get(sessionId: string): Promise<UssdSession | null> {
    const raw = await this.redis.get(this.key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as UssdSession;
  }

  async set(sessionId: string, session: UssdSession): Promise<void> {
    await this.redis.set(
      this.key(sessionId),
      JSON.stringify(session),
      'EX',
      this.TTL_SECONDS,
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }

  async ttl(sessionId: string): Promise<number> {
    return this.redis.ttl(this.key(sessionId));
  }

  // ---------------------------------------------------------------------------
  // CODE DE REPRISE — L2 §3.2
  // Stocké Redis 30 jours — permet de reprendre sur n'importe quel canal
  // ---------------------------------------------------------------------------
  async setReprise(telephone: string, code: string): Promise<void> {
    await this.redis.set(
      'ussd:reprise:' + telephone,
      code,
      'EX',
      this.TTL_REPRISE_SECONDS,
    );
  }

  async getReprise(telephone: string): Promise<string | null> {
    return this.redis.get('ussd:reprise:' + telephone);
  }

  async validerReprise(telephone: string, code: string): Promise<boolean> {
    const stored = await this.getReprise(telephone);
    return stored === code;
  }
}