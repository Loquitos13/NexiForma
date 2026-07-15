import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import type { CrmAutomationRule } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CrmConfigService } from "./crm-config.service";
import { CrmWebhooksService } from "./crm-webhooks.service";
import { CrmInteraccoesService } from "./crm-interaccoes.service";
import { CrmSugestoesIaService } from "./crm-sugestoes-ia.service";

@Injectable()
export class CrmAutomationService {
  private readonly logger = new Logger(CrmAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: CrmConfigService,
    private readonly webhooks: CrmWebhooksService,
    @Inject(forwardRef(() => CrmInteraccoesService))
    private readonly interaccoes: CrmInteraccoesService,
    @Inject(forwardRef(() => CrmSugestoesIaService))
    private readonly sugestoes: CrmSugestoesIaService,
  ) {}

  async onLeadCreated(tenantId: string, leadId: string): Promise<void> {
    await this.runRules(tenantId, "LEAD_CREATED", { leadId });
  }

  async onPropostaSent(tenantId: string, propostaId: string): Promise<void> {
    await this.runRules(tenantId, "PROPOSTA_SENT", { propostaId });
  }

  private async runRules(
    tenantId: string,
    trigger: CrmAutomationRule["trigger"],
    ctx: Record<string, string>,
  ): Promise<void> {
    const cfg = await this.config.getByTenantId(tenantId);
    const rules = cfg.automations.filter((r) => r.active && r.trigger === trigger);
    for (const rule of rules) {
      try {
        await this.executeRule(tenantId, rule, ctx);
      } catch (err) {
        this.logger.warn(
          `Automação ${rule.id} (${trigger}): ${err instanceof Error ? err.message : "erro"}`,
        );
      }
    }
  }

  private async executeRule(
    tenantId: string,
    rule: CrmAutomationRule,
    ctx: Record<string, string>,
  ): Promise<void> {
    if (rule.action === "WEBHOOK") {
      const event = rule.trigger === "LEAD_CREATED" ? "lead.created" : "proposta.sent";
      await this.webhooks.emit(tenantId, event, { ...ctx, automationId: rule.id });
      return;
    }

    if (rule.trigger === "LEAD_CREATED" && ctx.leadId) {
      const lead = await this.prisma.leadComercial.findFirst({
        where: { id: ctx.leadId, tenantId },
      });
      if (!lead) return;

      if (rule.action === "CREATE_NOTA" && lead.entidadeClienteId) {
        const admin = await this.firstComercialUser(tenantId);
        if (!admin) return;
        await this.interaccoes.create(
          {
            sub: admin.id,
            email: admin.email,
            kind: "tenant",
            role: "comercial",
            tenantId,
            tenantSlug: null,
          },
          {
            entidadeClienteId: lead.entidadeClienteId,
            leadComercialId: lead.id,
            tipo: "OUTRO",
            titulo: `Automação: ${rule.name}`,
            notasLivres: `Lead ${lead.codigo} criado - follow-up automático.`,
          },
        );
      }

      if (rule.action === "CREATE_SUGESTAO" && lead.entidadeClienteId) {
        const admin = await this.firstComercialUser(tenantId);
        if (!admin) return;
        await this.sugestoes.gerarSugestoesProactivas(
          {
            sub: admin.id,
            email: admin.email,
            kind: "tenant",
            role: "comercial",
            tenantId,
            tenantSlug: null,
          },
          lead.entidadeClienteId,
        );
      }
    }
  }

  async processStaleLeads(): Promise<number> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true },
    });
    let processed = 0;

    for (const tenant of tenants) {
      const cfg = await this.config.getByTenantId(tenant.id);
      const staleRules = cfg.automations.filter((r) => r.active && r.trigger === "LEAD_STALE");
      if (!staleRules.length) continue;

      for (const rule of staleRules) {
        const days = rule.daysAfter ?? 7;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const leads = await this.prisma.leadComercial.findMany({
          where: {
            tenantId: tenant.id,
            estado: { in: ["NOVO", "CONTACTADO", "QUALIFICADO"] },
            updatedAt: { lt: cutoff },
          },
          take: 20,
          select: { id: true },
        });

        for (const lead of leads) {
          await this.executeRule(tenant.id, rule, { leadId: lead.id });
          processed++;
        }
      }
    }

    return processed;
  }

  private firstComercialUser(tenantId: string) {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        active: true,
        role: { in: ["ADMIN", "COORDENADOR", "COMERCIAL"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, displayName: true },
    });
  }
}
