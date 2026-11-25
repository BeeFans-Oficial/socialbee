import { createHmac, timingSafeEqual } from "node:crypto";

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

export const REVISAO_HEADER = "x-revisao";

/**
 * A marca que a revisão da Meta (`revisao.service.ts`) manda ao seguir um
 * `/r/<código>` nosso, para o acesso NÃO entrar no relatório.
 *
 * A revisão bate no redirecionador pelo endereço público, com user-agent de
 * navegador de verdade — é o que ela existe para simular —, então o filtro de
 * robô a deixa passar e cada rodada virava clique no painel da criadora
 * (medido em 24/11/2026: 705 cliques em 7 dias, cerca de 5% do total).
 *
 * A marca só desliga a CONTAGEM. A resposta do redirecionador é o mesmo 307
 * com ou sem ela: nada aqui pode virar ramo de resposta, que seria documento
 * diferente por requisitante.
 *
 * É um HMAC do código com o segredo interno, e não o segredo em si: o
 * cabeçalho viaja pela internet até o nosso próprio nginx, e o que vazar dali
 * serve no máximo para alguém fazer os PRÓPRIOS cliques naquele link não
 * contarem.
 */
export function marcaDaRevisao(code: string): string {
  return createHmac("sha256", loadEnv().internalApiSecret).update(`revisao:${code}`).digest("hex");
}

export function ehDaRevisao(headers: Record<string, string | string[] | undefined>, code: string): boolean {
  const provided = headers[REVISAO_HEADER];
  if (typeof provided !== "string") return false;
  return safeEquals(provided, marcaDaRevisao(code));
}
