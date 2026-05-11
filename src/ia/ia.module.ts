// ============================================================
// YIRA — src/ia/ia.module.ts
// ============================================================
import { Global, Module } from '@nestjs/common';
import { IaService }      from './ia.service';
import { IaController }   from './ia.controller';

@Global() // disponible dans toute l'app sans réimporter
@Module({
  providers:   [IaService],
  controllers: [IaController],
  exports:     [IaService],
})
export class IaModule {}