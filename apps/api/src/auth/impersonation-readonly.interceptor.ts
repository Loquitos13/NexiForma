import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import type { RequestUser } from "../auth/types/access-token-payload";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Bloqueia escritas quando personificação read-only (excepto terminar personificação). */
@Injectable()
export class ImpersonationReadonlyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = req.user;
    const method = req.method.toUpperCase();
    const path = req.path ?? "";

    if (
      user?.readOnlyImpersonation &&
      user.impersonating &&
      MUTATING.has(method) &&
      !path.includes("/impersonation/end")
    ) {
      throw new ForbiddenException("Personificação read-only – operação não permitida.");
    }

    return next.handle();
  }
}
