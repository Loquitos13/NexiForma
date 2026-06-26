import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import type { RequestUser } from "../auth/types/access-token-payload";

/** Logs JSON estruturados (CloudWatch Logs / Insights). */
@Injectable()
export class StructuredLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger("http");
  private readonly enabled =
    process.env.OBSERVABILITY_ENABLED !== "false" &&
    process.env.NODE_ENV !== "test";

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: RequestUser }>();
    const res = http.getResponse<Response>();
    const started = Date.now();
    const requestId =
      (req.headers["x-request-id"] as string | undefined) ??
      (req.headers["x-amzn-trace-id"] as string | undefined) ??
      undefined;

    return next.handle().pipe(
      tap({
        next: () => this.emit(req, res.statusCode, started, requestId),
        error: () => this.emit(req, res.statusCode || 500, started, requestId),
      }),
    );
  }

  private emit(
    req: Request & { user?: RequestUser },
    statusCode: number,
    started: number,
    requestId: string | undefined,
  ) {
    const user = req.user;
    const entry = {
      type: "http_request",
      method: req.method,
      path: req.path,
      statusCode,
      durationMs: Date.now() - started,
      tenantId: user?.tenantId ?? null,
      userId: user?.sub ?? null,
      role: user?.role ?? null,
      impersonating: user?.impersonating ?? false,
      requestId: requestId ?? null,
      timestamp: new Date().toISOString(),
    };
    this.logger.log(JSON.stringify(entry));
  }
}
