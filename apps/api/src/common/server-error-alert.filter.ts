import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { Request, Response } from "express";
import type { RequestUser } from "../auth/types/access-token-payload";
import { PlatformAlertasService } from "../notificacoes/platform-alertas.service";

type RequestWithUser = Request & { user?: RequestUser };

const GENERIC_5XX =
  "Ocorreu um erro interno. Tente novamente mais tarde ou contacte o suporte.";

const SENSITIVE_KEYS = /password|secret|token|authorization|cookie|api[_-]?key|mfa/i;

function extractMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const res = exception.getResponse();
    if (typeof res === "string") return res;
    if (typeof res === "object" && res !== null) {
      const body = res as Record<string, unknown>;
      if (Array.isArray(body.message)) return body.message.map(String).join("; ");
      if (typeof body.message === "string") return body.message;
    }
    return exception.message;
  }
  if (exception instanceof Error) return exception.message;
  return String(exception);
}

function extractResponseBody(exception: unknown): string | undefined {
  if (!(exception instanceof HttpException)) return undefined;
  const res = exception.getResponse();
  if (typeof res === "string") return res.slice(0, 4000);
  if (typeof res === "object" && res !== null) {
    try {
      return JSON.stringify(res, null, 0).slice(0, 4000);
    } catch {
      return String(res).slice(0, 4000);
    }
  }
  return undefined;
}

function sanitizePayload(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (typeof body !== "object") return String(body).slice(0, 1500);

  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = SENSITIVE_KEYS.test(k) ? "[REDACTED]" : redact(v);
      }
      return out;
    }
    return value;
  };

  try {
    return JSON.stringify(redact(body), null, 0).slice(0, 2000);
  } catch {
    return undefined;
  }
}

/** Erros de RBAC/sessão - não alertar superadmin (fluxo normal do cliente). */
function shouldSkipSuperAdminAlert(status: number): boolean {
  return status === HttpStatus.FORBIDDEN || status === HttpStatus.UNAUTHORIZED;
}

/**
 * Envia email ao superadmin em erros HTTP 4xx e 5xx (e excepções não tratadas).
 * Exclui 403, refresh de sessão e outros 401 de autenticação esperados.
 */
@Catch()
export class ServerErrorAlertFilter extends BaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ServerErrorAlertFilter.name);

  constructor(private readonly platformAlertas: PlatformAlertasService) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    void this.alertSuperAdmin(exception, host);
    const clientException = this.sanitizeForClient(exception, host);
    super.catch(clientException, host);
  }

  private isPlatformSuperAdmin(user: RequestUser | undefined): boolean {
    return user?.kind === "platform" && user?.role === "super_admin";
  }

  private sanitizeForClient(exception: unknown, host: ArgumentsHost): unknown {
    if (host.getType() !== "http") return exception;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status < 500) return exception;

    const req = host.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;

    if (this.isPlatformSuperAdmin(user)) {
      const detail = extractMessage(exception);
      const tenantCtx = user?.tenantId
        ? ` [tenant: ${user.tenantSlug ?? user.tenantId} · ${user.email ?? user.sub}]`
        : "";
      return new InternalServerErrorException({
        statusCode: status,
        message: `${detail}${tenantCtx}`,
        error: "Internal Server Error",
      });
    }

    return new InternalServerErrorException({
      statusCode: status,
      message: GENERIC_5XX,
      error: "Internal Server Error",
    });
  }

  private async alertSuperAdmin(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== "http") return;

    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithUser>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status < 400) return;

    const message = extractMessage(exception);
    const responseBody = extractResponseBody(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const method = req.method;
    const path = req.originalUrl ?? req.url;

    if (shouldSkipSuperAdminAlert(status)) return;

    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const user = req.user;

    try {
      await this.platformAlertas.notificarErroServidor({
        modulo: "api-http",
        resumo: message,
        detalhe: stack,
        stack,
        responseBody,
        httpMethod: method,
        httpPath: path,
        statusCode: status,
        userEmail: user?.email,
        userId: user?.sub,
        tenantId: user?.tenantId ?? undefined,
        tenantSlug: user?.tenantSlug ?? undefined,
        payload: isMutation ? sanitizePayload(req.body) : undefined,
      });
    } catch (err) {
      this.logger.warn(`Falha ao alertar superadmin: ${String(err)}`);
    }

    if (res.headersSent) return;
  }
}
