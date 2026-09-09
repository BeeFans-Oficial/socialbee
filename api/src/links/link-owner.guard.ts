import { CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { Repository } from "typeorm";

import type { AuthContext } from "../common/decorators/current-user.decorator";
import { Link } from "./entities/link.entity";

/**
 * Autorização de posse do link.
 *
 * Roda depois do guard de sessão e antes do handler: se o link do `:id` não é
 * do perfil da sessão, a requisição morre aqui e o serviço nunca é chamado.
 *
 * Responde **404 e não 403**. A diferença importa: 403 confirma que o id
 * existe, e com isso alguém consegue enumerar links de outras criadoras só
 * lendo o código de resposta. 404 não distingue "não é seu" de "não existe".
 *
 * O serviço TAMBÉM filtra por `profileId` nas próprias consultas. A repetição é
 * deliberada: o guard é a política (declarada no controller, visível na
 * assinatura da rota) e o filtro no serviço é o escopo (protege quem chamar o
 * serviço de outro lugar — um cron, um comando, um módulo futuro — sem passar
 * por HTTP).
 */
@Injectable()
export class LinkOwnerGuard implements CanActivate {
  constructor(@InjectRepository(Link) private readonly links: Repository<Link>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const linkId = typeof request.params?.id === "string" ? request.params.id : undefined;

    if (!request.auth) {
      // Guard de posse sem guard de sessão antes é erro de montagem da rota.
      throw new NotFoundException("Link não encontrado.");
    }
    if (!linkId || !isUuid(linkId)) {
      // Id malformado nunca pertence a ninguém. Recusar aqui evita que um
      // `where` com texto arbitrário chegue ao banco.
      throw new NotFoundException("Link não encontrado.");
    }

    const owns = await this.links.exists({
      where: { id: linkId, profileId: request.auth.profileId },
    });
    if (!owns) throw new NotFoundException("Link não encontrado.");

    return true;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID.test(value);
}
