// =============================================================================
// YIRA V3.0 — ContentSourceService
// Sprint 33 — Scraping réel des CSP (L3 §7.1)
// Fix final: regex simples sans CDATA + debug titre
// =============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';

export interface FaitCSP {
  titre:   string;
  resume:  string;
  source:  string;
  date:    string;
  url:     string;
}

export interface SourceCSP {
  url:      string;
  type:     'RSS' | 'API';
  actif:    boolean;
  priorite: number;
}

@Injectable()
export class ContentSourceService implements OnModuleInit {
  private readonly logger = new Logger(ContentSourceService.name);
  private poolCore!: Pool;
  private ready = false;
  private cache: Map<string, { faits: FaitCSP[]; expiry: number }> = new Map();
  private readonly CACHE_TTL = 6 * 3600 * 1000;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    try {
      this.poolCore = new Pool({ connectionString: this.config.get('DATABASE_URL_CORE') });
      const c       = await this.poolCore.connect();
      c.release();
      this.ready = true;
      this.logger.log('[CSP] ContentSourceService connecte a base_core');
    } catch (e: any) {
      this.logger.warn('[CSP] Erreur init: ' + e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // OBTENIR FAITS DU JOUR
  // ---------------------------------------------------------------------------
  async obtenirFaits(serviceCode: string, tenantId = 'CI', maxFaits = 3): Promise<FaitCSP[]> {
    const cacheKey = tenantId + ':' + serviceCode;
    const cached   = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      this.logger.log('[CSP] Cache hit → ' + serviceCode);
      return cached.faits.slice(0, maxFaits);
    }

    const sources = await this.chargerSources(serviceCode, tenantId);
    if (sources.length === 0) {
      this.logger.warn('[CSP] Aucune source pour ' + serviceCode);
      return [];
    }

    const faits: FaitCSP[] = [];
    for (const source of sources.filter(s => s.actif).sort((a, b) => a.priorite - b.priorite)) {
      try {
        const nouveaux = source.type === 'RSS'
          ? await this.scraperRSS(source.url)
          : await this.scraperAPI(source.url);
        faits.push(...nouveaux);
        if (faits.length >= maxFaits * 2) break;
      } catch (e: any) {
        this.logger.warn('[CSP] Erreur scraping ' + source.url + ': ' + e.message);
      }
    }

    this.cache.set(cacheKey, { faits, expiry: Date.now() + this.CACHE_TTL });
    this.logger.log('[CSP] ' + faits.length + ' faits charges pour ' + serviceCode);
    return faits.slice(0, maxFaits);
  }

  // ---------------------------------------------------------------------------
  // SCRAPER RSS
  // ---------------------------------------------------------------------------
  private async scraperRSS(url: string): Promise<FaitCSP[]> {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, {
        signal:  controller.signal,
        headers: {
          'User-Agent':      'Mozilla/5.0 (compatible; YIRA-Bot/3.0)',
          'Accept':          'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'Accept-Encoding': 'identity',
          'Cache-Control':   'no-cache',
        },
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const xml = await response.text();
      this.logger.log('[CSP] RSS fetch: ' + url.slice(0, 60) + ' | len: ' + xml.length);

      const faits = this.parseRSS(xml, url);
      this.logger.log('[CSP] RSS parsed: ' + url.slice(0, 60) + ' → ' + faits.length + ' faits');
      return faits;
    } catch (e: any) {
      clearTimeout(timeout);
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // PARSER RSS — Regex simples sans CDATA
  // ---------------------------------------------------------------------------
  private parseRSS(xml: string, sourceUrl: string): FaitCSP[] {
    const faits: FaitCSP[] = [];

    // RSS 2.0 — extraire tous les <item>
    const itemMatches = Array.from(xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi));
    this.logger.log('[CSP] Items trouves: ' + itemMatches.length);

    for (const match of itemMatches.slice(0, 10)) {
      const item = match[1];

      // Regex simples — RFI/BBC n'utilisent pas CDATA
      const tM = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const dM = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)
              || item.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
      const lM = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      const pM = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
              || item.match(/<published[^>]*>([\s\S]*?)<\/published>/i);

      const titre = (tM?.[1] ?? '').trim();
      const desc  = (dM?.[1] ?? '').trim();
      const lien  = (lM?.[1] ?? '').trim();
      const date  = (pM?.[1] ?? '').trim();

      this.logger.log('[CSP] Titre extrait: ' + titre.slice(0, 60));

      if (titre.length > 3) {
        faits.push({
          titre:  this.nettoyerTexte(titre).slice(0, 200),
          resume: this.nettoyerTexte(desc).slice(0, 400),
          source: this.extraireDomain(sourceUrl),
          date:   this.parseDate(date),
          url:    lien || sourceUrl,
        });
      }
    }

    // Fallback Atom <entry>
    if (faits.length === 0) {
      const entryMatches = Array.from(xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi));
      for (const match of entryMatches.slice(0, 10)) {
        const item  = match[1];
        const tM    = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const dM    = item.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)
                   || item.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
        const lM    = item.match(/href="([^"]+)"/i);
        const pM    = item.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
                   || item.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);

