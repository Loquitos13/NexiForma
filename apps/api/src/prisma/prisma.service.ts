import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@nexiforma/database";
import { assertValidUuid } from "../common/uuid.util";
import { tenantScopeExtension } from "./prisma-tenant.extension";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    const scoped = this.$extends(tenantScopeExtension) as unknown as PrismaClient;

    return new Proxy(scoped, {
      get: (target, prop, receiver) => {
        if (prop === "setTenantRls") {
          return PrismaService.prototype.setTenantRls.bind(target);
        }
        if (prop === "clearTenantRls") {
          return PrismaService.prototype.clearTenantRls.bind(target);
        }
        if (prop === "onModuleInit") {
          return PrismaService.prototype.onModuleInit.bind(target);
        }
        if (prop === "onModuleDestroy") {
          return PrismaService.prototype.onModuleDestroy.bind(target);
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** Sessão PostgreSQL: propagar tenant às políticas RLS (complementa o scope Prisma). */
  async setTenantRls(tenantId: string | null) {
    if (!tenantId) return;
    const safe = assertValidUuid(tenantId, "tenantId");
    await this.$executeRaw`SELECT set_config('app.tenant_id', ${safe}, false)`;
  }

  /** Limpa contexto RLS antes de devolver a conexão ao pool. */
  async clearTenantRls() {
    await this.$executeRaw`SELECT set_config('app.tenant_id', '', false)`;
  }
}
