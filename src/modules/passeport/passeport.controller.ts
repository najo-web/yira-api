import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { PasseportService } from './passeport.service';
import { Public } from '../../auth/decorators';

@ApiTags('Passeport')
@Controller('passeport')
export class PasseportController {
  constructor(private passeport: PasseportService) {}

  @Post('commander')
  @Public()
  @ApiOperation({ summary: 'Commander un Passeport de Compétences (700 FCFA)' })
  @ApiBody({ schema: { type:'object', properties: {
    telephone:    { type:'string', example:'+2250708647166' },
    tenant_id:    { type:'string', example:'CI' },
    milieu:       { type:'string', example:'URBAIN' },
  }}})
  async commander(@Body() body: any) {
    return this.passeport.commanderPasseport(body);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Consulter un Passeport de Compétences' })
  @ApiParam({ name:'id', description:'UUID du rapport' })
  async consulter(@Param('id') id: string, @Query('tenant') tenant = 'CI') {
    return this.passeport.consulterPasseport(id, tenant);
  }

  @Get('ping')
  @Public()
  @ApiOperation({ summary: 'Santé PasseportService' })
  ping() { return { status: 'PASSEPORT OK', tarif: '700 FCFA', timestamp: new Date().toISOString() }; }
}