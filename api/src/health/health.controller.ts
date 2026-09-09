import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

import { Public } from "../common/decorators/public.decorator";

/**
 * Saúde da API.
 *
 * Usado pelo `HEALTHCHECK` do container e pelo `depends_on` do compose. Toca o
 * banco de propósito: um processo que responde 200 sem conseguir consultar o
 * Postgres é o pior tipo de "saudável" — o orquestrador manda tráfego e todo
 * request morre em 500.
 */
@Controller("health")
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.dataSource.query("SELECT 1");
    } catch {
      throw new ServiceUnavailableException({
        code: "database_unavailable",
        message: "Banco de dados indisponível.",
      });
    }

    return { status: "ok", uptime: Math.round(process.uptime()) };
  }
}
