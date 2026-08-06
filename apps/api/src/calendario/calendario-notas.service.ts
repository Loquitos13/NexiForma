import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TenantUserRole } from "@nexiforma/database";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { PrismaService } from "../prisma/prisma.service";
import {
  parseAlvoRoles,
  parseAlvoUserIds,
  type CalendarioAlvoRole,
  userPodeEditarCalendarioEvento,
  userPodeVerCalendarioEvento,
} from "./calendario-notas.util";
import type { CreateCalendarioNotaDto, UpdateCalendarioNotaDto } from "./dto/calendario-nota.dto";

const NOTA_INCLUDE = {
  criadoPor: { select: { id: true, displayName: true } },
  entidadeCliente: { select: { id: true, nome: true, nif: true } },
} as const;

export type CalendarioNotaResposta = {
  id: string;
  tenantId: string;
  tipo: "LEMBRETE" | "EVENTO";
  titulo: string;
  descricao: string | null;
  inicio: Date;
  fim: Date | null;
  criadoPorUserId: string;
  entidadeClienteId: string | null;
  alvoUserIds: unknown;
  alvoRoles: unknown;
  createdAt: Date;
  updatedAt: Date;
  criadoPor: { id: string; displayName: string };
  entidadeCliente: { id: string; nome: string; nif: string } | null;
};

