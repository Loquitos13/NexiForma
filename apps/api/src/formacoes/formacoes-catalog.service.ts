import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import {
  CATALOG_PAGE_DEFAULT,
  CATALOG_PAGE_MAX,
} from "./formacoes-website.types";

const CURSO_PUBLIC_SELECT = {
  id: true,
  codigoPublico: true,
  designacao: true,
  cargaHoras: true,
  codigoUfcd: true,
  enquadramento: true,
  objetivos: true,
  metodoEnsino: true,
  modalidade: true,
  coverStorageKey: true,
  publicado: true,
  createdAt: true,
} as const;

const ACAO_PUBLIC_SELECT = {
  id: true,
  cursoId: true,
  codigoInterno: true,
  titulo: true,
  dataInicio: true,
  dataFim: true,
  estado: true,
  inscricoesEstado: true,
  publicado: true,
  agendaTemplate: true,
} as const;

const SESSAO_PUBLIC_SELECT = {
  id: true,
  numeroSessao: true,
  data: true,
  horaInicio: true,
  horaFim: true,
  local: true,
  estado: true,
} as const;

@Injectable()
export class FormacoesCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Catálogo paginado - 2 queries (cursos + acoes), sem N+1. */
  async getPublicCatalogPage(
    tenantId: string,
    opts?: { limit?: number; afterCodigo?: number },
  ) {
    const limit = Math.min(
      Math.max(opts?.limit ?? CATALOG_PAGE_DEFAULT, 1),
      CATALOG_PAGE_MAX,
    );

    const cursos = await this.prisma.curso.findMany({
      where: {
        tenantId,
        publicado: true,
        ...(opts?.afterCodigo != null
          ? { codigoPublico: { gt: opts.afterCodigo } }
          : {}),
      },
      orderBy: { codigoPublico: "asc" },
      take: limit + 1,
      select: CURSO_PUBLIC_SELECT,
    });

    const hasMore = cursos.length > limit;
    const page = hasMore ? cursos.slice(0, limit) : cursos;
    const cursoIds = page.map((c) => c.id);

    const acoes =
      cursoIds.length === 0
        ? []
        : await this.prisma.acaoFormacao.findMany({
            where: {
              tenantId,
              cursoId: { in: cursoIds },
              publicado: true,
            },
            orderBy: { dataInicio: "asc" },
            select: {
              ...ACAO_PUBLIC_SELECT,
              cronogramas: {
                orderBy: { versao: "desc" },
                take: 1,
                select: {
                  sessoes: {
                    orderBy: { numeroSessao: "asc" },
                    take: 12,
                    select: SESSAO_PUBLIC_SELECT,
                  },
                },
              },
              turmas: {
                take: 1,
                orderBy: { codigo: "asc" },
                select: {
                  _count: {
                    select: { matriculas: { where: { estado: "ATIVA" } } },
                  },
                },
              },
            },
          });

    const acoesByCurso = new Map<string, typeof acoes>();
    for (const a of acoes) {
      const list = acoesByCurso.get(a.cursoId) ?? [];
      list.push(a);
      acoesByCurso.set(a.cursoId, list);
    }

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const items = page.map((c) =>
      this.mapCursoPublico(c, acoesByCurso.get(c.id) ?? [], appUrl),
    );

    const last = page[page.length - 1];
    return {
      items,
      pageInfo: {
        hasMore,
        nextCursor: hasMore && last?.codigoPublico != null ? last.codigoPublico : null,
        limit,
      },
    };
  }

  /** Export completo para webhook (máx. 500 formações por tenant). */
  async getFullPublicCatalog(tenantId: string) {
    const all: unknown[] = [];
    let after: number | undefined;
    for (;;) {
      const page = await this.getPublicCatalogPage(tenantId, {
        limit: CATALOG_PAGE_MAX,
        afterCodigo: after,
      });
      all.push(...page.items);
      if (!page.pageInfo.hasMore || page.pageInfo.nextCursor == null) break;
      after = page.pageInfo.nextCursor;
      if (all.length >= 500) break;
    }
    return { formacoes: all, total: all.length };
  }

  async getFormacaoPublicaByUuid(tenantId: string, cursoUuid: string, appUrl: string) {
    const curso = await this.prisma.curso.findFirst({
      where: { id: cursoUuid, tenantId, publicado: true },
      select: CURSO_PUBLIC_SELECT,
    });
    if (!curso) return null;

    const acoes = await this.prisma.acaoFormacao.findMany({
      where: { tenantId, cursoId: cursoUuid, publicado: true },
      orderBy: { dataInicio: "asc" },
      select: {
        ...ACAO_PUBLIC_SELECT,
        cronogramas: {
          orderBy: { versao: "desc" },
          take: 1,
          select: {
            sessoes: {
              orderBy: { numeroSessao: "asc" },
              select: SESSAO_PUBLIC_SELECT,
            },
          },
        },
        turmas: {
          take: 1,
          orderBy: { codigo: "asc" },
          select: {
            _count: {
              select: { matriculas: { where: { estado: "ATIVA" } } },
            },
          },
        },
      },
    });

    return this.mapCursoPublico(curso, acoes, appUrl);
  }

  private mapCursoPublico(
    c: {
      id: string;
      codigoPublico: number | null;
      designacao: string;
      cargaHoras: number;
      codigoUfcd: string | null;
      enquadramento: string | null;
      objetivos: string | null;
      metodoEnsino: string | null;
      modalidade: string;
      coverStorageKey: string | null;
      publicado: boolean;
      createdAt: Date;
    },
    acoes: Array<{
      id: string;
      codigoInterno: string;
      titulo: string;
      dataInicio: Date;
      dataFim: Date;
      estado: string;
      inscricoesEstado: string;
      publicado: boolean;
      agendaTemplate: unknown;
      cronogramas: Array<{
        sessoes: Array<{
          id: string;
          numeroSessao: number;
          data: Date;
          horaInicio: string;
          horaFim: string;
          local: string | null;
          estado: string;
        }>;
      }>;
      turmas: Array<{ _count: { matriculas: number } }>;
    }>,
    appUrl: string,
  ) {
    const capaPath = c.coverStorageKey
      ? `/api/v1/public/v1/formacoes/${c.codigoPublico}/capa`
      : null;

    return {
      id: c.codigoPublico,
      uuid: c.id,
      titulo: c.designacao,
      horas: c.cargaHoras,
      ufcd: c.codigoUfcd,
      enquadramento: c.enquadramento,
      objetivos: c.objetivos,
      metodoEnsino: c.metodoEnsino,
      modalidade: c.modalidade,
      publicado: c.publicado,
      capaUrl: capaPath ? `${appUrl}${capaPath}` : null,
      acoes: acoes.map((a) => {
        const sessoes = a.cronogramas[0]?.sessoes ?? [];
        return {
          id: a.id,
          codigoInterno: a.codigoInterno,
          titulo: a.titulo,
          dataInicio: a.dataInicio.toISOString().slice(0, 10),
          dataFim: a.dataFim.toISOString().slice(0, 10),
          estado: a.estado,
          inscricoes: a.inscricoesEstado,
          publicado: a.publicado,
          agenda: a.agendaTemplate,
          inscritos: a.turmas[0]?._count.matriculas ?? 0,
          sessoes: sessoes.map((s) => ({
            id: s.id,
            numero: s.numeroSessao,
            data: s.data.toISOString().slice(0, 10),
            horaInicio: s.horaInicio,
            horaFim: s.horaFim,
            local: s.local,
            estado: s.estado,
          })),
        };
      }),
      updatedAt: c.createdAt.toISOString(),
    };
  }
}
