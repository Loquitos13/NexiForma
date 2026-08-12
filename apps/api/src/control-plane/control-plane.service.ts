import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import * as argon2 from "argon2";
import type { ControlTenantStatus, TenantUserRole } from "@nexiforma/database";
import {
  assertValidTenantSubscription,
  mergeTenantLoginLockoutMetadata,
  parseTenantLoginLockoutConfig,
  resolvedPolicyToMinutes,
  TenantSubscriptionValidationError,
  type BillingPlanCode,
  type TenantLoginLockoutConfig,
} from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { LoginAttemptLimiterService } from "../auth/login-attempt-limiter.service";
import { EmailConfirmationService } from "../auth/email-confirmation.service";
import {
  globalLoginLockoutDefaults,
  resolveTenantLoginLockoutPolicy,
} from "../auth/login-lockout-policy.util";
import { AuditService } from "../audit/audit.service";
import { PlatformTenantNotificacoesService } from "../notificacoes/platform-tenant-notificacoes.service";
import {
  hashInviteToken,
  invitePepperFromConfig,
  newInviteOpaqueToken,
} from "../common/invite-token.util";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";
import { upsertFormandoProfileForInvite } from "../common/formando-user-link.util";
import { readTenantLogoStorageKey } from "../auth/tenant-branding.util";
import { FATURACAO_HISTORICO_IMUTAVEL_MSG } from "../faturas/faturacao-historico.util";
import { StorageService } from "../storage/storage.service";
import { encryptIpWithSecret, isPrivateOrInternalIp, maskPublicIp } from "../common/ip-encryption.util";
import type {
  CreateSubscriptionKeyDto,
  CreateTenantDto,
  CreateTenantUserDto,
  InviteManagerDto,
  SetTenantManagerDto,
  UpdateTenantDto,
  UpdateTenantSubscriptionDto,
  UpdatePlatformMeDto,
  UpdateTenantLoginLockoutDto,
} from "./dto/control-plane.dto";

type TenantBrandingMeta = {
  branding?: {
    logoUrl?: string;
    logoStorageKey?: string;
    companyName?: string;
  };
  [key: string]: unknown;
};

function generateTempManagerPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let pwd = "";
  const bytes = randomBytes(10);
  for (let i = 0; i < 10; i++) {
    pwd += chars[bytes[i] % chars.length];
  }
  return pwd + "!9A";
}

