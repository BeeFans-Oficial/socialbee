import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { SemPagina } from "../common/decorators/sem-pagina.decorator";
import { OwnerDto } from "./dto/owner.dto";
import { OwnersService } from "./owners.service";

/**
 * Donos de página da conta: listar, criar, renomear e apagar.
 *
 * Por conta, e não por página — como `me/profiles`, funciona mesmo para a
 * conta que ainda não tem página nenhuma.
 */
@Controller("me/owners")
@SemPagina()
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get()
  async list(@CurrentUser() auth: AuthContext) {
    return { owners: await this.ownersService.list(auth.userId) };
  }

  @Post()
  async create(@CurrentUser() auth: AuthContext, @Body() dto: OwnerDto) {
    return this.ownersService.create(auth.userId, dto.name);
  }

  @Patch(":id")
  async rename(
    @CurrentUser() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: OwnerDto,
  ) {
    return this.ownersService.rename(auth.userId, id, dto.name);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(
    @CurrentUser() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.ownersService.remove(auth.userId, id);
  }
}
