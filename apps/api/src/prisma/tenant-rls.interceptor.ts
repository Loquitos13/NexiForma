import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Observable } from "rxjs";
import type { RequestUser } from "../auth/types/access-token-payload";
import type { ApiKeyRequest } from "../public-api/api-key.guard";
import { PrismaService } from "./prisma.service";
import { tenantDbStorage, type TenantDbContext } from "./tenant-context";

type TenantHttpRequest = {
  user?: RequestUser;
  apiKey?: ApiKeyRequest;
};

@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<TenantHttpRequest>();
    const user = req.user;
    const tenantId = user?.tenantId ?? req.apiKey?.tenantId ?? null;
    const bypass = user?.kind === "platform" || !tenantId;
    const rls = this.config.get<string>("RLS_ENABLED") === "true";
    const dbCtx: TenantDbContext = { tenantId, bypassRls: bypass };

    return new Observable((observer) => {
      tenantDbStorage.run(dbCtx, () => {
        void (async () => {
          try {
            if (rls && tenantId && !bypass) {
              await this.prisma.setTenantRls(tenantId);
            }

            next.handle().subscribe({
              next: (value) => observer.next(value),
              error: (err) => observer.error(err),
              complete: () => {
                void this.prisma
                  .clearTenantRls()
                  .catch(() => undefined)
                  .finally(() => observer.complete());
              },
            });
          } catch (err) {
            observer.error(err);
          }
        })();
      });
    });
  }
}
