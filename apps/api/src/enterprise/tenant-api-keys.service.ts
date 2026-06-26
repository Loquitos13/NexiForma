import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

@Injectable()
export class TenantApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async list(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const rows = await this.prisma.tenantSubscriptionKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
        rotatedAt: true,
      },
    });
    return rows;
  }

  async create(user: RequestUser, opts?: { expiresInDays?: number }) {
    const tenantId = requireTenantId(user);

    const active = await this.prisma.tenantSubscriptionKey.findFirst({
      where: { tenantId, status: "ACTIVE" },
    });
    if (active) {
      throw new BadRequestException(
        "Já existe chave API activa - revogue-a antes de criar uma nova.",
      );
    }

    const prefix = "nf_live_";
    const secret = randomBytes(24).toString("base64url");
    const pepper = this.config.get<string>("SUBSCRIPTION_KEY_PEPPER") ?? "";
    const keyHash = createHash("sha256")
      .update(`${prefix}${secret}${pepper}`)
      .digest("hex");

    const expiresAt = opts?.expiresInDays
      ? new Date(Date.now() + opts.expiresInDays * 86_400_000)
      : null;

    const row = await this.prisma.tenantSubscriptionKey.create({
      data: {
        tenantId,
        keyPrefix: prefix,
        keyHash,
        expiresAt,
      },
    });

    await this.audit.log({
      actorType: "TENANT_USER",
      actorId: user.sub,
      action: "api_key.create",
      resourceType: "tenant_subscription_key",
      resourceId: row.id,
      targetTenantId: tenantId,
    });

    return {
      id: row.id,
      key: `${prefix}${secret}`,
      expiresAt: row.expiresAt,
      warning: "Guarde a chave - não será mostrada novamente.",
    };
  }

  async revoke(user: RequestUser, keyId: string) {
    const tenantId = requireTenantId(user);
    const key = await this.prisma.tenantSubscriptionKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!key) {
      throw new NotFoundException("Chave API não encontrada.");
    }
    if (key.status === "REVOKED") {
      return { id: key.id, status: key.status };
    }

    const updated = await this.prisma.tenantSubscriptionKey.update({
      where: { id: keyId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    await this.audit.log({
      actorType: "TENANT_USER",
      actorId: user.sub,
      action: "api_key.revoke",
      resourceType: "tenant_subscription_key",
      resourceId: keyId,
      targetTenantId: tenantId,
    });

    return { id: updated.id, status: updated.status, revokedAt: updated.revokedAt };
  }
}
