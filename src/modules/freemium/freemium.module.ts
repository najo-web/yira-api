// ============================================================
// YIRA — src/modules/freemium/freemium.module.ts
// ============================================================
import { Global, Module } from '@nestjs/common';
import { FreemiumService } from './freemium.service';

@Global() // disponible partout sans réimporter
@Module({
  providers: [FreemiumService],
  exports:   [FreemiumService],
})
export class FreemiumModule {}