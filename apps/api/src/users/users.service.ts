import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import type { Prisma, User } from "@nexiforma/database";
import { labelSigoRole, resolverEmailNotificacaoFormando } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { AuthService } from "../auth/auth.service";
import { syncPasswordHashByEmail } from "../auth/shared-password.util";
import { MailService } from "../mail/mail.service";
import { EmailConfirmationService } from "../auth/email-confirmation.service";
import type { AcceptInviteDto, InviteUserDto, UpdateUserDto } from "./dto/users.dto";
import {
  mapUserPublic,
  userSelectPublic,
} from "./users-guards.util";
import {
  assertManagerSafety,
  assertUserLimit,
  forbiddenSelfDeactivate,
  forbiddenSelfRemove,
} from "./users-policy.util";
import {
  hashInviteToken,
  invitePepperFromConfig,
  newInviteOpaqueToken,
} from "../common/invite-token.util";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";
import {
  emailPresencaEfectivoDeFormando,
  turmaExigeEmailPresenca,
} from "../common/formando-presenca.util";
import { ViesService } from "../vies/vies.service";
import {
  labelMatriculaDoc,
  matriculaDocumentosSeedRows,
} from "../formandos/matricula-documentos.util";
import {
  parseTenantDocumentosPolitica,
  resolveDocumentosPolitica,
  UNIVERSAL_DOC_OPTIONS,
} from "../formandos/documentos-politica.util";
import {
  FORMADOR_DOC_LABELS,
  resolveFormadorObrigatorios,
} from "../formadores/formador-documentos.util";
import { EmailTemplates } from "../notificacoes/templates/email.templates";
import {
  linkFormandoProfileToUserByEmail,
  upsertFormandoProfileForInvite,
} from "../common/formando-user-link.util";

