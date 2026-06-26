import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Observable, from, switchMap } from "rxjs";
import type { RequestUser } from "../auth/types/access-token-payload";
import { PrismaService } from "./prisma.service";
import { runWithTenantContext } from "./tenant-context";

@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;
    const tenantId = user?.tenantId ?? null;
    const bypass = user?.kind === "platform" || !tenantId;
    const rls = this.config.get<string>("RLS_ENABLED") === "true";

    return from(
      runWithTenantContext({ tenantId, bypassRls: bypass }, async () => {
        if (rls && tenantId && !bypass) {
          await this.prisma.setTenantRls(tenantId);
        }
      }),
    ).pipe(switchMap(() => next.handle()));
  }
}
