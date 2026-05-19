import { Module, Global } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { ObservabilityController } from './observability.controller';

@Global()
@Module({
  providers:   [TelemetryService],
  controllers: [ObservabilityController],
  exports:     [TelemetryService],
})
export class ObservabilityModule {}