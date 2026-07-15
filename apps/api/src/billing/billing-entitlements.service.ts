import { ForbiddenException, Injectable } from "@nestjs/common";
import { resolveTenantEntitlements, type TenantEntitlements } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import { findCurrentTenantSubscription } from "./current-subscription.util";

@Injectable()
export class BillingEntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async forTenant(tenantId: string): Promise<TenantEntitlements> {
    const sub = await findCurrentTenantSubscription(this.prisma, tenantId);
    return resolveTenantEntitlements(sub?.plan?.code, sub?.customAddons);
  }

  async assertRelatoriosDashboard(tenantId: string): Promise<void> {
    const e = await this.forTenant(tenantId);
    if (!e.canAccessRelatoriosDashboard) {
      throw new ForbiddenException(
        "Dashboards de relatórios disponíveis a partir do plano Business. Contacte vendas para upgrade ou exporte dados brutos.",
      );
    }
  }

  async assertRelatoriosInsights(tenantId: string): Promise<void> {
    const e = await this.forTenant(tenantId);
    if (!e.canAccessRelatoriosInsights) {
      throw new ForbiddenException(
        "Relatórios com IA disponíveis no plano Enterprise. Contacte a equipa comercial.",
      );
    }
  }
}
