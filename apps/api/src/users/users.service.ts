import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import type { User } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { MailService } from "../mail/mail.service";
import type { AcceptInviteDto, InviteUserDto, UpdateUserDto } from "./dto/users.dto";

function hashInviteToken(pepper: string, raw: string): string {
  return createHash("sha256").update(`${pepper}:${raw}`).digest("hex");
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private invitePepper(): string {
    return (
      this.config.get<string>("INVITE_TOKEN_PEPPER") ??
      `${this.config.getOrThrow<string>("JWT_SECRET")}:invite`
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
        createdAt: true,
      },
    });
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

  async invite(user: RequestUser, dto: InviteUserDto) {
    const tenantId = requireTenantId(user);
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email },
    });
    if (existing) {
      throw new ConflictException("Já existe utilizador com este email no tenant.");
    }

    await this.assertUserLimit(tenantId);

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashInviteToken(this.invitePepper(), rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.tenantInvite.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: {
        tenantId,
        email,
        role: dto.role,
        tokenHash,
        expiresAt,
        invitedById: user.sub,
      },
      update: {
        role: dto.role,
        tokenHash,
        expiresAt,
        acceptedAt: null,
        invitedById: user.sub,
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, slug: true },
    });

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/convite/${rawToken}`;

    await this.mail.sendInvite(email, tenant?.legalName ?? tenant?.slug ?? "tenant", inviteUrl, dto.role);

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteUrl: this.config.get<string>("NODE_ENV") === "production" ? undefined : inviteUrl,
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
    if (dup) {
      throw new ConflictException("Utilizador já registado.");
    }

    await this.assertUserLimit(invite.tenantId);

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const created = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId: invite.tenantId,
          email: invite.email,
          displayName: invite.email.split("@")[0],
          role: invite.role,
          passwordHash,
        },
      });
      await tx.tenantInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
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
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
      },
    });
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
