import { Body, Controller, Get, Patch } from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ProfilesService } from "./profiles.service";

/**
 * Perfil do dono da sessão.
 *
 * Não existe rota `PATCH /profiles/:id`. O perfil editável é sempre o da
 * sessão, e por isso não há id nenhum a conferir: a rota não tem como ser
 * apontada para o perfil de outra pessoa.
 */
@Controller("me/profile")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  async show(@CurrentUser() auth: AuthContext) {
    return this.profilesService.ownProfile(auth.profileId);
  }

  @Patch()
  async update(@CurrentUser() auth: AuthContext, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(auth.profileId, dto);
  }
}
