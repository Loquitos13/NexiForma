import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { JwtRole } from "@nexiforma/shared";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { RequestUser } from "../types/access-token-payload";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<JwtRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;
    if (!user?.role) {
      throw new ForbiddenException("Sem papel no token.");
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException("Permissões insuficientes.");
    }
    return true;
  }
}
