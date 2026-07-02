import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AcaoEstado } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateAcaoFormacaoDto } from "./dto/create-acao-formacao.dto";
import type { UpdateAcaoFormacaoDto } from "./dto/update-acao-formacao.dto";

function toPgDate(raw: string, field: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Data inválida (${field}).`);
  }
  return d;
}

const ESTADOS: AcaoEstado[] = ["PLANEADA", "EM_CURSO", "CONCLUIDA", "CANCELADA"];

@Injectable()
export class AcoesFormacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorScope: FormadorScopeService,
  ) {}

  async list(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const acaoIds = await this.formadorScope.assignedAcaoIds(user);
    return this.prisma.acaoFormacao.findMany({
      where: {
        tenantId,
        ...(acaoIds ? { id: { in: acaoIds } } : {}),
      },
      orderBy: { dataInicio: "desc" },
      take: 80,
      select: {
        id: true,
        codigoInterno: true,
        titulo: true,
        estado: true,
        dataInicio: true,
        dataFim: true,
        curso: {
          select: { id: true, designacao: true, modalidade: true },
        },
        _count: { select: { turmas: true } },
      },
    });
  }

  async create(user: RequestUser, dto: CreateAcaoFormacaoDto): Promise<unknown> {
    const tenantId = requireTenantId(user);

    const curso = await this.prisma.curso.findFirst({
      where: { id: dto.cursoId, tenantId },
    });
    if (!curso) {
      throw new NotFoundException("Curso inexistente ou de outro tenant.");
    }

    const clash = await this.prisma.acaoFormacao.findFirst({
      where: { tenantId, codigoInterno: dto.codigoInterno.trim() },
    });
    if (clash) {
      throw new ConflictException("Este código interno já está a ser usado no tenant.");
    }

    let estado: AcaoEstado = "PLANEADA";
    if (dto.estado) {
      const u = dto.estado.toUpperCase() as AcaoEstado;
      if (!ESTADOS.includes(u)) {
        throw new BadRequestException("Estado de ação inválido.");
      }
      estado = u;
    }

    const dataInicio = toPgDate(dto.dataInicio, "dataInicio");
    const dataFim = toPgDate(dto.dataFim, "dataFim");
    if (dataFim.getTime() < dataInicio.getTime()) {
      throw new BadRequestException("dataFim deve ser igual ou posterior a dataInicio.");
    }

    return this.prisma.acaoFormacao.create({
      data: {
        tenantId,
        cursoId: dto.cursoId,
        codigoInterno: dto.codigoInterno.trim(),
        titulo: dto.titulo,
        dataInicio,
        dataFim,
        estado,
      },
      include: {
        curso: { select: { id: true, designacao: true, modalidade: true } },
      },
    });
  }

  async getOne(user: RequestUser, id: string): Promise<unknown> {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanAccessAcao(user, id);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id, tenantId },
      include: {
        curso: true,
        turmas: {
          orderBy: { codigo: "asc" },
          include: { _count: { select: { matriculas: true } } },
        },
        cronogramas: {
          orderBy: { versao: "desc" },
          take: 1,
          include: { _count: { select: { sessoes: true } } },
        },
        _count: { select: { turmas: true } },
      },
    });
    if (!acao) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }
    return acao;
  }

  async update(user: RequestUser, id: string, dto: UpdateAcaoFormacaoDto): Promise<unknown> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.acaoFormacao.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }

    const dataInicio = dto.dataInicio ? toPgDate(dto.dataInicio, "dataInicio") : existing.dataInicio;
    const dataFim = dto.dataFim ? toPgDate(dto.dataFim, "dataFim") : existing.dataFim;
    if (dataFim.getTime() < dataInicio.getTime()) {
      throw new BadRequestException("dataFim deve ser igual ou posterior a dataInicio.");
    }

    let prazoConclusaoLms = existing.prazoConclusaoLms;
    if (dto.prazoConclusaoLms !== undefined) {
      prazoConclusaoLms = dto.prazoConclusaoLms
        ? toPgDate(dto.prazoConclusaoLms, "prazoConclusaoLms")
        : null;
    }
    if (prazoConclusaoLms && prazoConclusaoLms.getTime() < dataInicio.getTime()) {
      throw new BadRequestException(
        "prazoConclusaoLms deve ser igual ou posterior a dataInicio.",
      );
    }

    let estado = existing.estado;
    if (dto.estado) {
      if (!ESTADOS.includes(dto.estado)) {
        throw new BadRequestException("Estado de ação inválido.");
      }
      estado = dto.estado;
    }

    return this.prisma.acaoFormacao.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        dataInicio,
        dataFim,
        prazoConclusaoLms,
        estado,
      },
      include: {
        curso: { select: { id: true, designacao: true, modalidade: true, codigoUfcd: true } },
      },
    });
  }
}
