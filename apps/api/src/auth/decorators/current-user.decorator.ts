import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { RequestUser } from "../types/access-token-payload";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return req.user;
  },
);
