import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@nexiforma/database";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async setTenantRls(tenantId: string | null) {
    if (!tenantId) return;
    await this.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${tenantId}', true)`);
  }
}