function parseDateTime(raw: string, field: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${field} inválido.`);
  }
  return d;
}

@Injectable()
export class CalendarioNotasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: RequestUser, dto: CreateCalendarioNotaDto): Promise<CalendarioNotaResposta> {
    this.assertPodeCriar(user, dto.tipo);
    const tenantId = requireTenantId(user);
    if (!user.sub) throw new ForbiddenException();

    const inicio = parseDateTime(dto.inicio, "inicio");
    const fim = dto.fim ? parseDateTime(dto.fim, "fim") : null;
    if (fim && fim.getTime() < inicio.getTime()) {
      throw new BadRequestException("fim deve ser posterior a inicio.");
    }

    const { alvoUserIds, alvoRoles } = await this.resolveDestinatarios(
      user,
      dto.tipo,
      dto.alvoUserIds ?? [],
      (dto.alvoRoles ?? []) as CalendarioAlvoRole[],
      tenantId,
    );

    const entidadeClienteId = await this.resolveEntidadeClienteId(
      tenantId,
      dto.entidadeClienteId,
    );

    return this.prisma.calendarioEvento.create({
      data: {
        tenantId,
        tipo: dto.tipo,
        titulo: dto.titulo.trim(),
        descricao: dto.descricao?.trim() || null,
        inicio,
        fim,
        criadoPorUserId: user.sub,
        entidadeClienteId,
        alvoUserIds,
        alvoRoles,
      },
      include: NOTA_INCLUDE,
    });
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateCalendarioNotaDto,
  ): Promise<CalendarioNotaResposta> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.calendarioEvento.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException("Evento de calendário não encontrado.");
    if (!userPodeEditarCalendarioEvento(user, row)) {
      throw new ForbiddenException("Sem permissão para editar este evento.");
    }

    const tipo = dto.tipo ?? row.tipo;
    if (dto.tipo && dto.tipo !== row.tipo) {
      this.assertPodeCriar(user, dto.tipo);
    }

    const inicio = dto.inicio ? parseDateTime(dto.inicio, "inicio") : row.inicio;
    const fim =
      dto.fim === null
        ? null
        : dto.fim
          ? parseDateTime(dto.fim, "fim")
          : row.fim;
    if (fim && fim.getTime() < inicio.getTime()) {
      throw new BadRequestException("fim deve ser posterior a inicio.");
    }

    let alvoUserIds = parseAlvoUserIds(row.alvoUserIds);
    let alvoRoles = parseAlvoRoles(row.alvoRoles);
    if (dto.alvoUserIds !== undefined || dto.alvoRoles !== undefined) {
      const resolved = await this.resolveDestinatarios(
        user,
        tipo,
        dto.alvoUserIds ?? alvoUserIds,
        (dto.alvoRoles ?? alvoRoles) as CalendarioAlvoRole[],
        tenantId,
      );
      alvoUserIds = resolved.alvoUserIds;
      alvoRoles = resolved.alvoRoles;
    }

    const entidadeClienteId =
      dto.entidadeClienteId === undefined
        ? row.entidadeClienteId
        : await this.resolveEntidadeClienteId(tenantId, dto.entidadeClienteId);

    return this.prisma.calendarioEvento.update({
      where: { id },
      data: {
        tipo,
        titulo: dto.titulo?.trim() ?? row.titulo,
        descricao:
          dto.descricao !== undefined ? dto.descricao?.trim() || null : row.descricao,
        inicio,
        fim,
        entidadeClienteId,
        alvoUserIds,
        alvoRoles,
      },
      include: NOTA_INCLUDE,
    });
  }

  async remove(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.calendarioEvento.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException("Evento de calendário não encontrado.");
    if (!userPodeEditarCalendarioEvento(user, row)) {
      throw new ForbiddenException("Sem permissão para remover este evento.");
    }
    await this.prisma.calendarioEvento.delete({ where: { id } });
    return { ok: true };
  }

  async listVisiveis(
    user: RequestUser,
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<CalendarioNotaResposta[]> {
    const userPrismaRole = await this.resolveUserPrismaRole(user);
    const rows = await this.prisma.calendarioEvento.findMany({
      where: {
        tenantId,
        inicio: { gte: start, lte: end },
      },
      orderBy: { inicio: "asc" },
      include: NOTA_INCLUDE,
    });
    return rows.filter((r) => userPodeVerCalendarioEvento(user, userPrismaRole, r));
  }

  private async resolveUserPrismaRole(user: RequestUser): Promise<TenantUserRole | null> {
    if (!user.sub) return null;
    const row = await this.prisma.user.findFirst({
      where: { id: user.sub },
      select: { role: true },
    });
    return row?.role ?? null;
  }

  private assertPodeCriar(user: RequestUser, tipo: "LEMBRETE" | "EVENTO") {
    if (tipo === "EVENTO" && user.role !== "tenant_manager") {
      throw new ForbiddenException("Apenas o gestor pode criar eventos com alvos.");
    }
    const allowed = new Set([
      "tenant_manager",
      "comercial",
      "formador",
      "formando",
      "super_admin",
    ]);
    if (!allowed.has(user.role)) {
      throw new ForbiddenException("Sem permissão para criar notas de calendário.");
    }
  }

  private async resolveEntidadeClienteId(
    tenantId: string,
    entidadeClienteId: string | null | undefined,
  ): Promise<string | null> {
    if (entidadeClienteId === null || entidadeClienteId === undefined || entidadeClienteId === "") {
      return null;
    }
    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: entidadeClienteId, tenantId },
      select: { id: true },
    });
    if (!entidade) {
      throw new BadRequestException("Cliente não encontrado.");
    }
    return entidade.id;
  }

  private async resolveDestinatarios(
    user: RequestUser,
    tipo: "LEMBRETE" | "EVENTO",
    alvoUserIds: string[],
    alvoRoles: CalendarioAlvoRole[],
    tenantId: string,
  ): Promise<{ alvoUserIds: string[]; alvoRoles: CalendarioAlvoRole[] }> {
    const hasDestinatarios = alvoUserIds.length > 0 || alvoRoles.length > 0;

    if (tipo === "LEMBRETE" && hasDestinatarios && user.role !== "tenant_manager") {
      throw new BadRequestException("Lembretes pessoais não podem ter destinatários.");
    }

    if (user.role !== "tenant_manager" && hasDestinatarios) {
      throw new ForbiddenException("Apenas o gestor pode atribuir destinatários.");
    }

    if (alvoUserIds.length > 0) {
      await this.assertUsersInTenant(alvoUserIds, tenantId);
    }

    return {
      alvoUserIds: [...new Set(alvoUserIds)],
      alvoRoles: [...new Set(alvoRoles)],
    };
  }

  private async assertUsersInTenant(userIds: string[], tenantId: string) {
    const unique = [...new Set(userIds)];
    const found = await this.prisma.user.findMany({
      where: { tenantId, id: { in: unique }, active: true },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException("Um ou mais destinatários são inválidos.");
    }
  }
}
