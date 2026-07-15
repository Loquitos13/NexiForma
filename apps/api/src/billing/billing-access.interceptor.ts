import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { isApiPathAllowed, isApiPathExempt, normalizeApiPath } from "@nexiforma/shared";
import type { RequestUser } from "../auth/types/access-token-payload";
import { BillingEntitlementsService } from "./billing-entitlements.service";

type HttpRequest = {
  path?: string;
  url?: string;
  user?: RequestUser;
};

@Injectable()
export class BillingAccessInterceptor implements NestInterceptor {
  constructor(private readonly entitlements: BillingEntitlementsService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<HttpRequest>();
    const user = req.user;

    if (user?.tenantId && !(user.kind === "platform" && user.role === "super_admin")) {
      const rawPath = req.path ?? req.url?.split("?")[0] ?? "";
      if (!isApiPathExempt(rawPath)) {
        const ent = await this.entitlements.forTenant(user.tenantId);
        const apiPath = normalizeApiPath(rawPath);
        if (
          !isApiPathAllowed(apiPath, ent, {
            role: user.role,
            kind: user.kind,
          })
        ) {
          throw new ForbiddenException(
            "Funcionalidade não incluída nos módulos activos da subscrição. Contacte a equipa comercial para activar o módulo.",
          );
        }
      }
    }

    return next.handle();
  }
}
