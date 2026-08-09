import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PropostaComercial, PropostaEstado, Prisma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import { PropostaNotificacoesService } from "../notificacoes/proposta-notificacoes.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { parseDateRangeFilter } from "../common/date-range.util";
import {
  countsFromGroupBy,
  parseListPagination,
  type PaginatedList,
} from "../common/paginated-list.util";
import {
  assertPropostaAcessivel,
  propostaScopeWhere,
  resolvePropostaListFilters,
} from "../common/comercial-scope.util";
import { resolveTenantLogoDataUri } from "../common/tenant-logo-embed.util";
import { requireTenantId } from "../common/tenant-scope";
import { StorageService } from "../storage/storage.service";
import type { CreatePropostaDto, UpdatePropostaDto } from "./dto/proposta.dto";
import type { UpdateConfigPropostaDto } from "./dto/proposta-config.dto";
import type { PropostaLinhaDto } from "./dto/proposta-linha.dto";
import { buildPropostaHtmlDocument } from "./proposta-html.util";
import {
  DEFAULTS_PROPOSTA_TEMPLATE,
  configRowToTemplate,
  extractPropostaConteudo,
  type ConfigPropostaTemplate,
} from "./proposta-template.util";
import {
  normalizePropostaLinhas,
  totaisPropostaLinhas,
} from "./proposta-linhas.util";

const PROPOSTA_LIST_INCLUDE = {
  entidadeCliente: { select: { id: true, nome: true, nif: true, email: true } },
  curso: { select: { designacao: true } },
  fatura: { select: { id: true, estado: true } },
  criadoPor: { select: { id: true, displayName: true, email: true } },
  enviadaPor: { select: { id: true, displayName: true, email: true } },
};

export type PropostaListFilters = {
  entidadeClienteId?: string;
  estado?: string;
  q?: string;
  comercialUserId?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: string;
  pageSize?: string;
  /** Coluna de ordenação global (antes da paginação). */
  sortBy?: string;
  sortDir?: string;
};

type PropostaSortSlim = {
  id: string;
  codigo: string;
  valorCentavos: number;
  validadeAte: Date | null;
  estado: string;
  updatedAt: Date;
  entidadeCliente: { nome: string } | null;
  criadoPor: { displayName: string | null } | null;
  enviadaPor: { displayName: string | null } | null;
};

function compareNullableString(a: string | null | undefined, b: string | null | undefined, dir: 1 | -1): number {
  const emptyA = !a?.trim();
  const emptyB = !b?.trim();
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  return a!.localeCompare(b!, "pt", { sensitivity: "base" }) * dir;
}

function comparePropostaSortSlim(
  a: PropostaSortSlim,
  b: PropostaSortSlim,
  sortBy: string,
  sortDir: "asc" | "desc",
): number {
  const dir: 1 | -1 = sortDir === "desc" ? -1 : 1;

  if (sortBy === "codigo") {
    return compareNullableString(a.codigo, b.codigo, dir);
  }
  if (sortBy === "entidadeCliente") {
    return compareNullableString(a.entidadeCliente?.nome, b.entidadeCliente?.nome, dir);
  }
  if (sortBy === "valorCentavos") {
    return (a.valorCentavos - b.valorCentavos) * dir;
  }
  if (sortBy === "validadeAte") {
    if (!a.validadeAte && !b.validadeAte) return 0;
    if (!a.validadeAte) return 1;
    if (!b.validadeAte) return -1;
    return (a.validadeAte.getTime() - b.validadeAte.getTime()) * dir;
  }
  if (sortBy === "autoria") {
    const nameA = a.criadoPor?.displayName?.trim() || a.enviadaPor?.displayName?.trim() || "";
    const nameB = b.criadoPor?.displayName?.trim() || b.enviadaPor?.displayName?.trim() || "";
    return compareNullableString(nameA, nameB, dir);
  }

  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function buildPropostaWhere(
  tenantId: string,
  filters?: PropostaListFilters,
  opts?: { omitEstado?: boolean },
): Prisma.PropostaComercialWhereInput {
  const where: Prisma.PropostaComercialWhereInput = { tenantId };

  if (filters?.entidadeClienteId) {
    where.entidadeClienteId = filters.entidadeClienteId;
  }
  if (filters?.estado && !opts?.omitEstado) {
    where.estado = filters.estado as PropostaEstado;
  }
  if (filters?.comercialUserId) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { criadoPorUserId: filters.comercialUserId },
          { enviadaPorUserId: filters.comercialUserId },
        ],
      },
    ];
  }
  const createdRange = parseDateRangeFilter(filters?.dataInicio, filters?.dataFim);
  if (createdRange) where.createdAt = createdRange;

  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    const nifDigits = q.replace(/\D/g, "");
    const or: Prisma.PropostaComercialWhereInput[] = [
      { entidadeCliente: { nome: { contains: q, mode: "insensitive" } } },
    ];
    if (nifDigits.length >= 3) {
      or.push({ entidadeCliente: { nif: { contains: nifDigits } } });
    }
    where.OR = or;
  }

  return where;
}