function generateTempAccountPassword(): string {
  return randomBytes(9).toString("base64url").slice(0, 12) + "!A1";
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly vies: ViesService,
    private readonly emailConfirmation: EmailConfirmationService,
  ) {}

  private invitePepper(): string {
    return invitePepperFromConfig(
      (k) => this.config.get<string>(k),
      (k) => this.config.getOrThrow<string>(k),
    );
  }

  list(user: RequestUser) {
    const tenantId = requireTenantId(user);
    return this.prisma.user
      .findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        select: userSelectPublic(),
      })
      .then((rows) => rows.map(mapUserPublic));
  }

  async getOne(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: userSelectPublic(),
    });
    if (!row) {
      throw new NotFoundException("Utilizador não encontrado.");
    }
    return mapUserPublic(row);
  }

  listInvites(user: RequestUser) {
    const tenantId = requireTenantId(user);
    return this.prisma.tenantInvite.findMany({
      where: { tenantId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async invite(
    user: RequestUser,
    dto: InviteUserDto,
    req?: { headers: Record<string, string | string[] | undefined> },
  ) {
    const tenantId = requireTenantId(user);
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email },
    });
    if (existing?.active) {
      throw new ConflictException("Já existe utilizador activo com este email no tenant.");
    }
    // Conta inactiva: formador continua no fluxo de convite (perfil já na lista).
    // Outros cargos reactivam com reset de password.
    if (existing && !existing.active && dto.role !== "FORMADOR") {
      return this.reactivateInactiveUser(user, existing, dto, req);
    }

    await assertUserLimit(this.prisma, tenantId);

    if (dto.role === "FORMANDO" || dto.role === "FORMADOR") {
      const nif = dto.nif?.trim();
      if (!nif || !/^\d{9}$/.test(nif)) {
        throw new BadRequestException(
          dto.role === "FORMADOR"
            ? "NIF obrigatório (9 dígitos) para convites de formador."
            : "NIF obrigatório (9 dígitos) para convites de formando.",
        );
      }
      await this.vies.assertConfirmado(nif, "pessoa");
    }

    const rawToken = newInviteOpaqueToken();
    const tokenHash = hashInviteToken(this.invitePepper(), rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.tenantInvite.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: {
        tenantId,
        email,
        displayName: dto.displayName.trim(),
        role: dto.role,
        formandoNif:
          dto.role === "FORMANDO" || dto.role === "FORMADOR" ? dto.nif?.trim() : null,
        formandoTelefone: dto.role === "FORMANDO" ? dto.telefone?.trim() || null : null,
        tokenHash,
        expiresAt,
        invitedById: user.sub,
      },
      update: {
        displayName: dto.displayName.trim(),
        role: dto.role,
        formandoNif:
          dto.role === "FORMANDO" || dto.role === "FORMADOR" ? dto.nif?.trim() : null,
        formandoTelefone: dto.role === "FORMANDO" ? dto.telefone?.trim() || null : null,
        tokenHash,
        expiresAt,
        acceptedAt: null,
        invitedById: user.sub,
      },
    });

    let formandoProfileId: string | undefined;
    let matriculaId: string | undefined;
    let formadorProfileId: string | undefined;
    if (dto.role === "FORMANDO") {
      const nif = dto.nif!.trim();
      const profile = await upsertFormandoProfileForInvite(this.prisma, tenantId, {
        email,
        displayName: dto.displayName.trim(),
        nif,
        telefone: dto.telefone?.trim(),
      });
      formandoProfileId = profile.id;
      if (dto.turmaId) {
        matriculaId = await this.matricularFormandoInvite(tenantId, profile.id, dto.turmaId);
      }
    }
    if (dto.role === "FORMADOR") {
      const nif = dto.nif!.trim();
      const stub =
        existing ??
        (await this.prisma.user.create({
          data: {
            tenantId,
            email,
            displayName: dto.displayName.trim(),
            role: "FORMADOR",
            active: false,
            mustChangePassword: true,
          },
        }));
      if (existing) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            displayName: dto.displayName.trim(),
            role: "FORMADOR",
            active: false,
            mustChangePassword: true,
          },
        });
      }
      const formador = await this.ensureFormadorProfile(tenantId, stub.id, {
        email,
        displayName: dto.displayName.trim(),
        nif,
      });
      formadorProfileId = formador.id;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, slug: true },
    });

    const inviteUrl = await this.deliverInviteEmail({
      rawToken,
      email,
      displayName: dto.displayName.trim(),
      role: dto.role,
      tenantId,
      tenantLabel: tenant?.legalName ?? tenant?.slug ?? "tenant",
      req,
    });

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteUrl: this.config.get<string>("NODE_ENV") === "production" ? undefined : inviteUrl,
      formandoProfileId,
      formadorProfileId,
      matriculaId,
    };
  }

  private async reactivateInactiveUser(
    user: RequestUser,
    existing: User,
    dto: InviteUserDto,
    req?: { headers: Record<string, string | string[] | undefined> },
  ) {
    const tenantId = requireTenantId(user);
    const email = dto.email.toLowerCase().trim();

    await assertUserLimit(this.prisma, tenantId);

    await this.prisma.tenantInvite.deleteMany({
      where: { tenantId, email, acceptedAt: null },
    });

    await this.prisma.user.update({
      where: { id: existing.id },
      data: {
        active: true,
        displayName: dto.displayName.trim(),
        role: dto.role,
        mustChangePassword: true,
        emailVerifiedAt: null,
      },
    });
    await this.emailConfirmation.clearVerification(existing.id).catch(() => undefined);

    let formandoProfileId: string | undefined;
    let matriculaId: string | undefined;
    if (dto.role === "FORMANDO" || dto.role === "FORMADOR") {
      const nif = dto.nif?.trim();
      if (!nif || !/^\d{9}$/.test(nif)) {
        throw new BadRequestException(
          dto.role === "FORMADOR"
            ? "NIF obrigatório (9 dígitos) para convites de formador."
            : "NIF obrigatório (9 dígitos) para convites de formando.",
        );
      }
      await this.vies.assertConfirmado(nif, "pessoa");
    }
    if (dto.role === "FORMANDO") {
      const nif = dto.nif!.trim();
      const profile = await upsertFormandoProfileForInvite(this.prisma, tenantId, {
        email,
        displayName: dto.displayName.trim(),
        nif,
        telefone: dto.telefone?.trim(),
        userId: existing.id,
      });
      formandoProfileId = profile.id;
      if (dto.turmaId) {
        matriculaId = await this.matricularFormandoInvite(tenantId, profile.id, dto.turmaId);
      }
    }
    if (dto.role === "FORMADOR") {
      await this.ensureFormadorProfile(tenantId, existing.id, {
        email,
        displayName: dto.displayName.trim(),
        nif: dto.nif!.trim(),
      });
    }

    // Reset por email prova posse; até lá a conta fica por confirmar.
    const resetUrl = await this.auth.sendTenantUserPasswordReset(existing.id, req);
    void this.emailConfirmation.issueForUser(existing.id, req).catch(() => undefined);

    return {
      reactivated: true as const,
      id: existing.id,
      email,
      role: dto.role,
      resetUrl: this.config.get<string>("NODE_ENV") === "production" ? undefined : resetUrl,
      formandoProfileId,
      matriculaId,
    };
  }

  private async ensureFormadorProfile(
    tenantId: string,
    userId: string,
    data: { email: string; displayName: string; nif: string },
  ) {
    return this.ensureFormadorProfileTx(this.prisma, tenantId, userId, data);
  }

  private async ensureFormadorProfileTx(
    db: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    userId: string,
    data: { email: string; displayName: string; nif: string },
  ) {
    const nif = data.nif.trim();
    const existingByUser = await db.formadorProfile.findFirst({
      where: { tenantId, userId },
    });
    if (existingByUser) {
      if (existingByUser.nif !== nif) {
        const dup = await db.formadorProfile.findFirst({
          where: { tenantId, nif, NOT: { id: existingByUser.id } },
        });
        if (dup) {
          throw new ConflictException("Já existe formador com este NIF no tenant.");
        }
      }
      return db.formadorProfile.update({
        where: { id: existingByUser.id },
        data: {
          nif,
          email: data.email,
          nomeCompleto: data.displayName,
        },
      });
    }
    const dup = await db.formadorProfile.findFirst({ where: { tenantId, nif } });
    if (dup) {
      throw new ConflictException("Já existe formador com este NIF no tenant.");
    }
    return db.formadorProfile.create({
      data: {
        tenantId,
        userId,
        nif,
        email: data.email,
        nomeCompleto: data.displayName,
      },
    });
  }

  async cancelInvite(user: RequestUser, inviteId: string) {
    const tenantId = requireTenantId(user);
    const invite = await this.prisma.tenantInvite.findFirst({
      where: { id: inviteId, tenantId, acceptedAt: null },
    });
    if (!invite) {
      throw new NotFoundException("Convite não encontrado ou já aceite.");
    }
    await this.prisma.tenantInvite.delete({ where: { id: invite.id } });
    return { ok: true };
  }

  async resendInvite(
    user: RequestUser,
    inviteId: string,
    req?: { headers: Record<string, string | string[] | undefined> },
  ) {
    const tenantId = requireTenantId(user);
    const invite = await this.prisma.tenantInvite.findFirst({
      where: { id: inviteId, tenantId, acceptedAt: null },
    });
    if (!invite) {
      throw new NotFoundException("Convite não encontrado ou já aceite.");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId, email: invite.email },
    });
    if (existingUser?.active) {
      throw new ConflictException("Já existe utilizador activo com este email no tenant.");
    }

    const rawToken = newInviteOpaqueToken();
    const tokenHash = hashInviteToken(this.invitePepper(), rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.tenantInvite.update({
      where: { id: invite.id },
      data: {
        tokenHash,
        expiresAt,
        invitedById: user.sub,
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, slug: true },
    });

    const inviteUrl = await this.deliverInviteEmail({
      rawToken,
      email: invite.email,
      displayName: invite.displayName?.trim() || invite.email.split("@")[0]!,
      role: invite.role as InviteUserDto["role"],
      tenantId,
      tenantLabel: tenant?.legalName ?? tenant?.slug ?? "tenant",
      req,
    });

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      expiresAt: updated.expiresAt,
      inviteUrl: this.config.get<string>("NODE_ENV") === "production" ? undefined : inviteUrl,
    };
  }

  private async formadorDocsObrigatoriosLabels(tenantId: string): Promise<string[]> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    const politica = parseTenantDocumentosPolitica(tenant?.metadata);
    return resolveFormadorObrigatorios(politica.universaisObrigatorios).map(
      (id) => FORMADOR_DOC_LABELS[id] ?? id,
    );
  }

  private async deliverInviteEmail(params: {
    rawToken: string;
    email: string;
    displayName: string;
    role: InviteUserDto["role"];
    tenantId: string;
    tenantLabel: string;
    req?: { headers: Record<string, string | string[] | undefined> };
  }): Promise<string> {
    const appUrl = resolveAppPublicUrlForLinks(this.config, params.req);
    const inviteUrl = `${appUrl.replace(/\/$/, "")}/convite/${params.rawToken}`;
    const documentosObrigatorios =
      params.role === "FORMADOR"
        ? await this.formadorDocsObrigatoriosLabels(params.tenantId)
        : undefined;
    await this.mail.sendInvite(
      params.email,
      params.tenantLabel,
      inviteUrl,
      labelSigoRole(params.role),
      params.displayName,
      { documentosObrigatorios },
    );
    return inviteUrl;
  }

  /** Cria ou reactiva conta FORMANDO com password temporária (registo pelo portal). */
  async provisionFormandoAccount(
    actor: RequestUser,
    params: {
      formandoProfileId: string;
      email: string;
      displayName: string;
      nif: string;
      telefone?: string | null;
    },
    req?: { headers: Record<string, string | string[] | undefined> },
  ): Promise<{ userId: string }> {
    const tenantId = requireTenantId(actor);
    const email = params.email.toLowerCase().trim();

    const profile = await this.prisma.formandoProfile.findFirst({
      where: { id: params.formandoProfileId, tenantId },
      select: { id: true, userId: true, nif: true },
    });
    if (!profile) {
      throw new NotFoundException("Formando não encontrado.");
    }
    if (profile.userId) {
      throw new ConflictException("Este formando já tem conta de utilizador.");
    }

    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email },
      include: { formandoProfile: { select: { id: true } } },
    });
    if (existing?.active) {
      if (existing.role !== "FORMANDO") {
        throw new ConflictException("Já existe utilizador activo com este email noutro cargo.");
      }
      if (existing.formandoProfile && existing.formandoProfile.id !== profile.id) {
        throw new ConflictException("Já existe outro formando com este email.");
      }
    }

    await this.prisma.tenantInvite.deleteMany({
      where: { tenantId, email, acceptedAt: null },
    });

    await assertUserLimit(this.prisma, tenantId);

    const temporaryPassword = generateTempAccountPassword();
    const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });

    let userId: string;
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          active: true,
          displayName: params.displayName.trim(),
          role: "FORMANDO",
          passwordHash,
          mustChangePassword: true,
          emailVerifiedAt: null,
        },
      });
      userId = existing.id;
    } else {
      const created = await this.prisma.user.create({
        data: {
          tenantId,
          email,
          displayName: params.displayName.trim(),
          role: "FORMANDO",
          active: true,
          passwordHash,
          mustChangePassword: true,
        },
      });
      userId = created.id;
    }

    await this.prisma.formandoProfile.update({
      where: { id: profile.id },
      data: {
        userId,
        email,
        telefone: params.telefone?.trim() || undefined,
      },
    });

    const [tenant, actorRow] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { legalName: true, slug: true },
      }),
      this.prisma.user.findUnique({
        where: { id: actor.sub },
        select: { email: true, displayName: true },
      }),
    ]);

    const entidadeFormadora = tenant?.legalName ?? tenant?.slug ?? "entidade formadora";
    const appUrl = resolveAppPublicUrlForLinks(this.config, req).replace(/\/$/, "");
    const slug = tenant?.slug ?? "";
    const loginUrl = `${appUrl}/login?slug=${encodeURIComponent(slug)}&email=${encodeURIComponent(email)}`;

    const tpl = EmailTemplates.formandoCredenciaisTemporarias({
      nomeFormando: params.displayName.trim(),
      entidadeFormadora,
      slug,
      email,
      temporaryPassword,
      loginUrl,
    });

    await this.mail.send({
      to: email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });

    const actorEmail = actorRow?.email?.trim().toLowerCase();
    if (actorEmail && actorEmail !== email) {
      const staffTpl = EmailTemplates.registoContaCopiaRegistador({
        nomeRegistador: actorRow?.displayName?.trim() || actorEmail.split("@")[0]!,
        tipoPerfil: "formando",
        nomeUtilizador: params.displayName.trim(),
        emailUtilizador: email,
        entidadeFormadora,
        slug,
        temporaryPassword,
        loginUrl,
      });
      await this.mail.send({
        to: actorEmail,
        subject: staffTpl.subject,
        text: staffTpl.text,
        html: staffTpl.html,
      });
    }

    return { userId };
  }

  /** Cria conta FORMADOR + perfil com password temporária (registo pelo portal). */
  async provisionNewFormadorAccount(
    actor: RequestUser,
    params: {
      email: string;
      displayName: string;
      nif: string;
      telefone: string;
      morada: string;
      ccNumero?: string;
      ccValidade?: string;
    },
    req?: { headers: Record<string, string | string[] | undefined> },
  ) {
    const tenantId = requireTenantId(actor);
    const email = params.email.toLowerCase().trim();
    const nif = params.nif.trim();

    const dupNif = await this.prisma.formadorProfile.findFirst({ where: { tenantId, nif } });
    if (dupNif) throw new ConflictException("Já existe formador com este NIF.");

    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email },
      include: { formadorProfile: { select: { id: true } } },
    });
    if (existing?.active) {
      if (existing.role !== "FORMADOR") {
        throw new ConflictException("Já existe utilizador activo com este email noutro cargo.");
      }
      if (existing.formadorProfile) {
        throw new ConflictException("Já existe formador com este email.");
      }
    }

    await this.prisma.tenantInvite.deleteMany({
      where: { tenantId, email, acceptedAt: null },
    });

    await assertUserLimit(this.prisma, tenantId);

    const temporaryPassword = generateTempAccountPassword();
    const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });

    let userId: string;
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          active: true,
          displayName: params.displayName.trim(),
          role: "FORMADOR",
          passwordHash,
          mustChangePassword: true,
          emailVerifiedAt: null,
        },
      });
      userId = existing.id;
    } else {
      const created = await this.prisma.user.create({
        data: {
          tenantId,
          email,
          displayName: params.displayName.trim(),
          role: "FORMADOR",
          active: true,
          passwordHash,
          mustChangePassword: true,
        },
      });
      userId = created.id;
    }

    const profile = await this.prisma.formadorProfile.create({
      data: {
        tenantId,
        userId,
        nif,
        email,
        nomeCompleto: params.displayName.trim(),
        telefone: params.telefone.trim(),
        morada: params.morada.trim(),
        ...(params.ccNumero?.trim() ? { ccNumero: params.ccNumero.trim() } : {}),
        ...(params.ccValidade ? { ccValidade: new Date(params.ccValidade) } : {}),
      },
      select: {
        id: true,
        nomeCompleto: true,
        nif: true,
        email: true,
        emailPresenca: true,
        telefone: true,
        morada: true,
        ccNumero: true,
        ccpNumero: true,
        ccValidade: true,
        ccpValidade: true,
        user: { select: { id: true, email: true, active: true } },
      },
    });

    const [tenant, actorRow, docsLabels] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { legalName: true, slug: true },
      }),
      this.prisma.user.findUnique({
        where: { id: actor.sub },
        select: { email: true, displayName: true },
      }),
      this.formadorDocsObrigatoriosLabels(tenantId),
    ]);

    const entidadeFormadora = tenant?.legalName ?? tenant?.slug ?? "entidade formadora";
    const appUrl = resolveAppPublicUrlForLinks(this.config, req).replace(/\/$/, "");
    const slug = tenant?.slug ?? "";
    const loginUrl = `${appUrl}/login?slug=${encodeURIComponent(slug)}&email=${encodeURIComponent(email)}`;
    const portalUrl = `${appUrl}/portal/formador/perfil?tab=documentos`;

    const tpl = EmailTemplates.formadorCredenciaisTemporarias({
      nomeFormador: params.displayName.trim(),
      entidadeFormadora,
      slug,
      email,
      temporaryPassword,
      loginUrl,
      portalUrl,
      documentosObrigatorios: docsLabels,
    });

    await this.mail.send({
      to: email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });

    const actorEmail = actorRow?.email?.trim().toLowerCase();
    if (actorEmail && actorEmail !== email) {
      const copyTpl = EmailTemplates.registoContaCopiaRegistador({
        nomeRegistador: actorRow?.displayName?.trim() || actorEmail.split("@")[0]!,
        tipoPerfil: "formador",
        nomeUtilizador: params.displayName.trim(),
        emailUtilizador: email,
        entidadeFormadora,
        slug,
        temporaryPassword,
        loginUrl,
      });
      await this.mail.send({
        to: actorEmail,
        subject: copyTpl.subject,
        text: copyTpl.text,
        html: copyTpl.html,
      });
    }

    return profile;
  }

  private async notifyFormadorCargoAtribuido(params: {
    tenantId: string;
    email: string;
    displayName: string;
    entidadeFormadora: string;
  }) {
    const appUrl = resolveAppPublicUrlForLinks(this.config).replace(/\/$/, "");
    const docs = await this.formadorDocsObrigatoriosLabels(params.tenantId);
    const tpl = EmailTemplates.formadorCargoAtribuido({
      nomeUtilizador: params.displayName,
      entidadeFormadora: params.entidadeFormadora,
      documentosObrigatorios: docs,
      portalUrl: `${appUrl}/portal/formador/perfil?tab=documentos`,
    });
    await this.mail.send({
      to: params.email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
  }

  private async matricularFormandoInvite(
    tenantId: string,
    formandoId: string,
    turmaId: string,
  ): Promise<string> {
    const turma = await this.prisma.turma.findFirst({
      where: { id: turmaId, tenantId },
    });
    if (!turma) {
      throw new NotFoundException("Turma inexistente ou de outro tenant.");
    }

    const formando = await this.prisma.formandoProfile.findFirst({
      where: { id: formandoId, tenantId },
      include: { user: { select: { email: true } } },
    });
    if (!formando) {
      throw new NotFoundException("Perfil de formando não encontrado.");
    }

    const exigeEmail = await turmaExigeEmailPresenca(this.prisma, tenantId, turmaId);
    const emailEfectivo = emailPresencaEfectivoDeFormando(formando);
    if (exigeEmail && !emailEfectivo) {
      throw new BadRequestException(
        "Turma online - o formando precisa de email de contacto ou conta NexiForma antes de matricular.",
      );
    }

    const exists = await this.prisma.matricula.findFirst({
      where: { turmaId, formandoId },
    });
    if (exists) {
      if (exists.estado !== "ATIVA") {
        await this.prisma.matricula.update({
          where: { id: exists.id },
          data: { estado: "ATIVA" },
        });
      }
      return exists.id;
    }

    const turmaCtx = await this.prisma.turma.findFirst({
      where: { id: turmaId, tenantId },
      select: {
        codigo: true,
        acaoFormacao: {
          select: {
            codigoInterno: true,
            titulo: true,
            configuracaoMatricula: true,
            curso: { select: { configuracaoMatricula: true } },
          },
        },
      },
    });
    const tenantRow = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true, legalName: true },
    });
    const politica = resolveDocumentosPolitica({
      tenantMetadata: tenantRow?.metadata,
      cursoConfig: turmaCtx?.acaoFormacao.curso.configuracaoMatricula,
      acaoConfig: turmaCtx?.acaoFormacao.configuracaoMatricula,
    });

    const matricula = await this.prisma.$transaction(async (tx) => {
      const created = await tx.matricula.create({
        data: { tenantId, turmaId, formandoId },
      });
      await tx.matriculaDocumento.createMany({
        data: matriculaDocumentosSeedRows(
          tenantId,
          created.id,
          politica.inscricaoObrigatorios,
        ),
      });
      return created;
    });

    if (turmaCtx?.acaoFormacao) {
      const to = resolverEmailNotificacaoFormando({
        emailContacto: formando.email,
        emailConta: formando.user?.email,
      });
      if (to) {
        const appUrl = resolveAppPublicUrlForLinks(this.config).replace(/\/$/, "");
        const acao = turmaCtx.acaoFormacao;
        const tpl = EmailTemplates.formandoInscritoAcao({
          nomeFormando: formando.nome,
          acaoLabel: `${acao.codigoInterno} – ${acao.titulo}`,
          turmaCodigo: turmaCtx.codigo,
          entidadeFormadora: tenantRow?.legalName ?? "entidade formadora",
          documentosInscricao: politica.inscricaoObrigatorios.map(labelMatriculaDoc),
          documentosUniversais: politica.universaisObrigatorios.map(
            (id) => UNIVERSAL_DOC_OPTIONS.find((o) => o.id === id)?.label ?? id,
          ),
          portalUrl: `${appUrl}/portal/formando`,
        });
        void this.mail
          .send({ to, subject: tpl.subject, text: tpl.text, html: tpl.html })
          .catch(() => undefined);
      }
    }

    return matricula.id;
  }

  async inspectInvite(token: string) {
    const tokenHash = hashInviteToken(this.invitePepper(), token);
    const invite = await this.prisma.tenantInvite.findUnique({
      where: { tokenHash },
      include: { tenant: { select: { slug: true, legalName: true } } },
    });

    if (!invite || invite.acceptedAt || invite.expiresAt <= new Date()) {
      throw new BadRequestException("Convite inválido ou expirado.");
    }

    return {
      email: invite.email,
      displayName: invite.displayName,
      role: invite.role,
      tenantSlug: invite.tenant.slug,
      tenantLegalName: invite.tenant.legalName,
    };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const tokenHash = hashInviteToken(this.invitePepper(), dto.token);
    const invite = await this.prisma.tenantInvite.findUnique({
      where: { tokenHash },
      include: { tenant: true },
    });

    if (!invite || invite.acceptedAt || invite.expiresAt <= new Date()) {
      throw new BadRequestException("Convite inválido ou expirado.");
    }

    const dup = await this.prisma.user.findFirst({
      where: { tenantId: invite.tenantId, email: invite.email },
    });
    if (dup?.active) {
      throw new ConflictException("Utilizador já registado.");
    }

    await assertUserLimit(this.prisma, invite.tenantId);

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const now = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      const u = dup
        ? await tx.user.update({
            where: { id: dup.id },
            data: {
              active: true,
              displayName: invite.displayName?.trim() || invite.email.split("@")[0]!,
              role: invite.role,
              passwordHash,
              emailVerifiedAt: now,
              mustChangePassword: false,
            },
          })
        : await tx.user.create({
            data: {
              tenantId: invite.tenantId,
              email: invite.email,
              displayName: invite.displayName?.trim() || invite.email.split("@")[0]!,
              role: invite.role,
              passwordHash,
              emailVerifiedAt: now,
            },
          });
      await syncPasswordHashByEmail(tx, invite.email, passwordHash, {
        mustChangePassword: false,
      });
      await tx.tenantInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      if (invite.role === "FORMANDO") {
        let linked = await linkFormandoProfileToUserByEmail(tx, invite.tenantId, u.id, invite.email);
        if (!linked && invite.formandoNif?.trim()) {
          const profile = await upsertFormandoProfileForInvite(tx, invite.tenantId, {
            email: invite.email,
            displayName: invite.displayName?.trim() || u.displayName,
            nif: invite.formandoNif.trim(),
            telefone: invite.formandoTelefone ?? undefined,
            userId: u.id,
          });
          linked = profile.id;
        }
      }
      if (invite.role === "FORMADOR" && invite.formandoNif?.trim()) {
        await this.ensureFormadorProfileTx(tx, invite.tenantId, u.id, {
          email: invite.email,
          displayName: invite.displayName?.trim() || u.displayName,
          nif: invite.formandoNif.trim(),
        });
      }
      return u;
    });

    await this.emailConfirmation.markVerified(created.id).catch(() => undefined);

    return {
      id: created.id,
      email: created.email,
      tenantSlug: invite.tenant.slug,
    };
  }

  async resendEmailConfirmation(
    user: RequestUser,
    userId: string,
    req?: { headers: Record<string, string | string[] | undefined> },
  ) {
    const tenantId = requireTenantId(user);
    const target = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, email: true, emailVerifiedAt: true, active: true },
    });
    if (!target) {
      throw new NotFoundException("Utilizador não encontrado.");
    }
    if (!target.active) {
      throw new BadRequestException("Utilizador inactivo - reenvie o convite de activação.");
    }
    if (target.emailVerifiedAt) {
      return { ok: true, alreadyVerified: true, sent: false };
    }
    const result = await this.emailConfirmation.issueForUser(target.id, req);
    return { ok: true, ...result };
  }

  async update(user: RequestUser, id: string, dto: UpdateUserDto): Promise<User> {
    const tenantId = requireTenantId(user);
    if (id === user.sub && dto.active === false) {
      throw forbiddenSelfDeactivate();
    }
    if (id === user.sub && dto.role !== undefined) {
      throw new ForbiddenException("Não podes alterar o teu próprio cargo.");
    }

    const existing = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException("Utilizador não encontrado.");
    }

    if (dto.active === true && !existing.active) {
      await assertUserLimit(this.prisma, tenantId);
    }

    await assertManagerSafety(this.prisma, tenantId, existing, dto);

    const nextRole = dto.role ?? existing.role;
    if (nextRole === "FORMADOR") {
      const hasProfile = await this.prisma.formadorProfile.findFirst({
        where: { tenantId, userId: id },
        select: { id: true },
      });
      if (!hasProfile) {
        const nif = dto.nif?.trim();
        if (!nif || !/^\d{9}$/.test(nif)) {
          throw new BadRequestException(
            "NIF obrigatório (9 dígitos) para atribuir o cargo de formador.",
          );
        }
        await this.vies.assertConfirmado(nif, "pessoa");
      }
    }

    const roleChangedToFormador =
      dto.role === "FORMADOR" && existing.role !== "FORMADOR";

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.mfaRequired !== undefined ? { mfaRequired: dto.mfaRequired } : {}),
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
      },
    });

    if (updated.role === "FORMADOR") {
      const hasProfile = await this.prisma.formadorProfile.findFirst({
        where: { tenantId, userId: id },
        select: { id: true },
      });
      if (!hasProfile) {
        await this.ensureFormadorProfile(tenantId, id, {
          email: updated.email,
          displayName: updated.displayName,
          nif: dto.nif!.trim(),
        });
      } else if (dto.displayName !== undefined) {
        await this.prisma.formadorProfile.updateMany({
          where: { tenantId, userId: id },
          data: { nomeCompleto: updated.displayName, email: updated.email },
        });
      }
    }

    if (roleChangedToFormador && updated.active) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { legalName: true, slug: true },
      });
      void this.notifyFormadorCargoAtribuido({
        tenantId,
        email: updated.email,
        displayName: updated.displayName,
        entidadeFormadora: tenant?.legalName ?? tenant?.slug ?? "entidade formadora",
      }).catch(() => undefined);
    }

    return updated;
  }

  async removePermanent(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    if (id === user.sub) {
      throw forbiddenSelfRemove();
    }

    const existing = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException("Utilizador não encontrado.");
    }

    await assertManagerSafety(this.prisma, tenantId, existing, { active: false });

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { subjectKind: "tenant", subjectId: id },
      });

      await tx.emailConfirmationToken.deleteMany({
        where: { userId: id },
      });

      await tx.authRefreshSession.deleteMany({
        where: { subjectKind: "tenant", subjectId: id },
      });

      await tx.tenantInvite.deleteMany({
        where: { tenantId, email: existing.email },
      });

      await tx.user.delete({ where: { id } });
    });

    return { ok: true };
  }

  async enforceMfa(user: RequestUser, userIds: string[]) {
    const tenantId = requireTenantId(user);
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException("Selecciona pelo menos um utilizador.");
    }

    const found = await this.prisma.user.findMany({
      where: { tenantId, id: { in: uniqueIds }, active: true },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
      throw new NotFoundException("Um ou mais utilizadores não foram encontrados.");
    }

    await this.prisma.user.updateMany({
      where: { tenantId, id: { in: uniqueIds } },
      data: { mfaRequired: true },
    });

    return { updated: uniqueIds.length };
  }

  async disableMfa(user: RequestUser, userIds: string[]) {
    const tenantId = requireTenantId(user);
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException("Selecciona pelo menos um utilizador.");
    }

    const found = await this.prisma.user.findMany({
      where: { tenantId, id: { in: uniqueIds }, active: true, mfaEnabled: true },
      select: { id: true },
    });
    if (found.length === 0) {
      throw new BadRequestException("Nenhum dos utilizadores seleccionados tem MFA activo.");
    }

    await this.prisma.user.updateMany({
      where: { tenantId, id: { in: found.map((u) => u.id) } },
      data: {
        mfaEnabled: false,
        mfaRequired: false,
        mfaSecret: null,
        mfaApp: null,
      },
    });

    return { updated: found.length };
  }
}
