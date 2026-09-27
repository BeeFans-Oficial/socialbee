import { Controller, Get } from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { ProfilesService } from "./profiles.service";

/**
 * O pool de domínios, para quem edita uma página escolher.
 *
 * Rota própria e não `/me/profiles/domains`: domínio não é sub-recurso de
 * página — é catálogo da instalação, e as duas coisas têm ciclos de vida
 * diferentes. O caminho aninhado também colidiria no dia em que existisse um
 * `GET /me/profiles/:id`, porque "domains" casaria com o parâmetro.
 *
 * Exige sessão, ainda que a informação não seja secreta: é escolha de quem
 * edita, não dado de visitante, e a lista de domínios da operação não precisa
 * ficar exposta a quem varre a API — ela é, por definição, o mapa dos endereços
 * que valeria a pena bloquear.
 */
@Controller("me/domains")
export class DomainsController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  async list(@CurrentUser() _auth: AuthContext) {
    return { domains: await this.profilesService.listActiveDomains() };
  }
}
