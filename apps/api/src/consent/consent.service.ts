import {

  ForbiddenException,

  Injectable,

} from "@nestjs/common";

import {

  RGPD_TERMS_VERSION,

  buildRgpdConsentText,

  consentRequiresDecision,

} from "@nexiforma/shared";

import { PrismaService } from "../prisma/prisma.service";

import type { RequestUser } from "../auth/types/access-token-payload";

import { requireTenantId } from "../common/tenant-scope";

import type { UpdateConsentDto } from "./consent.dto";



@Injectable()

export class ConsentService {

  constructor(private readonly prisma: PrismaService) {}



  private isExempt(user: RequestUser): boolean {

    return user.role === "super_admin" && user.kind === "platform";

  }



  async getMe(user: RequestUser) {

    if (this.isExempt(user)) {

      return { exempt: true, required: false };

    }



    const tenantId = requireTenantId(user);

    const tenant = await this.prisma.tenant.findUnique({

      where: { id: tenantId },

      select: { legalName: true, slug: true },

    });



    const row = await this.prisma.rgpdConsent.findUnique({

      where: { userId: user.sub },

    });



    const required = consentRequiresDecision(row?.userAccepted ?? null, row?.termsVersion);



    return {

      exempt: false,

      required,

      termsVersion: RGPD_TERMS_VERSION,

      consentText: buildRgpdConsentText(tenant?.legalName ?? "a entidade formadora"),

      tenantLegalName: tenant?.legalName ?? null,

      userAccepted: row?.userAccepted ?? null,

      userDecidedAt: row?.userDecidedAt ?? null,

    };

  }



  async updateMe(user: RequestUser, dto: UpdateConsentDto) {

    if (this.isExempt(user)) {

      throw new ForbiddenException("Super administrador isento de consentimento RGPD.");

    }



    const tenantId = requireTenantId(user);

    const now = new Date();



    const row = await this.prisma.rgpdConsent.upsert({

      where: { userId: user.sub },

      create: {

        tenantId,

        userId: user.sub,

        termsVersion: RGPD_TERMS_VERSION,

        userAccepted: dto.accepted,

        userDecidedAt: now,

      },

      update: {

        termsVersion: RGPD_TERMS_VERSION,

        userAccepted: dto.accepted,

        userDecidedAt: now,

      },

    });



    return {

      userAccepted: row.userAccepted,

      userDecidedAt: row.userDecidedAt,

      required: false,

    };

  }



  async listForTenant(user: RequestUser) {

    const tenantId = requireTenantId(user);

    if (user.role !== "tenant_manager") {

      throw new ForbiddenException("Apenas gestores do tenant.");

    }



    const rows = await this.prisma.rgpdConsent.findMany({

      where: { tenantId },

      orderBy: { updatedAt: "desc" },

      include: {

        user: {

          select: { id: true, email: true, displayName: true, role: true, active: true },

        },

      },

    });



    return rows.map((r) => ({

      id: r.id,

      userId: r.userId,

      email: r.user.email,

      displayName: r.user.displayName,

      role: r.user.role,

      active: r.user.active,

      termsVersion: r.termsVersion,

      userAccepted: r.userAccepted,

      userDecidedAt: r.userDecidedAt,

      updatedAt: r.updatedAt,

    }));

  }



  async listPlatform(user: RequestUser, tenantId?: string) {

    if (user.role !== "super_admin" || user.kind !== "platform") {

      throw new ForbiddenException("Apenas super administrador.");

    }



    const rows = await this.prisma.rgpdConsent.findMany({

      where: tenantId ? { tenantId } : {},

      orderBy: { updatedAt: "desc" },

      take: 500,

      include: {

        user: {

          select: { id: true, email: true, displayName: true, role: true, active: true },

        },

        tenant: { select: { id: true, slug: true, legalName: true } },

      },

    });



    return rows.map((r) => ({

      id: r.id,

      tenantId: r.tenantId,

      tenantSlug: r.tenant.slug,

      tenantLegalName: r.tenant.legalName,

      userId: r.userId,

      email: r.user.email,

      displayName: r.user.displayName,

      role: r.user.role,

      active: r.user.active,

      termsVersion: r.termsVersion,

      userAccepted: r.userAccepted,

      userDecidedAt: r.userDecidedAt,

      updatedAt: r.updatedAt,

    }));

  }

}


