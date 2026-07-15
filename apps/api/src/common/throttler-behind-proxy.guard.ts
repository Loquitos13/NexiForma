import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import { ddosProtectionEnabled } from "./ddos-throttle.config";

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
