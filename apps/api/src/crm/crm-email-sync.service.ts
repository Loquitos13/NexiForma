import { Injectable, Logger } from "@nestjs/common";
import type { IntegracaoProvider } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import { CrmConfigService } from "./crm-config.service";

/**
 * Stub de sincronização Gmail/M365 - prepara integração OAuth futura.
 * Actualiza lastSyncAt em tenant.metadata.crm.emailSync quando enabled.
 */
@Injectable()
export class CrmEmailSyncService {
  private readonly logger = new Logger(CrmEmailSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: CrmConfigService,
  ) {}

  async syncAllTenants(): Promise<number> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true },
    });
    let count = 0;

    for (const t of tenants) {
      const cfg = await this.config.getByTenantId(t.id);
      if (!cfg.emailSync?.enabled) continue;

      const integracao = await this.prisma.tenantIntegracao.findFirst({
        where: {
          tenantId: t.id,
          provider: cfg.emailSync.provider as IntegracaoProvider,
          mode: "OAUTH",
        },
      });

      if (!integracao) {
        this.logger.debug(`Tenant ${t.id}: email sync activo mas integração ${cfg.emailSync.provider} não configurada.`);
        continue;
      }

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: t.id },
        select: { metadata: true },
      });
      const metadata = {
        ...(typeof tenant?.metadata === "object" && tenant.metadata ? tenant.metadata : {}),
        crm: {
          ...cfg,
          emailSync: { ...cfg.emailSync, lastSyncAt: new Date().toISOString() },
        },
      };
      await this.prisma.tenant.update({ where: { id: t.id }, data: { metadata } });
      count++;
    }

    return count;
  }

  getStatus(tenantId: string) {
    return this.config.getByTenantId(tenantId).then((cfg) => ({
      emailSync: cfg.emailSync ?? { provider: "GMAIL" as const, enabled: false },
      oauthReady: false,
      message: "Sincronização OAuth Gmail/M365 disponível em breve. Configure credenciais em Integrações.",
    }));
  }
}
