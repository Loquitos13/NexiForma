import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { FormandoProfile } from "@nexiforma/database";
import { resolverEmailPresencaFormando } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateFormandoDto } from "./dto/create-formando.dto";
import type { UpdateFormandoDto } from "./dto/update-formando.dto";

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
      _count: { matriculas: number };
    },
  ) {
    const emailPresencaEfectivo = resolverEmailPresencaFormando({
      emailPresenca: f.emailPresenca,
      emailConta: f.user?.email,
      emailContacto: f.email,
    });
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
      _count: f._count,
    };
  }

  async list(user: RequestUser) {
    const tenantId = requireTenantId(user);
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
        _count: { select: { matriculas: true } },
      },
    });
    return rows.map((f) => this.mapFormandoListRow(f));
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

    return this.prisma.formandoProfile.create({
      data: {
        tenantId,
        nome: dto.nome.trim(),
        nif,
        email: dto.email?.trim() || null,
        emailPresenca: dto.emailPresenca?.trim() || null,
        telefone: dto.telefone?.trim() || null,
        entidadeClienteId: dto.entidadeClienteId ?? null,
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
}
