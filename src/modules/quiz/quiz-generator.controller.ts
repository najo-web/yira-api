import { Controller, Post, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { QuizGeneratorService } from './quiz-generator.service';
import { ContentSourceService } from './content-source/content-source.service';
import { Public } from '../../auth/decorators';

@ApiTags('Quiz')
@Controller('quiz')
export class QuizGeneratorController {
  constructor(
    private quizGen:       QuizGeneratorService,
    private contentSource: ContentSourceService,
  ) {}

  @Post('generer/:serviceCode')
  @Public()
  @ApiOperation({ summary: 'Générer une question pour un service VAS' })
  @ApiParam({ name:'serviceCode', example:'SPORT' })
  async genererPourService(@Param('serviceCode') serviceCode: string) {
    const question = await this.quizGen.genererMaintenantPourService(serviceCode);
    if (!question) return { success: false, message: 'Score CQ-CI insuffisant ou erreur IA' };
    return { success: true, question };
  }

  @Post('generer-tout')
  @Public()
  @ApiOperation({ summary: 'Lancer la génération pour les 37 services (CRON manuel)' })
  async genererTout() {
    await this.quizGen.genererQuotidien();
    return { success: true, message: 'Generation lancee pour 37 services' };
  }

  @Delete('cache/:serviceCode')
  @Public()
  @ApiOperation({ summary: 'Invalider le cache CSP d\'un service' })
  @ApiParam({ name:'serviceCode', example:'SPORT' })
  invaliderCache(@Param('serviceCode') serviceCode: string) {
    this.contentSource.invaliderCache(serviceCode);
    return { success: true, message: 'Cache CSP invalide pour ' + serviceCode };
  }

  @Delete('cache')
  @Public()
  @ApiOperation({ summary: 'Invalider tout le cache CSP' })
  invaliderCacheGlobal() {
    this.contentSource.invaliderCache();
    return { success: true, message: 'Cache CSP global invalide' };
  }
}