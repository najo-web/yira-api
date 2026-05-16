import { Controller, Post, Param } from '@nestjs/common';
import { QuizGeneratorService } from './quiz-generator.service';
import { Public } from '../../auth/decorators';

@Controller('quiz')
export class QuizGeneratorController {
  constructor(private quizGen: QuizGeneratorService) {}

  @Post('generer/:serviceCode')
  @Public()
  async genererPourService(@Param('serviceCode') serviceCode: string) {
    const question = await this.quizGen.genererMaintenantPourService(serviceCode);
    if (!question) return { success: false, message: 'Score CQ-CI insuffisant ou erreur IA' };
    return { success: true, question };
  }

  @Post('generer-tout')
  @Public()
  async genererTout() {
    await this.quizGen.genererQuotidien();
    return { success: true, message: 'Generation lancee pour 37 services' };
  }
}