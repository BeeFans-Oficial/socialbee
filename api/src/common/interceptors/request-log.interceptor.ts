import { randomUUID } from "node:crypto";

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { tap } from "rxjs";

/**
 * Log de requisição com identificador.
 *
 * O identificador entra no cabeçalho de resposta e no corpo de erro, então
 * quando a criadora manda print de um erro, dá para achar a linha exata no log
 * sem adivinhar horário. Sem isto, "deu erro ao salvar" é imposs��vel de
 * investigar.
 *
 * O que NÃO é logado: corpo da requisição. Ali passam senha e token.
 */
@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();

    const requestId = (request.headers["x-request-id"] as string | undefined) ?? randomUUID();
    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response.statusCode, startedAt, requestId),
        error: (error) => {
          const status = typeof error?.status === "number" ? error.status : 500;
          this.log(request, status, startedAt, requestId);
        },
      }),
    );
  }

  private log(request: Request, status: number, startedAt: number, requestId: string): void {
    const elapsed = Date.now() - startedAt;
    const line = `${request.method} ${request.originalUrl} ${status} ${elapsed}ms [${requestId}]`;
    if (status >= 500) this.logger.error(line);
    else if (status >= 400) this.logger.warn(line);
    else this.logger.log(line);
  }
}
