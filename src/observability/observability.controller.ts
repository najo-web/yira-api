import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';
import { Public } from '../auth/decorators';

@ApiTags('Observability')
@Controller('observability')
export class ObservabilityController {
  constructor(private telemetry: TelemetryService) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Statut OpenTelemetry — compteurs et latences YIRA' })
  health() {
    return this.telemetry.getStatut();
  }

  @Get('metrics')
  @Public()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'Métriques format Prometheus text' })
  metrics(): string {
    return this.telemetry.getMetriquesPrometheus();
  }

  @Get('ping')
  @Public()
  ping() {
    return { status: 'OBSERVABILITY OK', standard: 'OpenTelemetry 1.x', timestamp: new Date().toISOString() };
  }
}