import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Curso } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { FormadorNotificacoesService } from "../notificacoes/formador-notificacoes.service";
import { CatalogoUfcdService } from "../catalogo-ufcd/catalogo-ufcd.service";
import { requireTenantId } from "../common/tenant-scope";
import type { CreateCursoDto } from "./dto/create-curso.dto";
import type { UpdateCursoDto } from "./dto/update-curso.dto";
import { normalizeCursoCodigoUfcd } from "./cursos-ufcd.util";
import { normalizeConfiguracaoMatriculaDocs } from "../formandos/documentos-politica.util";

@Injectable()
export class CursosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorScope: FormadorScopeService,
    private readonly formadorNotificacoes: FormadorNotificacoesService,
    private readonly catalogoUfcd: CatalogoUfcdService,
  ) {}

  async list(user: RequestUser): Promise<
    Array<{
      id: string;
      codigoUfcd: string | null;
      designacao: string;
      cargaHoras: number;
      modalidade: string;
      configuracaoMatricula: Prisma.JsonValue;
      createdAt: Date;
      _count: { acoesFormacao: number; modulosConteudo: number };
    }>
  > {
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
        configuracaoMatricula: true,
        createdAt: true,
        _count: {
          select: { acoesFormacao: true, modulosConteudo: true },
        },
      },
    });
  }

  async getOne(user: RequestUser, id: string): Promise<unknown> {
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
    const codigoUfcd = await this.resolveCodigoUfcd(dto.codigoUfcd, dto.designacao);
    const curso = await this.prisma.curso.create({
      data: {
        tenantId,
        codigoUfcd,
        designacao: dto.designacao,
        cargaHoras: dto.cargaHoras,
        modalidade: dto.modalidade,
        objetivos: dto.objetivos ?? null,
      },
    });
    void this.formadorNotificacoes.notifyCursoCrud(tenantId, curso.id, curso.designacao, "criado");
    return curso;
  }

  async update(user: RequestUser, id: string, dto: UpdateCursoDto): Promise<Curso> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.curso.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException("Curso não encontrado.");
    }
    const codigoUfcd =
      dto.codigoUfcd !== undefined
        ? await this.resolveCodigoUfcd(dto.codigoUfcd, dto.designacao ?? existing.designacao)
        : undefined;
    const updated = await this.prisma.curso.update({
      where: { id },
      data: {
        ...(codigoUfcd !== undefined ? { codigoUfcd } : {}),
        ...(dto.designacao !== undefined ? { designacao: dto.designacao } : {}),
        ...(dto.cargaHoras !== undefined ? { cargaHoras: dto.cargaHoras } : {}),
        ...(dto.modalidade !== undefined ? { modalidade: dto.modalidade } : {}),
        ...(dto.objetivos !== undefined ? { objetivos: dto.objetivos || null } : {}),
        ...(dto.configuracaoMatricula !== undefined
          ? {
              configuracaoMatricula:
                dto.configuracaoMatricula === null
                  ? Prisma.DbNull
                  : (normalizeConfiguracaoMatriculaDocs(
                      dto.configuracaoMatricula as never,
                    ) as Prisma.InputJsonValue),
            }
          : {}),
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

  async remove(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.curso.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        designacao: true,
        _count: { select: { acoesFormacao: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException("Curso não encontrado.");
    }
    if (existing._count.acoesFormacao > 0) {
      throw new BadRequestException(
        `Não é possível eliminar: o curso tem ${existing._count.acoesFormacao} acção(ões) de formação. Elimine primeiro as acções associadas.`,
      );
    }
    await this.prisma.curso.delete({ where: { id } });
    return { ok: true, eliminado: true, id, designacao: existing.designacao };
  }

  /** Código vazio → null; se existir usa o código, se não existir auto-regista no catálogo. */
  private async resolveCodigoUfcd(raw?: string | null, designacaoCurso?: string): Promise<string | null> {
    const codigo = normalizeCursoCodigoUfcd(raw);
    if (!codigo) return null;
    try {
      const ufcd = await this.catalogoUfcd.getOne(codigo);
      return ufcd.codigo;
    } catch {
      try {
        await this.prisma.catalogoUfcd.upsert({
          where: { codigo },
          update: { activo: true },
          create: {
            codigo,
            designacao: designacaoCurso ? `UFCD ${codigo} · ${designacaoCurso}` : `UFCD ${codigo}`,
            area: "Geral",
            cargaHoras: 25,
            activo: true,
          },
        });
      } catch {
        /* ignora falha de upsert */
      }
      return codigo;
    }
  }
}
