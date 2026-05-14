import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaCoreService } from './prisma-core.service';
import {
  CountryConfigDto, IaPromptDto, ScoringFormulaDto,
  VasServiceDto, ReferentialDto,
  CORE_CACHE_KEYS, CORE_CACHE_TTL,
} from './core-config.types';

@Injectable()
export class CoreConfigService {
  private readonly logger = new Logger(CoreConfigService.name);

  constructor(
    private readonly prismaCore: PrismaCoreService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getCountryConfig(tenantId: string): Promise<CountryConfigDto> {
    const cacheKey = CORE_CACHE_KEYS.countryConfig(tenantId);
    const cached = await this.cache.get<CountryConfigDto>(cacheKey);
    if (cached) return cached;

    const config = await this.prismaCore.withTenant(tenantId, () =>
      this.prismaCore.countryConfig.findFirst({
        where: { tenantId, status: 'ACTIVE', deletedAt: null },
      }),
    );
    if (!config) throw new NotFoundException(`Tenant '${tenantId}' introuvable`);

    const dto: CountryConfigDto = {
      id: config.id, tenantId: config.tenantId,
      countryName: config.countryName, ussdShortCode: config.ussdShortCode,
      currencyCode: config.currencyCode, currencyMinorUnits: config.currencyMinorUnits,
      vasPricing: config.vasPricing as any, mobileMoneyProviders: config.mobileMoneyProviders as any,
      smsSenderIds: config.smsSenderIds as any, telecomProviders: config.telecomProviders as any,
    };
    await this.cache.set(cacheKey, dto, CORE_CACHE_TTL.COUNTRY_CONFIG);
    return dto;
  }

  async getActivePrompt(tenantId: string, promptKey: string): Promise<IaPromptDto> {
    const cacheKey = CORE_CACHE_KEYS.iaPrompt(tenantId, promptKey);
    const cached = await this.cache.get<IaPromptDto>(cacheKey);
    if (cached) return cached;

    const prompt = await this.prismaCore.withTenant(tenantId, () =>
      this.prismaCore.iaPrompt.findFirst({
        where: { tenantId, promptKey, status: 'ACTIVE', deletedAt: null },
        orderBy: { version: 'desc' },
      }),
    );
    if (!prompt) throw new NotFoundException(`Prompt '${promptKey}' introuvable`);

    const dto: IaPromptDto = {
      id: prompt.id, tenantId: prompt.tenantId, promptKey: prompt.promptKey,
      moduleTarget: prompt.moduleTarget, agentName: prompt.agentName,
      promptSystem: prompt.promptSystem, promptUserTemplate: prompt.promptUserTemplate,
      guardrails: prompt.guardrails as any, cqciFilters: prompt.cqciFilters as any,
      version: prompt.version,
    };
    await this.cache.set(cacheKey, dto, CORE_CACHE_TTL.IA_PROMPT);
    return dto;
  }

  async getActiveScoringFormula(tenantId: string, formulaKey: string): Promise<ScoringFormulaDto> {
    const cacheKey = CORE_CACHE_KEYS.scoringFormula(tenantId, formulaKey);
    const cached = await this.cache.get<ScoringFormulaDto>(cacheKey);
    if (cached) return cached;

    const formula = await this.prismaCore.withTenant(tenantId, () =>
      this.prismaCore.scoringFormula.findFirst({
        where: { tenantId, formulaKey, status: 'ACTIVE', deletedAt: null },
        orderBy: { version: 'desc' },
      }),
    );
    if (!formula) throw new NotFoundException(`Formule '${formulaKey}' introuvable`);

    const dto: ScoringFormulaDto = {
      id: formula.id, tenantId: formula.tenantId, formulaKey: formula.formulaKey,
      engineTarget: formula.engineTarget, coefficients: formula.coefficients as Record<string, number>,
      thresholds: formula.thresholds as any, formulaExpression: formula.formulaExpression,
      version: formula.version,
    };
    await this.cache.set(cacheKey, dto, CORE_CACHE_TTL.SCORING_FORMULA);
    return dto;
  }

  async getVasService(tenantId: string, serviceCode: string): Promise<VasServiceDto> {
    const cacheKey = CORE_CACHE_KEYS.vasService(tenantId, serviceCode);
    const cached = await this.cache.get<VasServiceDto>(cacheKey);
    if (cached) return cached;

    const service = await this.prismaCore.withTenant(tenantId, () =>
      this.prismaCore.yiraConfigService.findFirst({
        where: { tenantId, serviceCode, status: 'ACTIVE', deletedAt: null },
      }),
    );
    if (!service) throw new NotFoundException(`Service VAS '${serviceCode}' introuvable`);

    const dto: VasServiceDto = {
      id: service.id, tenantId: service.tenantId, serviceCode: service.serviceCode,
      serviceName: service.serviceName, ussdPath: service.ussdPath, vasGroup: service.vasGroup,
      pricingByTenant: service.pricingByTenant as any, smsTemplates: service.smsTemplates as any,
      artciMetadata: service.artciMetadata as any,
      doubleOptinRequired: service.doubleOptinRequired, isFreemium: service.isFreemium,
    };
    await this.cache.set(cacheKey, dto, CORE_CACHE_TTL.VAS_SERVICE);
    return dto;
  }

  async getVasPrice(tenantId: string, serviceCode: string): Promise<number> {
    const service = await this.getVasService(tenantId, serviceCode);
    const pricing = service.pricingByTenant;
    return pricing[tenantId]?.daily_fcfa ?? pricing['default']?.daily_fcfa ?? 0;
  }

  async getVasSmsTemplate(tenantId: string, serviceCode: string, templateKey: string): Promise<string> {
    const service = await this.getVasService(tenantId, serviceCode);
    const template = service.smsTemplates[templateKey];
    if (!template) throw new NotFoundException(`Template SMS '${templateKey}' introuvable`);
    return template;
  }

  async getReferentials(tenantId: string, refType: string): Promise<ReferentialDto[]> {
    const cacheKey = CORE_CACHE_KEYS.referentials(tenantId, refType);
    const cached = await this.cache.get<ReferentialDto[]>(cacheKey);
    if (cached) return cached;

    const refs = await this.prismaCore.withTenant(tenantId, () =>
      this.prismaCore.referential.findMany({
        where: { tenantId, refType: refType as any, status: 'ACTIVE', deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
    );

    const dtos: ReferentialDto[] = refs.map((r) => ({
      id: r.id, tenantId: r.tenantId, refType: r.refType, refCode: r.refCode,
      labelFr: r.labelFr, labelLocal: r.labelLocal,
      metadata: r.metadata as Record<string, unknown>,
      sortOrder: r.sortOrder, parentId: r.parentId,
    }));
    await this.cache.set(cacheKey, dtos, CORE_CACHE_TTL.REFERENTIALS);
    return dtos;
  }

  async invalidateTenantCache(tenantId: string): Promise<void> {
    await this.cache.del(CORE_CACHE_KEYS.countryConfig(tenantId));
    this.logger.log(`Cache invalide pour tenant '${tenantId}'`);
  }

  async invalidatePromptCache(tenantId: string, promptKey: string): Promise<void> {
    await this.cache.del(CORE_CACHE_KEYS.iaPrompt(tenantId, promptKey));
  }

  applyPromptTemplate(template: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce(
      (result, [key, value]) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
      template,
    );
  }
}