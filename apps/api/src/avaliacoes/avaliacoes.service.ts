import { canManageFormacao } from "@nexiforma/shared";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { requireTenantId } from "../common/tenant-scope";
import { moduloIdFromPautaTipo, pautaTipo } from "./pauta.util";

@Injectable()
export class AvaliacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formadorScope: FormadorScopeService,
  ) {}

  list(user: RequestUser, matriculaId: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.avaliacaoFormando.findMany({
      where: { tenantId, matriculaId },
      orderBy: { avaliadoEm: "desc" },
    });
  }

  async create(
    user: RequestUser,
    matriculaId: string,
    data: { tipo?: string; nota?: number; observacoes?: string },
  ) {
    const tenantId = requireTenantId(user);
    const matricula = await this.prisma.matricula.findFirst({ where: { id: matriculaId, tenantId } });
    if (!matricula) throw new NotFoundException("Matrícula não encontrada.");

    return this.prisma.avaliacaoFormando.create({
      data: {
        tenantId,
        matriculaId,
        tipo: data.tipo ?? "final",
        nota: data.nota ?? null,
        observacoes: data.observacoes?.trim() || null,
      },
    });
  }

  /**
   * Pauta da acção: formandos × módulos.
   * Só notas introduzidas pelo formador/gestor (`pauta:{moduloUnidadeId}`).
   * Não mistura pontuações LMS / quizzes.
   */
  async getPautaAcao(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formador" && !canManageFormacao(user.role)) {
      throw new ForbiddenException("Sem permissão.");
    }
    await this.formadorScope.assertCanAccessAcao(user, acaoId);

    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: {
        id: true,
        cursoId: true,
        turmas: {
          select: {
            id: true,
            codigo: true,
            nome: true,
            matriculas: {
              where: { estado: "ATIVA" },
              select: {
                id: true,
                formando: { select: { nome: true, nif: true } },
              },
              orderBy: { formando: { nome: "asc" } },
            },
          },
          orderBy: { codigo: "asc" },
        },
      },
    });
    if (!acao) throw new NotFoundException("Acção não encontrada.");

    const [modulos, operaveis] = await Promise.all([
      this.prisma.moduloUnidade.findMany({
        where: { tenantId, cursoId: acao.cursoId },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
        select: { id: true, titulo: true, codigo: true, ordem: true },
      }),
      this.formadorScope.moduloIdsOperaveisNaAcao(user, acaoId),
    ]);

    const formandos = acao.turmas.flatMap((t) =>
      t.matriculas.map((m) => ({
        matriculaId: m.id,
        turmaId: t.id,
        turmaCodigo: t.codigo,
        nome: m.formando.nome,
        nif: m.formando.nif,
      })),
    );
    const matriculaIds = formandos.map((f) => f.matriculaId);

    const avaliacoes = matriculaIds.length
      ? await this.prisma.avaliacaoFormando.findMany({
          where: {
            tenantId,
            matriculaId: { in: matriculaIds },
            tipo: { startsWith: "pauta:" },
          },
          select: { id: true, matriculaId: true, tipo: true, nota: true },
          orderBy: { avaliadoEm: "desc" },
        })
      : [];

    const notaPautaMap = new Map<string, { avaliacaoId: string; nota: number | null }>();
    for (const a of avaliacoes) {
      const mid = moduloIdFromPautaTipo(a.tipo);
      if (!mid) continue;
      const key = `${a.matriculaId}:${mid}`;
      if (!notaPautaMap.has(key)) {
        notaPautaMap.set(key, { avaliacaoId: a.id, nota: a.nota });
      }
    }

    return {
      acaoId: acao.id,
      cursoId: acao.cursoId,
      turmas: acao.turmas.map((t) => ({ id: t.id, codigo: t.codigo, nome: t.nome })),
      modulos: modulos.map((m) => ({
        id: m.id,
        titulo: m.titulo,
        codigo: m.codigo,
        ordem: m.ordem,
        podeEditar: operaveis === null || operaveis.includes(m.id),
      })),
      formandos: formandos.map((f) => ({
        ...f,
        notas: Object.fromEntries(
          modulos.map((m) => {
            const pauta = notaPautaMap.get(`${f.matriculaId}:${m.id}`);
            const notaPauta = pauta?.nota ?? null;
            return [
              m.id,
              {
                notaPauta,
                nota: notaPauta,
                avaliacaoId: pauta?.avaliacaoId ?? null,
              },
            ];
          }),
        ),
      })),
    };
  }

  async upsertNotaPauta(
    user: RequestUser,
    matriculaId: string,
    moduloUnidadeId: string,
    nota: number | null,
  ) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formador" && !canManageFormacao(user.role)) {
      throw new ForbiddenException("Sem permissão.");
    }
    if (nota != null && (!Number.isFinite(nota) || nota < 0 || nota > 100)) {
      throw new BadRequestException("Nota deve estar entre 0 e 100.");
    }

    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      select: {
        id: true,
        turma: {
          select: {
            acaoFormacaoId: true,
            acaoFormacao: { select: { cursoId: true } },
          },
        },
      },
    });
    if (!matricula) throw new NotFoundException("Matrícula não encontrada.");

    const unidade = await this.prisma.moduloUnidade.findFirst({
      where: {
        id: moduloUnidadeId,
        tenantId,
        cursoId: matricula.turma.acaoFormacao.cursoId,
      },
      select: { id: true },
    });
    if (!unidade) throw new NotFoundException("Módulo não encontrado nesta acção.");

    await this.formadorScope.assertCanLiberarModuloNaAcao(
      user,
      matricula.turma.acaoFormacaoId,
      moduloUnidadeId,
    );

    const tipo = pautaTipo(moduloUnidadeId);
    const existing = await this.prisma.avaliacaoFormando.findFirst({
      where: { tenantId, matriculaId, tipo },
      orderBy: { avaliadoEm: "desc" },
    });

    if (existing) {
      return this.prisma.avaliacaoFormando.update({
        where: { id: existing.id },
        data: { nota, avaliadoEm: new Date() },
      });
    }

    return this.prisma.avaliacaoFormando.create({
      data: {
        tenantId,
        matriculaId,
        tipo,
        nota,
      },
    });
  }
}
