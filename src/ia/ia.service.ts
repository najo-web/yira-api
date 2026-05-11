// ============================================================
// YIRA — src/ia/ia.service.ts  (fix modèle Gemini 2.5)
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic              from '@anthropic-ai/sdk';

export interface IaInput {
  module:    string;
  usage:     string;
  pays:      string;
  variables: Record<string, any>;
  canal:     'USSD' | 'SMS' | 'APP' | 'WEB';
}

export interface IaResult {
  success:    boolean;
  text?:      string;
  parsed?:    any;
  model_used: string;
  fallback:   boolean;
  latency_ms: number;
  error?:     string;
}

const MODELS = {
  GEMINI_FLASH:  'gemini-2.5-flash',       // ← mis à jour
  CLAUDE_HAIKU:  'claude-haiku-4-5-20251001',
  CLAUDE_SONNET: 'claude-sonnet-4-6',
};

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private gemini:    GoogleGenerativeAI;
  private anthropic: Anthropic;

  constructor(private config: ConfigService) {
    this.gemini    = new GoogleGenerativeAI(config.get('GEMINI_API_KEY')!);
    this.anthropic = new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY')! });
  }

  async generate(input: IaInput): Promise<IaResult> {
    const start  = Date.now();
    const prompt = this.assemblerPrompt(input);
    const modele = this.choisirModele(input);

    if (modele === 'gemini') {
      try {
        const text = await this.appelGemini(prompt, input.canal);
        return { success: true, text, parsed: this.parseJson(text),
          model_used: MODELS.GEMINI_FLASH, fallback: false,
          latency_ms: Date.now() - start };
      } catch (err: any) {
        this.logger.warn(`Gemini échoué → fallback Claude : ${err.message}`);
      }
    }

    try {
      const text = await this.appelClaude(prompt, input.usage);
      return { success: true, text, parsed: this.parseJson(text),
        model_used: MODELS.CLAUDE_HAIKU, fallback: true,
        latency_ms: Date.now() - start };
    } catch (err: any) {
      return { success: false, model_used: 'none', fallback: true,
        latency_ms: Date.now() - start, error: err.message };
    }
  }

  private async appelGemini(prompt: string, canal: string): Promise<string> {
    const maxTokens = canal === 'USSD' ? 200 : 2000;
    const model = this.gemini.getGenerativeModel({
      model: MODELS.GEMINI_FLASH,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    });
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini timeout 8s')), 8000)),
    ]);
    return (result as any).response.text();
  }

  private async appelClaude(prompt: string, usage: string): Promise<string> {
    const model = usage.includes('B2G') || usage.includes('EVAL360')
      ? MODELS.CLAUDE_SONNET : MODELS.CLAUDE_HAIKU;
    const msg = await Promise.race([
      this.anthropic.messages.create({
        model, max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Claude timeout 10s')), 10000)),
    ]);
    const block = (msg as any).content[0];
    return block.type === 'text' ? block.text : '';
  }

  private choisirModele(input: IaInput): 'gemini' | 'claude' {
    if (input.usage.includes('B2G') || input.usage.includes('EVAL360')
      || input.usage.includes('JUDGE')) return 'claude';
    return 'gemini';
  }

  private assemblerPrompt(input: IaInput): string {
    const { module, usage, pays, variables, canal } = input;
    const ussdRule = canal === 'USSD'
      ? '\nIMPORTANT : Réponse en 160 caractères MAX. Texte simple.\n' : '';
    const contexte = pays === 'CI'
      ? 'Contexte : Côte d\'Ivoire. Adapter au contexte ivoirien.' : `Contexte : ${pays}.`;
    const vars = Object.entries(variables).map(([k, v]) => `${k}: ${v}`).join('\n');
    return `Tu es le NIE (Nohama Intelligence Engine) YIRA Africa.
Module: ${module} | Usage: ${usage}
${contexte}${ussdRule}
Variables:
${vars}
Réponds en JSON valide sauf si canal USSD.`;
  }

  private parseJson(text: string): any {
    try {
      return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch { return null; }
  }

  async testerConnexion(): Promise<{ gemini: boolean; claude: boolean }> {
    const results = { gemini: false, claude: false };
    try {
      await this.appelGemini('Réponds juste OK', 'APP');
      results.gemini = true;
    } catch {}
    try {
      await this.appelClaude('Réponds juste OK', 'TEST');
      results.claude = true;
    } catch {}
    return results;
  }
}