        const titre = (tM?.[1] ?? '').trim();
        const desc  = (dM?.[1] ?? '').trim();
        const lien  = (lM?.[1] ?? '').trim();
        const date  = (pM?.[1] ?? '').trim();

        if (titre.length > 3) {
          faits.push({
            titre:  this.nettoyerTexte(titre).slice(0, 200),
            resume: this.nettoyerTexte(desc).slice(0, 400),
            source: this.extraireDomain(sourceUrl),
            date:   this.parseDate(date),
            url:    lien || sourceUrl,
          });
        }
      }
    }

    return faits;
  }

  // ---------------------------------------------------------------------------
  // SCRAPER API JSON
  // ---------------------------------------------------------------------------
  private async scraperAPI(url: string): Promise<FaitCSP[]> {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        signal:  controller.signal,
        headers: {
          'User-Agent':      'YIRA-Bot/3.0',
          'Accept':          'application/json',
          'Accept-Encoding': 'identity',
        },
      });
      clearTimeout(timeout);
      const data  = await response.json();
      const items = Array.isArray(data)
        ? data
        : data.articles ?? data.items ?? data.results ?? [];

      return items.slice(0, 10).map((item: any) => ({
        titre:  this.nettoyerTexte(item.title  ?? item.titre   ?? '').slice(0, 200),
        resume: this.nettoyerTexte(item.description ?? item.resume ?? item.content ?? '').slice(0, 400),
        source: this.extraireDomain(url),
        date:   this.parseDate(item.publishedAt ?? item.date),
        url:    item.url ?? item.lien ?? url,
      })).filter((f: FaitCSP) => f.titre.length > 3);
    } catch (e: any) {
      clearTimeout(timeout);
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // CONSTRUIRE CONTEXTE POUR PROMPT IA
  // ---------------------------------------------------------------------------
  async construireContexteIA(serviceCode: string, tenantId = 'CI'): Promise<string> {
    const faits = await this.obtenirFaits(serviceCode, tenantId, 3);
    if (faits.length === 0) return '';

    let contexte = 'FAITS DU JOUR (' + new Date().toLocaleDateString('fr-FR') + ') — Sources autorisees:\n\n';
    faits.forEach((f, i) => {
      contexte += (i + 1) + '. [' + f.source + '] ' + f.titre + '\n';
      if (f.resume) contexte += '   → ' + f.resume.slice(0, 150) + '\n';
      contexte += '\n';
    });
    contexte += 'INSTRUCTION: Genere une question quiz basee sur un de ces faits reels. ';
    contexte += 'La question doit etre verifiable et ancree dans l\'actualite.\n';
    return contexte;
  }

  // ---------------------------------------------------------------------------
  // INVALIDER CACHE
  // ---------------------------------------------------------------------------
  invaliderCache(serviceCode?: string, tenantId = 'CI'): void {
    if (serviceCode) {
      this.cache.delete(tenantId + ':' + serviceCode);
    } else {
      this.cache.clear();
    }
    this.logger.log('[CSP] Cache invalide' + (serviceCode ? ' pour ' + serviceCode : ' global'));
  }

  // ---------------------------------------------------------------------------
  // CHARGER SOURCES
  // ---------------------------------------------------------------------------
  private async chargerSources(serviceCode: string, tenantId: string): Promise<SourceCSP[]> {
    if (!this.ready) return [];
    let client: PoolClient | null = null;
    try {
      client = await this.poolCore.connect();
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);
      await client.query(`SET LOCAL app.current_operator_role = 'SUPER_ADMIN'`);
      await client.query(`SET LOCAL app.client_ip = '127.0.0.1'`);

      const res = await client.query(`
        SELECT content_sources
        FROM core.yira_config_service
        WHERE service_code = $1
          AND tenant_id    = $2
          AND status       = 'ACTIVE'
          AND deleted_at IS NULL
        LIMIT 1
      `, [serviceCode, tenantId]);

      await client.query('COMMIT');
      const sources = res.rows[0]?.content_sources;
      if (!sources || !Array.isArray(sources)) return [];
      return sources as SourceCSP[];
    } catch (e: any) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      this.logger.warn('[CSP] Erreur chargement sources: ' + e.message);
      return [];
    } finally {
      if (client) client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // UTILITAIRES
  // ---------------------------------------------------------------------------
  private extraireDomain(url: string): string {
    try { return new URL(url).hostname; } catch { return url; }
  }

  private parseDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    try { return new Date(dateStr).toISOString().split('T')[0]; }
    catch { return new Date().toISOString().split('T')[0]; }
  }

  private nettoyerTexte(texte: string): string {
    return texte
      .replace(/<[^>]+>/g,  '')
      .replace(/&amp;/g,    '&')
      .replace(/&lt;/g,     '<')
      .replace(/&gt;/g,     '>')
      .replace(/&quot;/g,   '"')
      .replace(/&#39;/g,    "'")
      .replace(/&nbsp;/g,   ' ')
      .replace(/\s+/g,      ' ')
      .trim();
  }

  isReady(): boolean { return this.ready; }
}