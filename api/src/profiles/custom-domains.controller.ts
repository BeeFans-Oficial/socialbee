import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { loadEnv } from "../config/env";
import { PLANOS } from "../plans/plans";
import { CustomDomainsService } from "./custom-domains.service";
import { CreateCustomDomainDto } from "./dto/create-custom-domain.dto";

/**
 * Domínios próprios da conta. Escopo é a CONTA (`userId`), não a página: um
 * domínio próprio serve qualquer página da dona.
 */
@Controller("me/custom-domains")
export class CustomDomainsController {
  constructor(private readonly service: CustomDomainsService) {}

  @Get()
  async list(@CurrentUser() auth: AuthContext) {
    return {
      domains: await this.service.list(auth.userId),
      vagas: PLANOS[auth.plano].dominiosProprios,
      serverIp: loadEnv().serverPublicIp,
    };
  }

  @Post()
  async create(@CurrentUser() auth: AuthContext, @Body() dto: CreateCustomDomainDto) {
    return this.service.create(auth.userId, auth.plano, dto.host);
  }

  @Post(":id/dns")
  @HttpCode(200)
  async checkDns(@CurrentUser() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.checkDns(auth.userId, id);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string) {
    await this.service.remove(auth.userId, id);
  }
}
