import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { FormandoProfile } from "@nexiforma/database";
import { resolverEmailPresencaFormando } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateFormandoDto } from "./dto/create-formando.dto";
import type { UpdateFormandoDto } from "./dto/update-formando.dto";
import { ensureFormandoProfilesForTenant } from "../common/formando-user-link.util";

@Injectable()
export class FormandosService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertEmailPresencaUnico(
    tenantId: string,
    emailPresenca: string | null | undefined,
    excludeId?: string,
  ) {
    const trimmed = emailPresenca?.trim();
    if (!trimmed) return;
    const dup = await this.prisma.formandoProfile.findFirst({
      where: {
        tenantId,
        emailPresenca: { equals: trimmed, mode: "insensitive" },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (dup) {
      throw new ConflictException("Já existe outro formando com esse email de presença.");
    }
  }

  private mapFormandoListRow(
    f: {
      id: string;
      nome: string;
      nif: string;
      email: string | null;
      emailPresenca: string | null;
      telefone: string | null;
      createdAt: Date;
      userId: string | null;
      entidadeClienteId: string | null;
      user: { email: string } | null;
      metadata: unknown;
      _count: { matriculas: number };
    },
    opts: { pendingInviteEmails: Set<string> },
  ) {
    const emailPresencaEfectivo = resolverEmailPresencaFormando({
      emailPresenca: f.emailPresenca,
      emailConta: f.user?.email,
      emailContacto: f.email,
    });
    const emailKey = f.email?.trim().toLowerCase() ?? "";
    const contaEstado = f.userId
      ? "activa"
      : emailKey && opts.pendingInviteEmails.has(emailKey)
        ? "convite_pendente"
        : "sem_conta";
    const nifProvisorio = Boolean(
      f.metadata && typeof f.metadata === "object" && (f.metadata as { nifProvisorio?: boolean }).nifProvisorio,
    );
    return {
      id: f.id,
      nome: f.nome,
      nif: f.nif,
      email: f.email,
      emailPresenca: f.emailPresenca,
      emailConta: f.user?.email ?? null,
      emailPresencaEfectivo,
      telefone: f.telefone,
      createdAt: f.createdAt,
      userId: f.userId,
      entidadeClienteId: f.entidadeClienteId,
      contaEstado,
      nifProvisorio,
      _count: f._count,
    };
  }

  async list(user: RequestUser) {
    const tenantId = requireTenantId(user);
    await ensureFormandoProfilesForTenant(this.prisma, tenantId);

    const pendingInviteEmails = new Set(
      (
        await this.prisma.tenantInvite.findMany({
          where: {
            tenantId,
            role: "FORMANDO",
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { email: true },
          take: 200,
        })
      ).map((i) => i.email.trim().toLowerCase()),
    );

    const rows = await this.prisma.formandoProfile.findMany({
      where: { tenantId },
      orderBy: { nome: "asc" },
      take: 120,
      select: {
        id: true,
        nome: true,
        nif: true,
        email: true,
        emailPresenca: true,
        telefone: true,
        createdAt: true,
        userId: true,
        entidadeClienteId: true,
        user: { select: { email: true } },
        metadata: true,
        _count: { select: { matriculas: true } },
      },
    });
    return rows.map((f) => this.mapFormandoListRow(f, { pendingInviteEmails }));
  }

  async create(user: RequestUser, dto: CreateFormandoDto): Promise<FormandoProfile> {
    const tenantId = requireTenantId(user);

    const nif = dto.nif.trim();

    const dup = await this.prisma.formandoProfile.findFirst({
      where: { tenantId, nif },
    });
    if (dup) {
      throw new ConflictException("Já existe um formando com esse NIF no tenant.");
    }

    if (dto.entidadeClienteId) {
      const ec = await this.prisma.entidadeCliente.findFirst({
        where: { id: dto.entidadeClienteId, tenantId },
      });
      if (!ec) {
        throw new NotFoundException("Entidade cliente inexistente ou de outro tenant.");
      }
    }

    await this.assertEmailPresencaUnico(tenantId, dto.emailPresenca);

    const emailContacto = dto.email?.trim().toLowerCase();
    const linkedUser = emailContacto
      ? await this.prisma.user.findFirst({
          where: {
            tenantId,
            role: "FORMANDO",
            email: { equals: emailContacto, mode: "insensitive" },
            formandoProfile: null,
          },
          select: { id: true },
        })
      : null;

    return this.prisma.formandoProfile.create({
      data: {
        tenantId,
        nome: dto.nome.trim(),
        nif,
        email: dto.email?.trim() || null,
        emailPresenca: dto.emailPresenca?.trim() || null,
        telefone: dto.telefone?.trim() || null,
        entidadeClienteId: dto.entidadeClienteId ?? null,
        userId: linkedUser?.id ?? null,
      },
    });
  }

  async getOne(user: RequestUser, id: string): Promise<FormandoProfile> {
    const tenantId = requireTenantId(user);
    const formando = await this.prisma.formandoProfile.findFirst({
      where: { id, tenantId },
    });
    if (!formando) {
      throw new NotFoundException("Formando não encontrado.");
    }
    return formando;
  }

  async update(user: RequestUser, id: string, dto: UpdateFormandoDto): Promise<FormandoProfile> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.formandoProfile.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Formando não encontrado.");
    }

    if (dto.nif && dto.nif.trim() !== existing.nif) {
      const dup = await this.prisma.formandoProfile.findFirst({
        where: { tenantId, nif: dto.nif.trim(), NOT: { id } },
      });
      if (dup) {
        throw new ConflictException("Já existe um formando com esse NIF no tenant.");
      }
    }

    if (dto.emailPresenca !== undefined) {
      await this.assertEmailPresencaUnico(tenantId, dto.emailPresenca, id);
    }

    return this.prisma.formandoProfile.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.nif !== undefined ? { nif: dto.nif.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
        ...(dto.emailPresenca !== undefined
          ? { emailPresenca: dto.emailPresenca?.trim() || null }
          : {}),
        ...(dto.telefone !== undefined ? { telefone: dto.telefone?.trim() || null } : {}),
      },
    });
  }

  async remove(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const formando = await this.prisma.formandoProfile.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        userId: true,
        _count: { select: { matriculas: true } },
      },
    });
    if (!formando) {
      throw new NotFoundException("Formando não encontrado.");
    }

    await this.prisma.$transaction(async (tx) => {
      const email = formando.email?.trim();
      if (email) {
        await tx.tenantInvite.deleteMany({
          where: {
            tenantId,
            role: "FORMANDO",
            acceptedAt: null,
            email: { equals: email, mode: "insensitive" },
          },
        });
      }
      if (formando.userId) {
        await tx.user.update({
          where: { id: formando.userId },
          data: { active: false },
        });
      }
      await tx.formandoProfile.delete({ where: { id } });
    });

    return {
      ok: true,
      matriculasRemovidas: formando._count.matriculas,
      contaDesactivada: Boolean(formando.userId),
    };
  }
}
