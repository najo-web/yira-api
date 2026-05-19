// =============================================================================
// YIRA V3.0 — AgentManagerController
// Sprint 51 — Dashboard agents IA éditoriaux YIRA-COMMAND
// =============================================================================
import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AgentManagerService, AgentCategorie } from './agent-manager.service';
import { Public } from '../../auth/decorators';

@ApiTags('Quiz — Agent Manager')
@Controller('agents')
export class AgentManagerController {
  constructor(private mgr: AgentManagerService) {}

  @Get('ping')
  @Public()
  ping() { return { status: this.mgr.ping() }; }

  @Get('dashboard')
  @Public()
  @ApiOperation({ summary: 'Dashboard agents IA — Vue YIRA-COMMAND' })
  dashboard() { return this.mgr.getDashboard(); }

  @Get('liste')
  @Public()
  @ApiOperation({ summary: 'Lister tous les agents IA' })
  @ApiQuery({ name: 'categorie', required: false, enum: ['VAS_EDITORIAL','COACHING','RAPPORT','ANTIFRAUDE','CV_LETTRE'] })
  liste(@Query('categorie') categorie?: AgentCategorie) {
    return { agents: this.mgr.listerAgents(categorie) };
  }

  @Get(':code')
  @Public()
  @ApiOperation({ summary: 'Détail d un agent IA' })
  @ApiParam({ name: 'code', example: 'ZOUGLOU_AGENT' })
  detail(@Param('code') code: string) {
    const agent = this.mgr.getAgent(code);
    if (!agent) return { error: 'Agent non trouvé: ' + code };
    return agent;
  }

  @Get(':code/stats')
  @Public()
  @ApiOperation({ summary: 'Statistiques d exécution d un agent' })
  @ApiParam({ name: 'code', example: 'ZOUGLOU_AGENT' })
  stats(@Param('code') code: string) {
    return this.mgr.getStats(code)[0] ?? { error: 'Agent non trouvé' };
  }

  @Post('recharger')
  @Public()
  @ApiOperation({ summary: 'Recharger la configuration agents depuis base_game' })
  async recharger() {
    const nb = await this.mgr.rechargerAgents();
    return { success: true, agents_charges: nb, message: 'Configuration rechargée depuis base_game' };
  }
}