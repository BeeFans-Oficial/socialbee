import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { CreateLinkDto } from "./dto/create-link.dto";
import { ReorderLinksDto } from "./dto/reorder-links.dto";
import { UpdateLinkDto } from "./dto/update-link.dto";
import { LinkOwnerGuard } from "./link-owner.guard";
import { LinksService } from "./links.service";

/**
 * CRUD dos links do perfil da sessão.
 *
 * `me/links` e não `profiles/:profileId/links`: não existe rota em que o perfil
 * venha do cliente. O `profileId` sai da sessão, sempre — a mesma regra que o
 * relatório de rastreamento do MVP não conseguia cumprir por não haver login
 * (e que o deixava fixo em `MOCK_USER.id`).
 */
@Controller("me/links")
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Get()
  async index(@CurrentUser() auth: AuthContext) {
    return { links: await this.linksService.list(auth.profileId) };
  }

  @Post()
  async create(@CurrentUser() auth: AuthContext, @Body() dto: CreateLinkDto) {
    return this.linksService.create(auth.profileId, dto);
  }

  /**
   * Reordenar.
   *
   * Vem antes de `:id` no arquivo de propósito: o Nest casa rotas na ordem de
   * declaração, e `PATCH me/links/reorder` seria capturado por
   * `PATCH me/links/:id` com `id = "reorder"` se a ordem fosse inversa.
   */
  @Patch("reorder")
  async reorder(@CurrentUser() auth: AuthContext, @Body() dto: ReorderLinksDto) {
    return { links: await this.linksService.reorder(auth.profileId, dto) };
  }

  @UseGuards(LinkOwnerGuard)
  @Get(":id")
  async show(@CurrentUser() auth: AuthContext, @Param("id") id: string) {
    return this.linksService.show(auth.profileId, id);
  }

  @UseGuards(LinkOwnerGuard)
  @Patch(":id")
  async update(
    @CurrentUser() auth: AuthContext,
    @Param("id") id: string,
    @Body() dto: UpdateLinkDto,
  ) {
    return this.linksService.update(auth.profileId, id, dto);
  }

  @UseGuards(LinkOwnerGuard)
  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() auth: AuthContext, @Param("id") id: string): Promise<void> {
    await this.linksService.remove(auth.profileId, id);
  }
}