const PROPOSTA_INCLUDE = {
  entidadeCliente: { select: { id: true, nome: true, nif: true, email: true } },
  curso: { select: { id: true, designacao: true, codigoUfcd: true, cargaHoras: true } },
  fatura: { select: { id: true, estado: true } },
  criadoPor: { select: { id: true, displayName: true, email: true } },
  enviadaPor: { select: { id: true, displayName: true, email: true } },
  linhas: { orderBy: { ordem: "asc" as const } },
};

@Injectable()
export class PropostasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propostaNotificacoes: PropostaNotificacoesService,
    private readonly storage: StorageService,
  ) {}

  async list(
    user: RequestUser,
    filters?: PropostaListFilters,
  ): Promise<PaginatedList<PropostaComercial>> {
    const tenantId = requireTenantId(user);
    const pagination = parseListPagination(filters?.page, filters?.pageSize);
    const scopedFilters = resolvePropostaListFilters(user, filters);
    const where = buildPropostaWhere(tenantId, scopedFilters);
    const whereForCounts = buildPropostaWhere(tenantId, scopedFilters, {
      omitEstado: true,
    });

    const sortBy = filters?.sortBy?.trim() || "";
    const sortDir = filters?.sortDir === "desc" ? "desc" : "asc";
    const hasCustomSort = Boolean(sortBy) && sortBy !== "estado";

    const [total, countRows, items] = await Promise.all([
      this.prisma.propostaComercial.count({ where }),
      this.prisma.propostaComercial.groupBy({
        by: ["estado"],
        where: whereForCounts,
        _count: { _all: true },
      }),
      (async () => {
        if (!hasCustomSort) {
          return this.prisma.propostaComercial.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip: pagination.skip,
            take: pagination.take,
            include: PROPOSTA_LIST_INCLUDE,
          });
        }

        // Ordena o conjunto filtrado completo e só depois pagina.
        const slim = (await this.prisma.propostaComercial.findMany({
          where,
          select: {
            id: true,
            codigo: true,
            valorCentavos: true,
            validadeAte: true,
            estado: true,
            updatedAt: true,
            entidadeCliente: { select: { nome: true } },
            criadoPor: { select: { displayName: true } },
            enviadaPor: { select: { displayName: true } },
          },
        })) as PropostaSortSlim[];

        slim.sort((a, b) => comparePropostaSortSlim(a, b, sortBy, sortDir));
        const pageIds = slim
          .slice(pagination.skip, pagination.skip + pagination.take)
          .map((row) => row.id);
        if (pageIds.length === 0) return [];

        const pageRows = await this.prisma.propostaComercial.findMany({
          where: { tenantId, id: { in: pageIds } },
          include: PROPOSTA_LIST_INCLUDE,
        });
        const byId = new Map(pageRows.map((row) => [row.id, row]));
        return pageIds.map((id) => byId.get(id)).filter(Boolean) as typeof pageRows;
      })(),
    ]);

    return {
      items: items as PropostaComercial[],
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      countsByEstado: countsFromGroupBy(countRows),
    };
  }

  async getOne(user: RequestUser, id: string): Promise<PropostaComercial> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.propostaComercial.findFirst({
      where: { id, tenantId },
      include: PROPOSTA_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException("Proposta não encontrada.");
    }
    assertPropostaAcessivel(user, row);
    return row;
  }

  async getConfig(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const config = await this.ensureConfigProposta(tenantId);
    return { config: this.toConfigTemplate(config) };
  }

  async updateConfig(user: RequestUser, dto: UpdateConfigPropostaDto) {
    const tenantId = requireTenantId(user);
    const existing = await this.ensureConfigProposta(tenantId);
    const config = await this.prisma.configPropostaTenant.update({
      where: { tenantId },
      data: {
        apresentacaoEmpresa:
          dto.apresentacaoEmpresa !== undefined
            ? dto.apresentacaoEmpresa?.trim() || null
            : existing.apresentacaoEmpresa,
        enquadramentoPadrao:
          dto.enquadramentoPadrao !== undefined
            ? dto.enquadramentoPadrao?.trim() || null
            : existing.enquadramentoPadrao,
        objetivosPadrao:
          dto.objetivosPadrao !== undefined
            ? dto.objetivosPadrao?.trim() || null
            : existing.objetivosPadrao,
        conteudosProgramaticosPadrao:
          dto.conteudosProgramaticosPadrao !== undefined
            ? dto.conteudosProgramaticosPadrao?.trim() || null
            : existing.conteudosProgramaticosPadrao,
        metodologiaPadrao:
          dto.metodologiaPadrao !== undefined
            ? dto.metodologiaPadrao?.trim() || null
            : existing.metodologiaPadrao,
        destinatariosPadrao:
          dto.destinatariosPadrao !== undefined
            ? dto.destinatariosPadrao?.trim() || null
            : existing.destinatariosPadrao,
        duracaoTextoPadrao:
          dto.duracaoTextoPadrao !== undefined
            ? dto.duracaoTextoPadrao?.trim() || null
            : existing.duracaoTextoPadrao,
        localTextoPadrao:
          dto.localTextoPadrao !== undefined
            ? dto.localTextoPadrao?.trim() || null
            : existing.localTextoPadrao,
        beneficiosPadrao:
          dto.beneficiosPadrao !== undefined
            ? dto.beneficiosPadrao?.trim() || null
            : existing.beneficiosPadrao,
        condicoesComerciaisPadrao:
          dto.condicoesComerciaisPadrao !== undefined
            ? dto.condicoesComerciaisPadrao?.trim() || null
            : existing.condicoesComerciaisPadrao,
        porqueEscolherPadrao:
          dto.porqueEscolherPadrao !== undefined
            ? dto.porqueEscolherPadrao?.trim() || null
            : existing.porqueEscolherPadrao,
        proximosPassosPadrao:
          dto.proximosPassosPadrao !== undefined
            ? dto.proximosPassosPadrao?.trim() || null
            : existing.proximosPassosPadrao,
        validadeDiasPadrao: dto.validadeDiasPadrao ?? existing.validadeDiasPadrao,
        nomeContacto:
          dto.nomeContacto !== undefined ? dto.nomeContacto?.trim() || null : existing.nomeContacto,
        emailContacto:
          dto.emailContacto !== undefined
            ? dto.emailContacto?.trim() || null
            : existing.emailContacto,
        telefoneContacto:
          dto.telefoneContacto !== undefined
            ? dto.telefoneContacto?.trim() || null
            : existing.telefoneContacto,
        website: dto.website !== undefined ? dto.website?.trim() || null : existing.website,
      },
    });
    return { config: this.toConfigTemplate(config) };
  }

  async create(user: RequestUser, dto: CreatePropostaDto): Promise<PropostaComercial> {
    const tenantId = requireTenantId(user);
    await this.assertEntidade(tenantId, dto.entidadeClienteId);
    if (dto.cursoId) {
      await this.assertCurso(tenantId, dto.cursoId);
    }

    const config = await this.ensureConfigProposta(tenantId);
    const codigo = (dto.codigo?.trim() || `PROP-${Date.now().toString(36).toUpperCase()}`).toUpperCase();
    const dup = await this.prisma.propostaComercial.findFirst({ where: { tenantId, codigo } });
    if (dup) {
      throw new ConflictException("Código de proposta já existe.");
    }

    const linhasNorm = this.parseLinhasDto(dto.linhas);
    const valorCentavos = linhasNorm.length
      ? totaisPropostaLinhas(linhasNorm).valorCentavos
      : (dto.valorCentavos ?? 0);

    let validadeAte: Date | null = dto.validadeAte ? new Date(dto.validadeAte) : null;
    if (!validadeAte && config.validadeDiasPadrao > 0) {
      validadeAte = new Date();
      validadeAte.setDate(validadeAte.getDate() + config.validadeDiasPadrao);
    }

    return this.prisma.propostaComercial.create({
      data: {
        tenantId,
        entidadeClienteId: dto.entidadeClienteId,
        codigo,
        titulo: dto.titulo.trim(),
        subtitulo: dto.subtitulo?.trim() || null,
        descricao: dto.descricao?.trim() || null,
        ...this.mapConteudoFromDto(dto),
        valorCentavos,
        validadeAte,
        cursoId: dto.cursoId ?? null,
        notasInternas: dto.notasInternas?.trim() || null,
        criadoPorUserId: user.sub,
        ...(linhasNorm.length
          ? {
              linhas: {
                create: linhasNorm.map((l, i) => ({
                  ordem: i + 1,
                  descricao: l.descricao,
                  notas: l.notas,
                  quantidade: l.quantidade,
                  precoUnitCentavos: l.precoUnitCentavos,
                  taxaIva: l.taxaIva,
                  valorIvaCentavos: l.valorIvaCentavos,
                })),
              },
            }
          : {}),
      },
      include: PROPOSTA_INCLUDE,
    });
  }

  async remove(user: RequestUser, id: string): Promise<{ ok: true }> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.propostaComercial.findFirst({
      where: { id, tenantId },
      include: { fatura: { select: { id: true } } },
    });
    if (!existing) {
      throw new NotFoundException("Proposta não encontrada.");
    }
    assertPropostaAcessivel(user, existing);
    if (existing.fatura) {
      throw new BadRequestException(
        "Não é possível eliminar uma proposta com fatura associada. Remova ou anule a fatura primeiro.",
      );
    }

    await this.prisma.propostaComercial.delete({ where: { id } });
    return { ok: true };
  }

  async update(user: RequestUser, id: string, dto: UpdatePropostaDto): Promise<PropostaComercial> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.propostaComercial.findFirst({
      where: { id, tenantId },
      include: { linhas: true },
    });
    if (!existing) {
      throw new NotFoundException("Proposta não encontrada.");
    }
    assertPropostaAcessivel(user, existing);
    if (dto.cursoId) {
      await this.assertCurso(tenantId, dto.cursoId);
    }

    const linhasNorm = dto.linhas !== undefined ? this.parseLinhasDto(dto.linhas) : null;
    const valorCentavos =
      linhasNorm && linhasNorm.length > 0
        ? totaisPropostaLinhas(linhasNorm).valorCentavos
        : (dto.valorCentavos ?? existing.valorCentavos);

    const estadoNovo = (dto.estado as PropostaEstado | undefined) ?? existing.estado;
    const conteudoPatch = this.mapConteudoFromDto(dto as Partial<CreatePropostaDto>, existing);

    await this.prisma.$transaction(async (tx) => {
      if (linhasNorm !== null) {
        await tx.propostaLinha.deleteMany({ where: { propostaId: id } });
        if (linhasNorm.length > 0) {
          await tx.propostaLinha.createMany({
            data: linhasNorm.map((l, i) => ({
              propostaId: id,
              ordem: i + 1,
              descricao: l.descricao,
              notas: l.notas,
              quantidade: l.quantidade,
              precoUnitCentavos: l.precoUnitCentavos,
              taxaIva: l.taxaIva,
              valorIvaCentavos: l.valorIvaCentavos,
            })),
          });
        }
      }

      await tx.propostaComercial.update({
        where: { id },
        data: {
          titulo: dto.titulo?.trim() ?? existing.titulo,
          subtitulo:
            dto.subtitulo !== undefined ? dto.subtitulo?.trim() || null : existing.subtitulo,
          descricao: dto.descricao !== undefined ? dto.descricao?.trim() || null : existing.descricao,
          ...conteudoPatch,
          valorCentavos,
          estado: estadoNovo,
          validadeAte:
            dto.validadeAte !== undefined
              ? dto.validadeAte
                ? new Date(dto.validadeAte)
                : null
              : existing.validadeAte,
          cursoId: dto.cursoId !== undefined ? dto.cursoId : existing.cursoId,
          notasInternas:
            dto.notasInternas !== undefined ? dto.notasInternas?.trim() || null : existing.notasInternas,
        },
      });
    });

    if (estadoNovo !== existing.estado) {
      await this.propostaNotificacoes.aoAlterarEstado(
        tenantId,
        id,
        existing.estado,
        estadoNovo,
      );
    }

    return this.getOne(user, id);
  }

  resumo(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const scope = propostaScopeWhere(user);
    return this.prisma.propostaComercial.groupBy({
      by: ["estado"],
      where: scope ? { tenantId, AND: [scope] } : { tenantId },
      _count: { _all: true },
      _sum: { valorCentavos: true },
    });
  }

  async buildPropostaHtml(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const [row, configRow, tenantMeta] = await Promise.all([
      this.prisma.propostaComercial.findFirst({
        where: { id, tenantId },
        include: {
          tenant: { select: { legalName: true, nif: true } },
          entidadeCliente: { select: { nome: true, nif: true, email: true } },
          curso: { select: { designacao: true, codigoUfcd: true, cargaHoras: true } },
          linhas: { orderBy: { ordem: "asc" } },
        },
      }),
      this.ensureConfigProposta(tenantId),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { metadata: true },
      }),
    ]);
    if (!row) {
      throw new NotFoundException("Proposta não encontrada.");
    }
    assertPropostaAcessivel(user, row);
    const logoSrc = await resolveTenantLogoDataUri(this.storage, tenantMeta?.metadata);

    return buildPropostaHtmlDocument({
      codigo: row.codigo,
      titulo: row.titulo,
      subtitulo: row.subtitulo,
      descricao: row.descricao,
      moeda: row.moeda,
      valorCentavos: row.valorCentavos,
      validadeAte: row.validadeAte,
      createdAt: row.createdAt,
      tenant: row.tenant,
      entidadeCliente: row.entidadeCliente,
      curso: row.curso,
      conteudo: extractPropostaConteudo(row),
      config: this.toConfigTemplate(configRow),
      logoSrc,
      linhas: row.linhas.map((l: (typeof row.linhas)[number]) => ({
        descricao: l.descricao,
        notas: l.notas,
        quantidade: Number(l.quantidade),
        precoUnitCentavos: l.precoUnitCentavos,
        taxaIva: Number(l.taxaIva),
        valorIvaCentavos: l.valorIvaCentavos,
      })),
    });
  }

  private mapConteudoFromDto(
    dto: Partial<CreatePropostaDto>,
    existing?: {
      apresentacaoEmpresa: string | null;
      enquadramento: string | null;
      objetivos: string | null;
      conteudosProgramaticos: string | null;
      metodologia: string | null;
      destinatarios: string | null;
      duracaoTexto: string | null;
      localTexto: string | null;
      beneficios: string | null;
      condicoesComerciais: string | null;
      porqueEscolher: string | null;
      proximosPassos: string | null;
    },
  ) {
    /** `undefined` = não enviado; `null`/string = valor efectivo (inclui limpar campo). */
    const pick = (v: string | null | undefined, prev: string | null | undefined) => {
      if (v === undefined) return prev;
      return v?.trim() || null;
    };
    return {
      apresentacaoEmpresa: pick(dto.apresentacaoEmpresa, existing?.apresentacaoEmpresa),
      enquadramento: pick(dto.enquadramento, existing?.enquadramento),
      objetivos: pick(dto.objetivos, existing?.objetivos),
      conteudosProgramaticos: pick(dto.conteudosProgramaticos, existing?.conteudosProgramaticos),
      metodologia: pick(dto.metodologia, existing?.metodologia),
      destinatarios: pick(dto.destinatarios, existing?.destinatarios),
      duracaoTexto: pick(dto.duracaoTexto, existing?.duracaoTexto),
      localTexto: pick(dto.localTexto, existing?.localTexto),
      beneficios: pick(dto.beneficios, existing?.beneficios),
      condicoesComerciais: pick(dto.condicoesComerciais, existing?.condicoesComerciais),
      porqueEscolher: pick(dto.porqueEscolher, existing?.porqueEscolher),
      proximosPassos: pick(dto.proximosPassos, existing?.proximosPassos),
    };
  }

  private toConfigTemplate(row: Parameters<typeof configRowToTemplate>[0]): ConfigPropostaTemplate {
    return configRowToTemplate(row);
  }

  private async ensureConfigProposta(tenantId: string) {
    const existing = await this.prisma.configPropostaTenant.findUnique({ where: { tenantId } });
    if (existing) return existing;

    return this.prisma.configPropostaTenant.create({
      data: {
        tenantId,
        ...DEFAULTS_PROPOSTA_TEMPLATE,
        validadeDiasPadrao: 30,
      },
    });
  }

  private parseLinhasDto(linhas: PropostaLinhaDto[] | undefined) {
    if (!linhas?.length) return [];
    return normalizePropostaLinhas(
      linhas.map((l) => ({
        descricao: l.descricao,
        notas: l.notas ?? null,
        quantidade: l.quantidade ?? 1,
        precoUnitCentavos: l.precoUnitCentavos,
        taxaIva: l.taxaIva ?? 23,
      })),
    );
  }

  private async assertEntidade(tenantId: string, id: string) {
    const ec = await this.prisma.entidadeCliente.findFirst({ where: { id, tenantId } });
    if (!ec) {
      throw new NotFoundException("Entidade cliente não encontrada.");
    }
  }

  private async assertCurso(tenantId: string, id: string) {
    const curso = await this.prisma.curso.findFirst({ where: { id, tenantId } });
    if (!curso) {
      throw new NotFoundException("Curso não encontrado.");
    }
  }
}