@Injectable()
export class ControlPlaneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly tenantNotificacoes: PlatformTenantNotificacoesService,
    private readonly loginAttempts: LoginAttemptLimiterService,
    private readonly emailConfirmation: EmailConfirmationService,
    private readonly storage: StorageService,
  ) {}

  private invitePepper(): string {
    return invitePepperFromConfig(
      (k) => this.config.get<string>(k),
      (k) => this.config.getOrThrow<string>(k),
    );
  }

  private async createManagerInvite(
    tenantId: string,
    email: string,
    displayName: string,
    invitedById: string,
    appUrl: string,
  ): Promise<{ inviteUrl: string; expiresAt: Date }> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: normalized },
    });
    if (existing) {
      throw new ConflictException("Já existe utilizador gestor com este email neste tenant.");
    }

    const rawToken = newInviteOpaqueToken();
    const tokenHash = hashInviteToken(this.invitePepper(), rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.tenantInvite.upsert({
      where: { tenantId_email: { tenantId, email: normalized } },
      create: {
        tenantId,
        email: normalized,
        displayName: displayName.trim() || "Gestor",
        role: "ADMIN",
        tokenHash,
        expiresAt,
        invitedById,
      },
      update: {
        displayName: displayName.trim() || "Gestor",
        role: "ADMIN",
        tokenHash,
        expiresAt,
        acceptedAt: null,
        invitedById,
      },
    });

    const inviteUrl = `${appUrl.replace(/\/$/, "")}/convite/${rawToken}`;
    return { inviteUrl, expiresAt };
  }

  listTenants(): Promise<Record<string, unknown>[]> {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        legalName: true,
        nif: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            acoesFormacao: true,
            matriculas: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            currentPeriodEnd: true,
            customAddons: true,
            plan: { select: { code: true, name: true } },
          },
        },
      },
    });
  }

  listSubscriptionPlans(): Promise<Record<string, unknown>[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { priceCentsMonthly: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        priceCentsMonthly: true,
        maxActiveUsers: true,
        features: true,
      },
    });
  }

  async getTenant(id: string): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        legalName: true,
        nif: true,
        status: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            acoesFormacao: true,
            formandos: true,
            sessoesFormacao: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { plan: true },
        },
        subscriptionKeys: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            keyPrefix: true,
            status: true,
            expiresAt: true,
            createdAt: true,
            rotatedAt: true,
            revokedAt: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }
    const meta = (tenant.metadata ?? {}) as TenantBrandingMeta;
    const hasLogo = Boolean(readTenantLogoStorageKey(tenant.metadata));
    return {
      ...tenant,
      branding: {
        ...(meta.branding ?? {}),
        companyName: meta.branding?.companyName ?? tenant.legalName,
        logoUrl: hasLogo ? `/api/v1/control-plane/tenants/${id}/logo` : meta.branding?.logoUrl,
        hasLogo,
      },
    };
  }

  async uploadTenantLogo(
    actor: RequestUser,
    tenantId: string,
    file: Express.Multer.File,
    actorIp?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, legalName: true, metadata: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");
    if (!file?.buffer?.length) {
      throw new BadRequestException("Ficheiro de logo em falta.");
    }
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException("Formato inválido. Use PNG, JPEG, WebP ou SVG.");
    }

    const ext =
      file.mimetype === "image/png"
        ? "png"
        : file.mimetype === "image/jpeg"
          ? "jpg"
          : file.mimetype === "image/webp"
            ? "webp"
            : "svg";
    const key = `tenants/${tenantId}/logo.${ext}`;
    await this.storage.putObject(key, file.buffer, file.mimetype);

    const meta = (tenant.metadata ?? {}) as TenantBrandingMeta;
    const next: TenantBrandingMeta = {
      ...meta,
      branding: {
        ...(meta.branding ?? {}),
        logoStorageKey: key,
        logoUrl: `/api/v1/portal/tenant/logo`,
        companyName: meta.branding?.companyName ?? tenant.legalName,
      },
    };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next as object },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.logo_upload",
      resourceType: "tenant",
      resourceId: tenantId,
      targetTenantId: tenantId,
      payload: { logoStorageKey: key, contentType: file.mimetype },
    });

    return {
      sucesso: true,
      logoUrl: `/api/v1/control-plane/tenants/${tenantId}/logo`,
      logoStorageKey: key,
    };
  }

  async streamTenantLogo(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");
    const key = readTenantLogoStorageKey(tenant.metadata);
    if (!key) return null;
    return this.storage.getObject(key);
  }

  async getTenantLoginLockout(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, metadata: true },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const platformDefaults = globalLoginLockoutDefaults();
    const config = parseTenantLoginLockoutConfig(tenant.metadata);
    const effective = resolvedPolicyToMinutes(resolveTenantLoginLockoutPolicy(tenant.metadata));

    return {
      config,
      effective,
      platformDefaults,
    };
  }

  async updateTenantLoginLockout(
    actor: RequestUser,
    id: string,
    dto: UpdateTenantLoginLockoutDto,
    actorIp?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const patch: TenantLoginLockoutConfig = {};
    if (dto.enabled !== undefined) patch.enabled = dto.enabled;
    if (dto.maxAttempts !== undefined) patch.maxAttempts = dto.maxAttempts;
    if (dto.windowMinutes !== undefined) patch.windowMinutes = dto.windowMinutes;
    if (dto.lockoutMinutes !== undefined) patch.lockoutMinutes = dto.lockoutMinutes;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException("Indique pelo menos um campo de lockout.");
    }

    const metadata = mergeTenantLoginLockoutMetadata(tenant.metadata, patch);
    await this.prisma.tenant.update({
      where: { id },
      data: { metadata: metadata as object },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.login_lockout_update",
      resourceType: "tenant",
      resourceId: id,
      targetTenantId: id,
      payload: {
        from: parseTenantLoginLockoutConfig(tenant.metadata),
        to: parseTenantLoginLockoutConfig(metadata),
      },
    });

    return this.getTenantLoginLockout(id);
  }

  async clearTenantLoginLockout(
    actor: RequestUser,
    id: string,
    email: string,
    actorIp?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const loginKey = `${tenant.slug}:${normalizedEmail}`;
    await this.loginAttempts.clear("tenant", loginKey);

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.login_lockout_clear",
      resourceType: "tenant",
      resourceId: id,
      targetTenantId: id,
      payload: { email: normalizedEmail },
    });

    return { ok: true as const };
  }

  async listTenantUsers(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }
    return this.prisma.user.findMany({
      where: { tenantId, active: true },
      orderBy: [{ role: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });
  }

  async createTenantUser(
    actor: RequestUser,
    tenantId: string,
    dto: CreateTenantUserDto,
    actorIp?: string,
    req?: { headers: Record<string, string | string[] | undefined> },
  ): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, slug: true, legalName: true } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const email = dto.email.trim().toLowerCase();
    const role: TenantUserRole = dto.role;
    const displayName = dto.displayName?.trim() || email.split("@")[0] || "Utilizador";
    const tempPassword = dto.temporaryPassword?.trim() || randomBytes(12).toString("base64url").slice(0, 12) + "!A1";

    if (tempPassword.length < 8) {
      throw new BadRequestException("Password temporária: mínimo 8 caracteres.");
    }

    if (role === "FORMANDO" || role === "FORMADOR") {
      const nif = (dto.nif ?? "").trim();
      if (!/^\d{9}$/.test(nif)) {
        throw new BadRequestException("NIF obrigatório (9 dígitos) para este cargo.");
      }
    }

    let existing = await this.prisma.user.findFirst({ where: { tenantId, email } });

    if (existing?.active) {
      throw new ConflictException("Já existe utilizador activo com este email no tenant.");
    }

    const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

    if (existing) {
      existing = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName,
          role,
          passwordHash,
          active: true,
          mustChangePassword: true,
          emailVerifiedAt: new Date(),
        },
      });
    } else {
      existing = await this.prisma.user.create({
        data: {
          tenantId,
          email,
          displayName,
          role,
          passwordHash,
          active: true,
          mustChangePassword: true,
          emailVerifiedAt: new Date(),
        },
      });
    }

    await this.prisma.tenantInvite.deleteMany({ where: { tenantId, email } }).catch(() => undefined);

    if (role === "FORMANDO") {
      const nif = (dto.nif ?? "").trim();
      await upsertFormandoProfileForInvite(this.prisma, tenantId, {
        email,
        displayName,
        nif,
        telefone: dto.telefone?.trim() || undefined,
        userId: existing.id,
      });
    }

    if (role === "FORMADOR") {
      const nif = (dto.nif ?? "").trim();
      const existingProfile = await this.prisma.formadorProfile.findFirst({ where: { tenantId, userId: existing.id } });
      if (existingProfile) {
        await this.prisma.formadorProfile.update({
          where: { id: existingProfile.id },
          data: { nif, email, nomeCompleto: displayName },
        });
      } else {
        const duplicate = await this.prisma.formadorProfile.findFirst({ where: { tenantId, nif } });
        if (duplicate) {
          throw new ConflictException("Já existe formador com este NIF no tenant.");
        }
        await this.prisma.formadorProfile.create({
          data: { tenantId, userId: existing.id, nif, email, nomeCompleto: displayName },
        });
      }
    }

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.user_create_direct",
      resourceType: "user",
      resourceId: existing.id,
      targetTenantId: tenantId,
      targetUserId: existing.id,
      payload: {
        email,
        displayName,
        role,
        createdWithoutInvite: true,
      },
    });

    if (dto.notifyEmail !== false) {
      void this.tenantNotificacoes
        .enviarCredenciaisTemporariasGestor({
          email,
          displayName,
          entidadeFormadora: tenant.legalName,
          slug: tenant.slug,
          temporaryPassword: tempPassword,
        })
        .catch(() => undefined);
    }

    return {
      ok: true,
      userId: existing.id,
      email,
      displayName,
      role,
      tenantSlug: tenant.slug,
      temporaryPassword: tempPassword,
      emailed: dto.notifyEmail !== false,
    };
  }

  async updateTenantStatus(
    actor: RequestUser,
    id: string,
    status: ControlTenantStatus,
    actorIp?: string,
  ): Promise<Record<string, unknown>> {
    return this.updateTenant(actor, id, { status }, actorIp);
  }

  async createTenant(
    actor: RequestUser,
    dto: CreateTenantDto,
    actorIp?: string,
    req?: { headers: Record<string, string | string[] | undefined> },
  ): Promise<Record<string, unknown>> {
    const slug = dto.slug.trim().toLowerCase();
    const nif = dto.nif.trim();
    const planCode = (dto.planCode ?? "starter") as BillingPlanCode;

    let customAddons: string[];
    try {
      customAddons = assertValidTenantSubscription(planCode, dto.customAddons ?? []);
    } catch (e) {
      if (e instanceof TenantSubscriptionValidationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const [slugClash, nifClash, plan] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { slug } }),
      this.prisma.tenant.findUnique({ where: { nif } }),
      this.prisma.subscriptionPlan.findFirst({ where: { code: planCode, active: true } }),
    ]);
    if (slugClash) {
      throw new ConflictException("Slug de tenant já existe.");
    }
    if (nifClash) {
      throw new ConflictException("NIF já registado noutro tenant.");
    }
    if (!plan) {
      throw new BadRequestException(`Plano «${planCode}» não encontrado ou inactivo.`);
    }

    if (dto.managerEmail && dto.managerPassword && dto.managerPassword.length < 8) {
      throw new BadRequestException("Password do gestor: mínimo 8 caracteres.");
    }

    const managerEmail = dto.managerEmail?.trim().toLowerCase();
    const managerDisplayName = dto.managerDisplayName?.trim() || "Gestor";
    const managerTempPassword =
      managerEmail && !dto.managerPassword ? generateTempManagerPassword() : undefined;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const row = await tx.tenant.create({
        data: {
          slug,
          legalName: dto.legalName.trim(),
          nif,
          status: dto.status ?? "TRIAL",
        },
      });

      await tx.tenantSubscription.create({
        data: {
          tenantId: row.id,
          planId: plan.id,
          status: "TRIALING",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          billingEmail: dto.billingEmail?.trim() || managerEmail || null,
          customAddons,
        },
      });

      if (managerEmail) {
        const rawPassword = dto.managerPassword || managerTempPassword!;
        const passwordHash = await argon2.hash(rawPassword, { type: argon2.argon2id });
        await tx.user.create({
          data: {
            tenantId: row.id,
            email: managerEmail,
            passwordHash,
            displayName: managerDisplayName,
            role: "ADMIN",
            active: true,
            mustChangePassword: Boolean(managerTempPassword),
            emailVerifiedAt: managerTempPassword ? new Date() : null,
          },
        });
      }

      return { row };
    });

    const tenantRow = tenant.row;

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.create",
      resourceType: "tenant",
      resourceId: tenantRow.id,
      targetTenantId: tenantRow.id,
      payload: {
        slug,
        planCode,
        customAddons,
        managerEmail: managerEmail ?? null,
        managerHasTempPassword: Boolean(managerTempPassword),
      },
    });

    void this.tenantNotificacoes
      .notificarSuperadminsTenantLifecycle({
        acao: "criado",
        tenant: {
          id: tenantRow.id,
          slug: tenantRow.slug,
          legalName: tenantRow.legalName,
          nif: tenantRow.nif,
          status: tenantRow.status,
        },
        actorEmail: actor.email,
        detalhe: `Plano: ${plan.name} (${planCode})${customAddons.length ? `\nMódulos: ${customAddons.join(", ")}` : ""}${managerEmail ? `\nGestor inicial: ${managerEmail}${managerTempPassword ? " (credenciais temporárias)" : ""}` : ""}`,
      })
      .catch(() => undefined);

    if (managerEmail && dto.managerPassword) {
      void this.tenantNotificacoes
        .enviarBoasVindasGestor({
          email: managerEmail,
          displayName: managerDisplayName,
          entidadeFormadora: tenantRow.legalName,
          slug: tenantRow.slug,
        })
        .catch(() => undefined);
      void this.prisma.user
        .findFirst({
          where: { tenantId: tenantRow.id, email: managerEmail },
          select: { id: true },
        })
        .then((u) => (u ? this.emailConfirmation.issueForUser(u.id, req) : null))
        .catch(() => undefined);
    } else if (managerEmail && managerTempPassword) {
      void this.tenantNotificacoes
        .enviarCredenciaisTemporariasGestor({
          email: managerEmail,
          displayName: managerDisplayName,
          entidadeFormadora: tenantRow.legalName,
          slug: tenantRow.slug,
          temporaryPassword: managerTempPassword,
        })
        .catch(() => undefined);
    }

    const tenantDetail = await this.getTenant(tenantRow.id);
    return {
      ...tenantDetail,
      ...(managerTempPassword ? { managerTemporaryPassword: managerTempPassword } : {}),
    };
  }

  async setTenantManager(
    actor: RequestUser,
    tenantId: string,
    dto: SetTenantManagerDto,
    actorIp?: string,
    req?: { headers: Record<string, string | string[] | undefined> },
  ): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName?.trim() || "Gestor";
    const tempPassword = dto.temporaryPassword?.trim() || generateTempManagerPassword();
    if (tempPassword.length < 8) {
      throw new BadRequestException("Password temporária: mínimo 8 caracteres.");
    }

    const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId, email },
    });

    let targetUserId: string;
    if (existingUser) {
      const updated = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: "ADMIN",
          passwordHash,
          mustChangePassword: true,
          active: true,
          ...(dto.displayName?.trim() ? { displayName: dto.displayName.trim() } : {}),
        },
      });
      targetUserId = updated.id;
    } else {
      const created = await this.prisma.user.create({
        data: {
          tenantId,
          email,
          displayName,
          role: "ADMIN",
          passwordHash,
          mustChangePassword: true,
          active: true,
          emailVerifiedAt: new Date(),
        },
      });
      targetUserId = created.id;
    }

    // Limpa eventuais convites pendentes para este email
    await this.prisma.tenantInvite
      .deleteMany({
        where: { tenantId, email },
      })
      .catch(() => undefined);

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.set_manager",
      resourceType: "tenant",
      resourceId: tenantId,
      targetTenantId: tenantId,
      targetUserId,
      payload: {
        email,
        slug: tenant.slug,
        isNewUser: !existingUser,
        forceChangeOnLogin: true,
      },
    });

    if (dto.notifyEmail !== false) {
      void this.tenantNotificacoes
        .enviarCredenciaisTemporariasGestor({
          email,
          displayName: dto.displayName?.trim() || existingUser?.displayName || displayName,
          entidadeFormadora: tenant.legalName,
          slug: tenant.slug,
          temporaryPassword: tempPassword,
        })
        .catch(() => undefined);
    }

    return {
      ok: true,
      userId: targetUserId,
      email,
      displayName: dto.displayName?.trim() || existingUser?.displayName || displayName,
      slug: tenant.slug,
      temporaryPassword: tempPassword,
    };
  }

  async inviteTenantManager(
    actor: RequestUser,
    tenantId: string,
    dto: InviteManagerDto,
    actorIp?: string,
    req?: { headers: Record<string, string | string[] | undefined> },
  ): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName?.trim() || "Gestor";
    const appUrl = resolveAppPublicUrlForLinks(this.config, req);
    const { inviteUrl } = await this.createManagerInvite(
      tenantId,
      email,
      displayName,
      actor.sub,
      appUrl,
    );

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.manager_invite",
      resourceType: "tenant",
      resourceId: tenantId,
      targetTenantId: tenantId,
      payload: { email, slug: tenant.slug },
    });

    void this.tenantNotificacoes
      .enviarConviteGestor({
        email,
        displayName,
        entidadeFormadora: tenant.legalName,
        slug: tenant.slug,
        inviteUrl,
      })
      .catch(() => undefined);

    const isDev = this.config.get<string>("NODE_ENV") !== "production";
    return {
      ok: true,
      email,
      slug: tenant.slug,
      inviteUrl: isDev ? inviteUrl : undefined,
    };
  }

  async updateTenantSubscription(
    actor: RequestUser,
    tenantId: string,
    dto: UpdateTenantSubscriptionDto,
    actorIp?: string,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const planCode = dto.planCode as BillingPlanCode;
    let customAddons: string[];
    try {
      customAddons = assertValidTenantSubscription(planCode, dto.customAddons ?? []);
    } catch (e) {
      if (e instanceof TenantSubscriptionValidationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: planCode, active: true },
    });
    if (!plan) {
      throw new BadRequestException(`Plano «${planCode}» não encontrado ou inactivo.`);
    }

    const sub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) {
      throw new NotFoundException("Subscrição do tenant não encontrada.");
    }

    await this.prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id,
        customAddons,
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.subscription_update",
      resourceType: "tenant_subscription",
      resourceId: sub.id,
      targetTenantId: tenantId,
      payload: { planCode, customAddons, status: dto.status ?? sub.status },
    });

    void this.tenantNotificacoes
      .notificarSuperadminsTenantLifecycle({
        acao: "actualizado",
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          legalName: tenant.legalName,
          nif: tenant.nif,
          status: tenant.status,
        },
        actorEmail: actor.email,
        detalhe: `Subscrição: ${plan.name} (${planCode})${customAddons.length ? `\nMódulos: ${customAddons.join(", ")}` : ""}`,
      })
      .catch(() => undefined);

    return this.getTenant(tenantId);
  }

  async updateTenant(
    actor: RequestUser,
    id: string,
    dto: UpdateTenantDto,
    actorIp?: string,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const slug = dto.slug?.trim().toLowerCase();
    const nif = dto.nif?.trim();

    if (slug && slug !== tenant.slug) {
      const clash = await this.prisma.tenant.findUnique({ where: { slug } });
      if (clash) {
        throw new ConflictException("Slug de tenant já existe.");
      }
    }
    if (nif && nif !== tenant.nif) {
      const clash = await this.prisma.tenant.findUnique({ where: { nif } });
      if (clash) {
        throw new ConflictException("NIF já registado noutro tenant.");
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(slug ? { slug } : {}),
        ...(dto.legalName !== undefined ? { legalName: dto.legalName.trim() } : {}),
        ...(nif ? { nif } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata as object } : {}),
      },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: dto.status !== undefined && Object.keys(dto).length === 1 ? "tenant.status_update" : "tenant.update",
      resourceType: "tenant",
      resourceId: id,
      targetTenantId: id,
      payload: {
        from: { slug: tenant.slug, status: tenant.status },
        to: { slug: updated.slug, status: updated.status },
      },
    });

    const alteracoes: string[] = [];
    if (slug && slug !== tenant.slug) alteracoes.push(`Slug: ${tenant.slug} → ${slug}`);
    if (dto.legalName !== undefined && dto.legalName.trim() !== tenant.legalName) {
      alteracoes.push(`Entidade: ${tenant.legalName} → ${dto.legalName.trim()}`);
    }
    if (nif && nif !== tenant.nif) alteracoes.push(`NIF: ${tenant.nif} → ${nif}`);
    if (dto.status !== undefined && dto.status !== tenant.status) {
      alteracoes.push(`Estado: ${tenant.status} → ${dto.status}`);
    }
    if (dto.metadata !== undefined) alteracoes.push("Metadata actualizado");

    void this.tenantNotificacoes
      .notificarSuperadminsTenantLifecycle({
        acao: "actualizado",
        tenant: {
          id: updated.id,
          slug: updated.slug,
          legalName: updated.legalName,
          nif: updated.nif,
          status: updated.status,
        },
        actorEmail: actor.email,
        detalhe: alteracoes.length ? alteracoes.join("\n") : "Dados actualizados",
      })
      .catch(() => undefined);

    return updated;
  }

  async deleteTenant(
    actor: RequestUser,
    id: string,
    opts?: { permanent?: boolean },
    actorIp?: string,
  ): Promise<{ ok: true; mode: "archived" | "deleted" }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            acoesFormacao: true,
            formandos: true,
            cursos: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    if (opts?.permanent) {
      const hasData =
        tenant._count.users > 0 ||
        tenant._count.acoesFormacao > 0 ||
        tenant._count.formandos > 0 ||
        tenant._count.cursos > 0;
      if (hasData) {
        throw new BadRequestException(
          "Tenant com dados operacionais - arquive primeiro ou remova dados antes de eliminar permanentemente.",
        );
      }
      const [faturasHist, seriesHist] = await Promise.all([
        this.prisma.faturaComercial.count({ where: { tenantId: id } }),
        this.prisma.serieFaturacao.count({ where: { tenantId: id } }),
      ]);
      if (faturasHist > 0 || seriesHist > 0) {
        throw new BadRequestException(
          `${FATURACAO_HISTORICO_IMUTAVEL_MSG} Este tenant tem histórico de faturação (${faturasHist} documento(s), ${seriesHist} série(s)) e não pode ser eliminado.`,
        );
      }
      await this.prisma.tenant.delete({ where: { id } });
      await this.audit.log({
        actorType: "SUPERADMIN_USER",
        actorId: actor.sub,
        actorIp,
        action: "tenant.delete_permanent",
        resourceType: "tenant",
        resourceId: id,
        targetTenantId: id,
        payload: { slug: tenant.slug },
      });

      void this.tenantNotificacoes
        .notificarSuperadminsTenantLifecycle({
          acao: "eliminado",
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            legalName: tenant.legalName,
            nif: tenant.nif,
            status: tenant.status,
          },
          actorEmail: actor.email,
        })
        .catch(() => undefined);

      return { ok: true, mode: "deleted" };
    }

    if (tenant.status === "ARCHIVED") {
      return { ok: true, mode: "archived" };
    }

    await this.prisma.tenant.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.archive",
      resourceType: "tenant",
      resourceId: id,
      targetTenantId: id,
      payload: { slug: tenant.slug },
    });

    void this.tenantNotificacoes
      .notificarSuperadminsTenantLifecycle({
        acao: "arquivado",
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          legalName: tenant.legalName,
          nif: tenant.nif,
          status: "ARCHIVED",
        },
        actorEmail: actor.email,
      })
      .catch(() => undefined);

    return { ok: true, mode: "archived" };
  }

  async platformMetrics() {
    const dash = await this.platformDashboard();
    return {
      tenantsByStatus: dash.tenantsByStatus,
      totalUsers: dash.totalUsers,
      totalAcoes: dash.totalAcoes,
      subscriptionsByStatus: dash.subscriptionsByStatus,
      auditEvents24h: dash.auditEvents24h,
    };
  }

  async platformDashboard() {
    const since24h = new Date(Date.now() - 86_400_000);
    const now = new Date();

    const [
      tenants,
      users,
      acoes,
      subs,
      audit24h,
      sessions24h,
      activeSessions,
      supportByStatus,
      leadsTotal,
      leads24h,
      leadsByEstado,
      propostasTotal,
      propostas24h,
      faturasTotal,
      faturas24h,
      faturasByEstado,
      faturasEmitidasAgg,
      impersonationActive,
      tenantsList,
    ] = await Promise.all([
      this.prisma.tenant.groupBy({ by: ["status"], _count: true }),
      this.prisma.user.count(),
      this.prisma.acaoFormacao.count(),
      this.prisma.tenantSubscription.groupBy({ by: ["status"], _count: true }),
      this.prisma.globalAuditLog.count({ where: { occurredAt: { gte: since24h } } }),
      this.prisma.authRefreshSession.findMany({
        where: { createdAt: { gte: since24h } },
        select: { createdAt: true, subjectKind: true },
      }),
      this.prisma.authRefreshSession.findMany({
        where: { revokedAt: null, expiresAt: { gt: now } },
        select: { subjectId: true, subjectKind: true },
      }),
      this.prisma.supportTicket.groupBy({ by: ["status"], _count: true }),
      this.prisma.leadComercial.count(),
      this.prisma.leadComercial.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.leadComercial.groupBy({ by: ["estado"], _count: true }),
      this.prisma.propostaComercial.count(),
      this.prisma.propostaComercial.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.faturaComercial.count(),
      this.prisma.faturaComercial.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.faturaComercial.groupBy({ by: ["estado"], _count: true }),
      this.prisma.faturaComercial.aggregate({
        where: { estado: { in: ["EMITIDA", "COMUNICADA_AT"] } },
        _sum: { valorCentavos: true },
        _count: true,
      }),
      this.prisma.impersonationSession.count({
        where: { revokedAt: null, expiresAt: { gt: now } },
      }),
      this.prisma.tenant.findMany({
        orderBy: { legalName: "asc" },
        select: {
          id: true,
          slug: true,
          legalName: true,
          status: true,
          _count: {
            select: {
              leadsComerciais: true,
              propostasComerciais: true,
              faturasComerciais: true,
            },
          },
        },
      }),
    ]);

    const tenantOnline = new Set(
      activeSessions.filter((s) => s.subjectKind === "tenant").map((s) => s.subjectId),
    ).size;
    const platformOnline = new Set(
      activeSessions.filter((s) => s.subjectKind === "platform").map((s) => s.subjectId),
    ).size;

    const acessos24h = this.buildHourlyAccessSeries(sessions24h);
    const loginsTenant24h = sessions24h.filter((s) => s.subjectKind === "tenant").length;
    const since15m = new Date(Date.now() - 15 * 60 * 1000);

    const [
      recentActivity,
      recentErrors,
      errors15mCount,
    ] = await Promise.all([
      this.prisma.globalAuditLog.findMany({
        orderBy: { occurredAt: "desc" },
        take: 12,
        select: {
          id: true,
          occurredAt: true,
          action: true,
          resourceType: true,
          resourceId: true,
          targetTenantId: true,
          actorType: true,
          actorId: true,
          actorIp: true,
        },
      }),
      this.prisma.platformHttpAlert.findMany({
        orderBy: { occurredAt: "desc" },
        take: 8,
        select: {
          id: true,
          statusCode: true,
          httpMethod: true,
          httpPath: true,
          resumo: true,
          tenantSlug: true,
          severity: true,
          status: true,
          occurredAt: true,
        },
      }),
      this.prisma.platformHttpAlert.count({
        where: { occurredAt: { gte: since15m } },
      }),
    ]);

    const secret = this.config.get<string>("JWT_SECRET") ?? "nexiforma_default_jwt_secret";

    const mem = process.memoryUsage();

    return {
      tenantsByStatus: tenants,
      totalUsers: users,
      totalAcoes: acoes,
      subscriptionsByStatus: subs,
      auditEvents24h: audit24h,
      acessos: {
        onlineAgora: tenantOnline,
        onlinePlataforma: platformOnline,
        logins24h: loginsTenant24h,
        serie24h: acessos24h,
      },
      liveTelemetry: {
        errors15m: errors15mCount,
        recentErrors,
        recentActivity: recentActivity.map((r) => {
          const rawIp = r.actorIp != null ? String(r.actorIp).trim() : null;
          return {
            id: r.id.toString(),
            occurredAt: r.occurredAt,
            action: r.action,
            resourceType: r.resourceType,
            resourceId: r.resourceId,
            targetTenantId: r.targetTenantId,
            actorType: r.actorType,
            actorId: r.actorId,
            actorIp: rawIp ? maskPublicIp(rawIp) : null,
            encryptedActorIp: rawIp && !isPrivateOrInternalIp(rawIp) ? encryptIpWithSecret(rawIp, secret) : null,
          };
        }),
        systemHealth: {
          rssMb: Math.round(mem.rss / (1024 * 1024)),
          heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
          heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
          uptimeSeconds: Math.round(process.uptime()),
          nodeVersion: process.version,
          timestamp: now.toISOString(),
        },
      },
      suporte: {
        porEstado: supportByStatus,
        abertos: supportByStatus.find((s) => s.status === "OPEN")?._count ?? 0,
      },
      crm: {
        leadsTotal,
        leads24h,
        leadsByEstado,
        propostasTotal,
        propostas24h,
        faturasTotal,
        faturas24h,
        faturasByEstado,
        faturasEmitidasCount: faturasEmitidasAgg._count,
        faturasEmitidasEuro: (faturasEmitidasAgg._sum.valorCentavos ?? 0) / 100,
      },
      impersonationActive,
      tenantsCrm: tenantsList.map((t) => ({
        id: t.id,
        slug: t.slug,
        legalName: t.legalName,
        status: t.status,
        leads: t._count.leadsComerciais,
        propostas: t._count.propostasComerciais,
        faturas: t._count.faturasComerciais,
      })),
    };
  }

  async listCrmTenants() {
    const rows = await this.prisma.tenant.findMany({
      orderBy: { legalName: "asc" },
      select: {
        id: true,
        slug: true,
        legalName: true,
        status: true,
        users: {
          where: { role: "ADMIN", active: true },
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { id: true, email: true, displayName: true },
        },
        _count: {
          select: {
            leadsComerciais: true,
            propostasComerciais: true,
            faturasComerciais: true,
          },
        },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      legalName: t.legalName,
      status: t.status,
      adminUser: t.users[0] ?? null,
      leads: t._count.leadsComerciais,
      propostas: t._count.propostasComerciais,
      faturas: t._count.faturasComerciais,
    }));
  }

  private buildHourlyAccessSeries(
    sessions: { createdAt: Date; subjectKind: string }[],
  ): { hour: string; acessos: number; tenant: number; platform: number }[] {
    const buckets: { hour: string; ts: number; acessos: number; tenant: number; platform: number }[] =
      [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date();
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() - i);
      buckets.push({
        hour: d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
        ts: d.getTime(),
        acessos: 0,
        tenant: 0,
        platform: 0,
      });
    }

    for (const s of sessions) {
      const t = s.createdAt.getTime();
      for (let i = 0; i < buckets.length; i++) {
        const start = buckets[i].ts;
        const end = i < buckets.length - 1 ? buckets[i + 1].ts : Date.now() + 3_600_000;
        if (t >= start && t < end) {
          buckets[i].acessos += 1;
          if (s.subjectKind === "tenant") buckets[i].tenant += 1;
          else buckets[i].platform += 1;
          break;
        }
      }
    }

    return buckets.map(({ hour, acessos, tenant, platform }) => ({
      hour,
      acessos,
      tenant,
      platform,
    }));
  }

  listAuditLogs(opts?: {
    tenantId?: string;
    limit?: number;
    action?: string;
    actorType?: string;
    since?: string;
    q?: string;
    cursor?: string;
  }): Promise<Record<string, unknown>[]> {
    const actorTypeRaw = opts?.actorType?.trim().toUpperCase();
    const allowed = new Set(["SUPERADMIN_USER", "SYSTEM", "TENANT_USER", "PUBLIC_LINK"]);
    const actorType =
      actorTypeRaw && allowed.has(actorTypeRaw)
        ? (actorTypeRaw as "SUPERADMIN_USER" | "SYSTEM" | "TENANT_USER" | "PUBLIC_LINK")
        : undefined;
    const since = opts?.since ? new Date(opts.since) : undefined;
    const cursor =
      opts?.cursor && /^\d+$/.test(opts.cursor) ? BigInt(opts.cursor) : undefined;
    return this.audit.list({
      tenantId: opts?.tenantId,
      limit: opts?.limit,
      action: opts?.action?.trim() || undefined,
      actorType,
      since: since && !Number.isNaN(since.getTime()) ? since : undefined,
      q: opts?.q?.trim() || undefined,
      cursor,
    });
  }

  async createSubscriptionKey(
    actor: RequestUser,
    tenantId: string,
    dto: CreateSubscriptionKeyDto,
    actorIp?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const active = await this.prisma.tenantSubscriptionKey.findFirst({
      where: { tenantId, status: "ACTIVE" },
    });
    if (active) {
      throw new BadRequestException(
        "Já existe chave activa – revoga ou roda antes de criar nova.",
      );
    }

    const prefix = "nf_live_";
    const secret = randomBytes(24).toString("base64url");
    const pepper = this.config.get<string>("SUBSCRIPTION_KEY_PEPPER") ?? "";
    const keyHash = createHash("sha256")
      .update(`${prefix}${secret}${pepper}`)
      .digest("hex");

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 86_400_000)
      : null;

    const row = await this.prisma.tenantSubscriptionKey.create({
      data: {
        tenantId,
        keyPrefix: prefix,
        keyHash,
        maxActiveUsersSnapshot: dto.maxActiveUsersSnapshot ?? null,
        expiresAt,
      },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "subscription_key.create",
      resourceType: "tenant_subscription_key",
      resourceId: row.id,
      targetTenantId: tenantId,
    });

    return {
      id: row.id,
      key: `${prefix}${secret}`,
      expiresAt: row.expiresAt,
      warning: "Guarde a chave – não será mostrada novamente.",
    };
  }

  async revokeSubscriptionKey(
    actor: RequestUser,
    tenantId: string,
    keyId: string,
    actorIp?: string,
  ) {
    const key = await this.prisma.tenantSubscriptionKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!key) {
      throw new NotFoundException("Chave não encontrada.");
    }

    const updated = await this.prisma.tenantSubscriptionKey.update({
      where: { id: keyId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "subscription_key.revoke",
      resourceType: "tenant_subscription_key",
      resourceId: keyId,
      targetTenantId: tenantId,
    });

    return updated;
  }

  private assertPlatformSuperAdmin(user: RequestUser): void {
    if (user.kind !== "platform" || user.role !== "super_admin") {
      throw new ForbiddenException("Apenas super-admin da plataforma.");
    }
  }

  async getPlatformAccount(user: RequestUser): Promise<Record<string, unknown>> {
    this.assertPlatformSuperAdmin(user);
    const row = await this.prisma.platformUser.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!row) {
      throw new NotFoundException("Conta de plataforma não encontrada.");
    }
    return row;
  }

  async updatePlatformAccount(
    user: RequestUser,
    dto: UpdatePlatformMeDto,
    actorIp?: string,
  ): Promise<{ account: Record<string, unknown>; reauthRequired: boolean }> {
    this.assertPlatformSuperAdmin(user);

    const current = await this.prisma.platformUser.findUnique({
      where: { id: user.sub },
    });
    if (!current?.active) {
      throw new NotFoundException("Conta de plataforma não encontrada.");
    }

    const email = dto.email.toLowerCase().trim();
    const emailChanged = email !== current.email;

    if (emailChanged) {
      const taken = await this.prisma.platformUser.findUnique({ where: { email } });
      if (taken && taken.id !== current.id) {
        throw new ConflictException("Já existe outra conta de plataforma com este email.");
      }
      if (!dto.currentPassword?.trim()) {
        throw new BadRequestException("Indique a palavra-passe actual para alterar o email.");
      }
      const emailPwOk = await argon2.verify(current.passwordHash, dto.currentPassword);
      if (!emailPwOk) {
        throw new UnauthorizedException("Palavra-passe actual incorrecta.");
      }
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException("Indique a palavra-passe actual para definir uma nova.");
      }
      const ok = await argon2.verify(current.passwordHash, dto.currentPassword);
      if (!ok) {
        throw new UnauthorizedException("Palavra-passe actual incorrecta.");
      }
    }

    const data: {
      email: string;
      displayName?: string;
      passwordHash?: string;
    } = { email };

    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName.trim();
    }

    if (dto.newPassword) {
      data.passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    }

    const account = await this.prisma.platformUser.update({
      where: { id: current.id },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: user.sub,
      actorIp,
      action: "platform_user.update",
      resourceType: "platform_user",
      resourceId: current.id,
      payload: {
        emailChanged,
        passwordChanged: Boolean(dto.newPassword),
        displayNameChanged: dto.displayName !== undefined,
      },
    });

    return { account, reauthRequired: emailChanged || Boolean(dto.newPassword) };
  }
}
