import { randomUUID } from "crypto";
import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import type { AccessTokenPayload } from "../auth/types/access-token-payload";
import { AuditService } from "../audit/audit.service";
import { AuthService, type LoginResponse } from "../auth/auth.service";
import type { ImpersonateDto } from "./dto/control-plane.dto";

function mapPrismaRoleToJwt(role: string): RequestUser["role"] {
  switch (role) {
    case "ADMIN":
    case "COORDENADOR":
    case "FINANCEIRO":
      return "tenant_manager";
    case "FORMADOR":
      return "formador";
    default:
      return "formando";
  }
}

@Injectable()
export class ImpersonationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async startImpersonation(
    actor: RequestUser,
    tenantId: string,
    dto: ImpersonateDto,
    res?: Response,
    actorIp?: string,
  ): Promise<LoginResponse & { impersonationSessionId: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const target = await this.prisma.user.findFirst({
      where: { id: dto.targetUserId, tenantId, active: true },
      include: { tenant: true },
    });
    if (!target) {
      throw new NotFoundException("Utilizador alvo não encontrado neste tenant.");
    }

    const jwtJti = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const auditRow = await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "impersonation.start",
      resourceType: "user",
      resourceId: target.id,
      targetTenantId: tenantId,
      targetUserId: target.id,
      payload: { reason: dto.reason, readOnly: dto.readOnly ?? true },
    });

    const session = await this.prisma.impersonationSession.create({
      data: {
        tenantId,
        targetUserId: target.id,
        superAdminId: actor.sub,
        reason: dto.reason.trim(),
        jwtJti,
        readOnly: dto.readOnly ?? true,
        expiresAt,
        auditLogId: BigInt(String(auditRow.id)),
      },
    });

    const payload: AccessTokenPayload = {
      sub: target.id,
      email: target.email,
      kind: "tenant",
      role: mapPrismaRoleToJwt(target.role),
      tenantId: target.tenantId,
      tenantSlug: target.tenant.slug,
      impersonating: true,
      impersonationSessionId: session.id,
      readOnlyImpersonation: session.readOnly,
      jwtJti,
    };

    const login = await this.auth.completeLoginWithPayload(payload, res);
    return { ...login, impersonationSessionId: session.id };
  }
}
