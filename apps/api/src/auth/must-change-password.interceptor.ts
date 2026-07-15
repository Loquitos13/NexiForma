import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import type { RequestUser } from "./types/access-token-payload";
import { IS_PUBLIC_KEY } from "./decorators/public.decorator";
import { SKIP_MUST_CHANGE_PASSWORD_KEY } from "./decorators/skip-must-change-password.decorator";

const ALLOWED_PATHS = new Set([
  "/v1/auth/tenant/change-required-password",
  "/v1/auth/me",
  "/v1/auth/logout",
  "/v1/auth/refresh",
]);

@Injectable()
export class MustChangePasswordInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return next.handle();

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MUST_CHANGE_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const req = context.switchToHttp().getRequest<{ user?: RequestUser; path?: string; url?: string }>();
    const user = req.user;
    if (!user?.mustChangePassword) return next.handle();

    const path = req.path ?? req.url?.split("?")[0] ?? "";
    if (ALLOWED_PATHS.has(path)) return next.handle();

    throw new ForbiddenException(
      "Deve redefinir a password temporária antes de continuar.",
    );
  }
}
