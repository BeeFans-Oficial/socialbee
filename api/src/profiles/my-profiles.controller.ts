import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";

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
 * O `DELETE` existe, mas é o gesto excepcional. O comum é tirar do ar
 * (`PATCH /me/profile` com `published: false`), que esconde a página e preserva
 * links, códigos curtos e relatório. Apagar destrói o histórico de cliques por
 * cascata e nenhum backup automático cobre isso hoje — por isso a interface
 * pede o endereço digitado antes de chamar esta rota, e a API recusa apagar a
 * única página da conta.
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

  /**
   * Apaga uma página. Irreversível, e leva os cliques junto.
   *
   * O id vai no caminho e não é o da sessão: apagar a página ativa é o caso
   * comum, mas apagar outra da lista também precisa funcionar — e as duas
   * passam pela mesma verificação de posse no serviço.
   */
  @Delete(":id")
  @HttpCode(204)
  async remove(
    @CurrentUser() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.profilesService.deleteForUser(auth.userId, id);
  }
}
