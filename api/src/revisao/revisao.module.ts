import { Module } from "@nestjs/common";

import { RevisaoController, VerificacaoDeLinkController } from "./revisao.controller";
import { RevisaoService } from "./revisao.service";

/** O simulador da revisão da Meta. Exporta o serviço para o painel admin
 *  listar as páginas em vermelho. */
@Module({
  controllers: [RevisaoController, VerificacaoDeLinkController],
  providers: [RevisaoService],
  exports: [RevisaoService],
})
export class RevisaoModule {}
