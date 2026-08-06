import { ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { ddosProtectionEnabled, DDOS_WINDOW_MS } from "./ddos-throttle.config";

/**
 * Rate limit por IP real (x-forwarded-for quando TRUST_PROXY=true).
 * Desactivável com DDOS_ENABLED=false (só dev local).
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!ddosProtectionEnabled()) {
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }

  protected async throwThrottlingException(): Promise<void> {
    const retryAfterSec = Math.max(1, Math.ceil(DDOS_WINDOW_MS / 1000));
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: "Demasiados pedidos. Tente novamente dentro de momentos.",
        retryAfterSec,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      const ip = forwarded.split(",")[0]?.trim();
      if (ip) return ip;
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
      return String(forwarded[0]).trim();
    }
    return request.ip ?? "unknown";
  }
}
