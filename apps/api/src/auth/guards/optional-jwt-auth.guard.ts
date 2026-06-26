import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { RequestUser } from "../types/access-token-payload";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers?: { authorization?: string }; user?: RequestUser | null }>();
    const auth = req.headers?.authorization;
    if (!auth?.startsWith("Bearer ")) {
      req.user = null;
      return true;
    }
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      req.user = null;
      return true;
    }
  }

  handleRequest<TUser = RequestUser>(
    err: unknown,
    user: TUser | false,
  ): TUser | null {
    if (err || !user) return null;
    return user;
  }
}
