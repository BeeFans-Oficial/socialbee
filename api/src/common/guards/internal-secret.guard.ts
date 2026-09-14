import { timingSafeEqual } from "node:crypto";

import { CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import type { Request } from "express";

import { loadEnv } from "../../config/env";

export const INTERNAL_SECRET_HEADER = "x-internal-secret";

/**
 * Barreira das rotas servidor-a-servidor.
 *
 * Protege o registro de clique. Sem ela, qualquer pessoa com o código curto de
 * um link — que é público, está na bio — poderia disparar a rota em laço e
 * inflar o contador de cliques de qualquer criadora. O contador é o número que
 * ela usa para negociar; deixá-lo escrevível de fora é entregar a métrica.
 *
 * Quem chama é o redirecionador do Next (`app/r/[code]/route.ts`), que roda no
 * servidor e tem o segredo.
 *
 * Responde **404** e não 403: a existência da rota interna não é informação que
 * precise ser confirmada para quem não tem o segredo.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[INTERNAL_SECRET_HEADER];
    const expected = loadEnv().internalApiSecret;

    if (typeof provided !== "string" || !safeEquals(provided, expected)) {
      throw new NotFoundException("Não encontrado.");
    }
    return true;
  }
}

/** Comparação de tempo constante. Um `===` em segredo vazaria o prefixo
 *  correto pelo tempo de resposta, dado tentativas suficientes. */
export function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * A requisição vem do nosso próprio servidor?
 *
 * Usado onde a rota precisa continuar PÚBLICA mas ganha informação extra
 * quando quem chama é o servidor do Next — caso do veredito de robô no perfil
 * público. Um guard não serve ali: ele recusaria o visitante comum.
 */
export function isInternalRequest(headers: Record<string, string | string[] | undefined>): boolean {
  const provided = headers[INTERNAL_SECRET_HEADER];
  if (typeof provided !== "string") return false;
  return safeEquals(provided, loadEnv().internalApiSecret);
}
