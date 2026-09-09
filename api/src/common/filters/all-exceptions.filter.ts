import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/** Formato único de erro da API. O front tem um só caminho de tratamento. */
export interface ErrorBody {
  error: {
    /** Código estável para o cliente decidir o que fazer. */
    code: string;
    /** Mensagem em português, exibível. */
    message: string;
    /** Detalhes de validação, campo por campo. Ausente quando não há. */
    details?: unknown;
    requestId?: string;
  };
}

/**
 * Filtro global de exceção.
 *
 * Duas responsabilidades, e a segunda é de segurança: além de padronizar o
 * corpo, ele **não deixa erro interno virar resposta**. Um `QueryFailedError`
 * do Postgres serializado para o cliente entrega nome de tabela, coluna e
 * constraint — mapa do banco de graça. Aqui o inesperado sai como 500 genérico
 * e o detalhe vai só para o log do servidor.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      response.status(status).json(this.fromHttpException(status, payload, request.requestId));
      return;
    }

    this.logger.error(
      `${request.method} ${request.originalUrl} — erro não tratado`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "internal_error",
        message: "Erro interno. Tente novamente em instantes.",
        requestId: request.requestId,
      },
    } satisfies ErrorBody);
  }

  private fromHttpException(status: number, payload: unknown, requestId?: string): ErrorBody {
    // O `ThrottlerGuard` lança com a mensagem "ThrottlerException: Too Many
    // Requests", que é texto de biblioteca em inglês e vazaria para a tela da
    // criadora. 429 tem resposta própria, sempre.
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return {
        error: {
          code: "too_many_requests",
          message: "Muitas tentativas. Aguarde um momento e tente de novo.",
          requestId,
        },
      };
    }

    // `ValidationPipe` responde `{ statusCode, message: string[], error }`.
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      const rawMessage = record.message;
      const code = typeof record.code === "string" ? record.code : defaultCode(status);

      if (Array.isArray(rawMessage)) {
        return {
          error: {
            code: "validation_failed",
            message: "Dados inválidos.",
            details: rawMessage,
            requestId,
          },
        };
      }

      return {
        error: {
          code,
          message: typeof rawMessage === "string" ? rawMessage : defaultMessage(status),
          requestId,
        },
      };
    }

    return {
      error: {
        code: defaultCode(status),
        message: typeof payload === "string" ? payload : defaultMessage(status),
        requestId,
      },
    };
  }
}

function defaultCode(status: number): string {
  const codes: Record<number, string> = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "unprocessable",
    429: "too_many_requests",
  };
  return codes[status] ?? "error";
}

function defaultMessage(status: number): string {
  const messages: Record<number, string> = {
    400: "Requisição inválida.",
    401: "Sessão necessária.",
    403: "Sem permissão.",
    404: "Não encontrado.",
    409: "Conflito com o estado atual.",
    422: "Não foi possível processar.",
    429: "Muitas tentativas. Aguarde um momento.",
  };
  return messages[status] ?? "Erro na requisição.";
}
