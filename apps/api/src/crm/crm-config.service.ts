import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import type { CrmTenantConfig } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../common/tenant-scope";
import type { RequestUser } from "../auth/types/access-token-payload";

const EMPTY: CrmTenantConfig = {
  customFieldDefs: [],
  outboundWebhooks: [],
  automations: [],
};

function parseCrmConfig(metadata: unknown): CrmTenantConfig {
  if (!metadata || typeof metadata !== "object") return { ...EMPTY };
  const crm = (metadata as Record<string, unknown>).crm;
  if (!crm || typeof crm !== "object") return { ...EMPTY };
  const c = crm as Record<string, unknown>;
  return {
    customFieldDefs: Array.isArray(c.customFieldDefs) ? (c.customFieldDefs as CrmTenantConfig["customFieldDefs"]) : [],
    leadWebhookSecret: typeof c.leadWebhookSecret === "string" ? c.leadWebhookSecret : undefined,
    outboundWebhooks: Array.isArray(c.outboundWebhooks) ? (c.outboundWebhooks as CrmTenantConfig["outboundWebhooks"]) : [],
    automations: Array.isArray(c.automations) ? (c.automations as CrmTenantConfig["automations"]) : [],
    emailSync:
      c.emailSync && typeof c.emailSync === "object"
        ? (c.emailSync as CrmTenantConfig["emailSync"])
        : undefined,
  };
}

@Injectable()
export class CrmConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: RequestUser): Promise<CrmTenantConfig & { tenantSlug: string }> {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, metadata: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");
    return { ...parseCrmConfig(tenant.metadata), tenantSlug: tenant.slug };
  }

  async update(user: RequestUser, patch: Partial<CrmTenantConfig>): Promise<CrmTenantConfig> {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");
    const current = parseCrmConfig(tenant.metadata);
    const next: CrmTenantConfig = {
      customFieldDefs: patch.customFieldDefs ?? current.customFieldDefs,
      leadWebhookSecret: patch.leadWebhookSecret ?? current.leadWebhookSecret,
      outboundWebhooks: patch.outboundWebhooks ?? current.outboundWebhooks,
      automations: patch.automations ?? current.automations,
      emailSync: patch.emailSync ?? current.emailSync,
    };
    const metadata = {
      ...(typeof tenant.metadata === "object" && tenant.metadata ? tenant.metadata : {}),
      crm: next,
    };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata },
    });
    return next;
  }

  async getByTenantId(tenantId: string): Promise<CrmTenantConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) return { ...EMPTY };
    return parseCrmConfig(tenant.metadata);
  }

  async rotateLeadWebhookSecret(user: RequestUser): Promise<{ leadWebhookSecret: string }> {
    const secret = randomBytes(24).toString("hex");
    await this.update(user, { leadWebhookSecret: secret });
    return { leadWebhookSecret: secret };
  }
}
