import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import type { User } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { MailService } from "../mail/mail.service";
import type { AcceptInviteDto, InviteUserDto, UpdateUserDto } from "./dto/users.dto";
import {
  hashInviteToken,
  invitePepperFromConfig,
  newInviteOpaqueToken,
} from "../common/invite-token.util";
import { resolveAppPublicUrl } from "../common/app-public-url.util";
import {
  emailPresencaEfectivoDeFormando,
  turmaExigeEmailPresenca,
} from "../common/formando-presenca.util";
import {
  linkFormandoProfileToUserByEmail,
  upsertFormandoProfileForInvite,
} from "../common/formando-user-link.util";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private invitePepper(): string {
    return invitePepperFromConfig(
      (k) => this.config.get<string>(k),
      (k) => this.config.getOrThrow<string>(k),
    );
  }

  list(user: RequestUser) {
    const tenantId = requireTenantId(user);
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        active: true,
        mfaEnabled: true,
        mfaRequired: true,
        mfaApp: true,
        mfaSecret: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    }).then((rows) =>
      rows.map(({ mfaSecret, ...u }) => ({
        ...u,
        mfaSetupPending: Boolean(mfaSecret && !u.mfaEnabled),
      })),
    );
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
    if (existing) {
      throw new ConflictException("Já existe utilizador com este email no tenant.");
    }

    await this.assertUserLimit(tenantId);

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
        formandoNif: dto.role === "FORMANDO" ? dto.nif?.trim() : null,
        formandoTelefone: dto.role === "FORMANDO" ? dto.telefone?.trim() || null : null,
        tokenHash,
        expiresAt,
        invitedById: user.sub,
      },
      update: {
        displayName: dto.displayName.trim(),
        role: dto.role,
        formandoNif: dto.role === "FORMANDO" ? dto.nif?.trim() : null,
        formandoTelefone: dto.role === "FORMANDO" ? dto.telefone?.trim() || null : null,
        tokenHash,
        expiresAt,
        acceptedAt: null,
        invitedById: user.sub,
      },
    });

    let formandoProfileId: string | undefined;
    let matriculaId: string | undefined;
    if (dto.role === "FORMANDO") {
      const nif = dto.nif?.trim();
      if (!nif || !/^\d{9}$/.test(nif)) {
        throw new BadRequestException("NIF obrigatório (9 dígitos) para convites de formando.");
      }
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

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, slug: true },
    });

    const appUrl = resolveAppPublicUrl(this.config, req);
    const inviteUrl = `${appUrl.replace(/\/$/, "")}/convite/${rawToken}`;

    await this.mail.sendInvite(
      email,
      tenant?.legalName ?? tenant?.slug ?? "tenant",
      inviteUrl,
      dto.role,
      dto.displayName.trim(),
    );

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteUrl: this.config.get<string>("NODE_ENV") === "production" ? undefined : inviteUrl,
      formandoProfileId,
      matriculaId,
    };
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
        "Turma online — o formando precisa de email de contacto ou conta NexiForma antes de matricular.",
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

    const matricula = await this.prisma.matricula.create({
      data: { tenantId, turmaId, formandoId },
    });
    return matricula.id;
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
    if (dup) {
      throw new ConflictException("Utilizador já registado.");
    }

    await this.assertUserLimit(invite.tenantId);

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const now = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId: invite.tenantId,
          email: invite.email,
          displayName: invite.displayName?.trim() || invite.email.split("@")[0]!,
          role: invite.role,
          passwordHash,
          emailVerifiedAt: now,
        },
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
      return u;
    });

    return {
      id: created.id,
      email: created.email,
      tenantSlug: invite.tenant.slug,
    };
  }

  async update(user: RequestUser, id: string, dto: UpdateUserDto): Promise<User> {
    const tenantId = requireTenantId(user);
    if (id === user.sub && dto.active === false) {
      throw forbiddenSelfDeactivate();
    }

    const existing = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException("Utilizador não encontrado.");
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.mfaRequired !== undefined ? { mfaRequired: dto.mfaRequired } : {}),
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
      },
    });
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

  private async assertUserLimit(tenantId: string) {
    const sub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId, status: { in: ["ACTIVE", "TRIALING"] } },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    const max = sub?.plan.maxActiveUsers;
    if (max == null) return;

    const activeCount = await this.prisma.user.count({
      where: { tenantId, active: true },
    });
    if (activeCount >= max) {
      throw new ForbiddenException(
        `Limite de ${max} utilizadores activos do plano atingido. Actualiza a subscrição.`,
      );
    }
  }
}

function forbiddenSelfDeactivate(): ForbiddenException {
  return new ForbiddenException("Não podes desactivar a tua própria conta.");
}
