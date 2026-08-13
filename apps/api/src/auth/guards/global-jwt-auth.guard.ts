import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/** JWT obrigatório em todas as rotas excepto @Public(). */
@Injectable()
export class GlobalJwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  canActivate(context: ExecutionContext) {
    if (this.isPublicRoute(context)) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(
    err: unknown,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (this.isPublicRoute(context)) {
      return (user ?? null) as TUser;
    }
    if (err || !user) {
      throw err ?? new UnauthorizedException("Sessão inválida ou expirada.");
    }
    return user;
  }
}
