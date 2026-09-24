import { Body, Controller, Get, Post } from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { ProfilesService } from "./profiles.service";

/**
 * As PÁGINAS da conta.
 *
 * Uma conta passa a poder ter várias — cada uma com seu endereço, seu modelo,
 * seus links e seu relatório. É o que o domínio já previa desde o schema
 * inicial: `profiles` sempre foi tabela separada de `users`, e todo o
 * rastreamento sempre foi escopado por `profileId`.
 *
 * O que faltava não era o banco; era a conta poder criar a segunda e o painel
 * saber qual delas está sendo editada. A segunda parte é o cabeçalho
 * `x-profile-id`, resolvido em `JwtAuthGuard`.
 *
 * Não há `DELETE` aqui, e a ausência é deliberada: apagar uma página apaga
 * junto os links e todo o histórico de cliques dela — dado que a criadora usa
 * para negociar valor e que nenhum backup automático cobre hoje. Enquanto não
 * houver arquivamento (esconder sem destruir) e confirmação à altura, a rota
 * não existe.
 */
@Controller("me/profiles")
export class MyProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  async list(@CurrentUser() auth: AuthContext) {
    return { profiles: await this.profilesService.listByUser(auth.userId) };
  }

  @Post()
  async create(@CurrentUser() auth: AuthContext, @Body() dto: CreateProfileDto) {
    return this.profilesService.createForUser(auth.userId, dto);
  }
}
