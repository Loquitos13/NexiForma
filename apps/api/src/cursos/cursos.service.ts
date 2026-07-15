import { Injectable, NotFoundException } from "@nestjs/common";
import type { Curso } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { FormadorNotificacoesService } from "../notificacoes/formador-notificacoes.service";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateCursoDto } from "./dto/create-curso.dto";
import type { UpdateCursoDto } from "./dto/update-curso.dto";

@Injectable()
export class CursosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorScope: FormadorScopeService,
    private readonly formadorNotificacoes: FormadorNotificacoesService,
  ) {}

  async list(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const cursoIds = await this.formadorScope.assignedCursoIds(user);
    return this.prisma.curso.findMany({
      where: {
        tenantId,
        ...(cursoIds ? { id: { in: cursoIds } } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        codigoUfcd: true,
        designacao: true,
        cargaHoras: true,
        modalidade: true,
        createdAt: true,
        _count: {
          select: { acoesFormacao: true },
        },
      },
    });
  }

  async getOne(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanEditCurso(user, id);
    const curso = await this.prisma.curso.findFirst({
      where: { id, tenantId },
      include: {
        acoesFormacao: {
          orderBy: { dataInicio: "desc" },
          take: 20,
          select: {
            id: true,
            codigoInterno: true,
            titulo: true,
            estado: true,
            dataInicio: true,
            dataFim: true,
          },
        },
      },
    });
    if (!curso) {
      throw new NotFoundException("Curso não encontrado.");
    }
    return curso;
  }

  async create(user: RequestUser, dto: CreateCursoDto): Promise<Curso> {
    const tenantId = requireTenantId(user);
    const curso = await this.prisma.curso.create({
      data: {
        tenantId,
        codigoUfcd: dto.codigoUfcd ?? null,
        designacao: dto.designacao,
        cargaHoras: dto.cargaHoras,
        modalidade: dto.modalidade,
        objetivos: dto.objetivos ?? null,
      },
    });
    void this.formadorNotificacoes.notifyCursoCrud(tenantId, curso.id, curso.designacao, "criado");
    return curso;
  }

  async update(user: RequestUser, id: string, dto: UpdateCursoDto) {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.curso.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException("Curso não encontrado.");
    }
    const updated = await this.prisma.curso.update({
      where: { id },
      data: {
        ...(dto.codigoUfcd !== undefined ? { codigoUfcd: dto.codigoUfcd || null } : {}),
        ...(dto.designacao !== undefined ? { designacao: dto.designacao } : {}),
        ...(dto.cargaHoras !== undefined ? { cargaHoras: dto.cargaHoras } : {}),
        ...(dto.modalidade !== undefined ? { modalidade: dto.modalidade } : {}),
        ...(dto.objetivos !== undefined ? { objetivos: dto.objetivos || null } : {}),
      },
    });
    void this.formadorNotificacoes.notifyCursoCrud(
      tenantId,
      updated.id,
      updated.designacao,
      "atualizado",
    );
    return updated;
  }
}
