import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ContratoComercial, Prisma } from "@nexiforma/database";
import {
  getModuloLogos,
  getModuloTemplates,
  isAllowedTemplateId,
  parseDocumentLogoPlacements,
  type DocumentLogoPlacement,
  type DocumentOrientacao,
  type DocumentVerticalAlign,
} from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import {
  assertContratoAcessivel,
  contratoScopeWhere,
} from "../common/comercial-scope.util";
import {
  countsFromGroupBy,
  parseListPagination,
  type PaginatedList,
} from "../common/paginated-list.util";
import { requireTenantId } from "../common/tenant-scope";
import { HtmlPdfExportService } from "../common/html-pdf-export.service";
import { StorageService } from "../storage/storage.service";
import { renderMatriculaDocumentHtml } from "../portal/document-render.util";
import type {
  ContratoPdfDto,
  ContratoPreviewDto,
  CreateContratoDto,
  UpdateContratoDto,
} from "./dto/contrato.dto";
import { buildCrmContratoTemplateContext } from "./contrato-template-context.util";

const CONTRATO_LIST_INCLUDE = {
  entidadeCliente: { select: { id: true, nome: true, nif: true } },
  proposta: { select: { id: true, codigo: true, fatura: { select: { id: true, estado: true } } } },
  criadoPor: { select: { id: true, displayName: true } },
};

const CONTRATO_DETAIL_INCLUDE = {
  entidadeCliente: { select: { id: true, nome: true, nif: true, email: true, moradaFiscal: true } },
  proposta: {
    select: {
      id: true,
      codigo: true,
      titulo: true,
      valorCentavos: true,
      validadeAte: true,
      fatura: { select: { id: true, estado: true } },
    },
  },
  criadoPor: { select: { id: true, displayName: true, email: true } },
} as const;

type ContratoDetail = Prisma.ContratoComercialGetPayload<{
  include: typeof CONTRATO_DETAIL_INCLUDE;
}>;

type ContratoMetadata = {
  logoPlacements?: DocumentLogoPlacement[];
  orientacao?: DocumentOrientacao;
  alinhamentoVertical?: DocumentVerticalAlign;
};

function parseContratoMetadata(raw: unknown): ContratoMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as ContratoMetadata;
  return {
    ...(o.logoPlacements?.length
      ? { logoPlacements: parseDocumentLogoPlacements(o.logoPlacements) }
      : {}),
    ...(o.orientacao === "portrait" || o.orientacao === "landscape"
      ? { orientacao: o.orientacao }
      : {}),
    ...(o.alinhamentoVertical === "top" ||
    o.alinhamentoVertical === "middle" ||
    o.alinhamentoVertical === "bottom"
      ? { alinhamentoVertical: o.alinhamentoVertical }
      : {}),
  };
}

function generateContratoCodigo(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CTR-${y}${m}-${r}`;
}

export type ContratoListFilters = {
  entidadeClienteId?: string;
  estado?: string;
  q?: string;
  page?: string;
  pageSize?: string;
};

@Injectable()
export class ContratosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly htmlPdf: HtmlPdfExportService,
  ) {}

  async list(
    user: RequestUser,
    filters?: ContratoListFilters,
  ): Promise<PaginatedList<ContratoComercial>> {
    const tenantId = requireTenantId(user);
    const pagination = parseListPagination(filters?.page, filters?.pageSize);
    const scope = contratoScopeWhere(user);

    const where: Prisma.ContratoComercialWhereInput = {
      tenantId,
      ...(scope ?? {}),
      ...(filters?.entidadeClienteId ? { entidadeClienteId: filters.entidadeClienteId } : {}),
      ...(filters?.estado ? { estado: filters.estado as ContratoComercial["estado"] } : {}),
      ...(filters?.q?.trim()
        ? {
            OR: [
              { codigo: { contains: filters.q.trim(), mode: "insensitive" } },
              { titulo: { contains: filters.q.trim(), mode: "insensitive" } },
              { entidadeCliente: { nome: { contains: filters.q.trim(), mode: "insensitive" } } },
              { entidadeCliente: { nif: { contains: filters.q.trim(), mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [total, countRows, items] = await Promise.all([
      this.prisma.contratoComercial.count({ where }),
      this.prisma.contratoComercial.groupBy({
        by: ["estado"],
        where: { tenantId, ...(scope ?? {}) },
        _count: { _all: true },
      }),
      this.prisma.contratoComercial.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        include: CONTRATO_LIST_INCLUDE,
      }),
    ]);

    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      countsByEstado: countsFromGroupBy(countRows),
    };
  }

  async getOne(user: RequestUser, id: string): Promise<ContratoDetail> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.contratoComercial.findFirst({
      where: { id, tenantId },
      include: CONTRATO_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException("Contrato não encontrado.");
    assertContratoAcessivel(user, row);
    return row;
  }

  async create(user: RequestUser, dto: CreateContratoDto): Promise<ContratoDetail> {
    const tenantId = requireTenantId(user);
    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: dto.entidadeClienteId, tenantId },
      select: { id: true },
    });
    if (!entidade) throw new NotFoundException("Cliente não encontrado.");

    let proposta: {
      id: string;
      codigo: string;
      titulo: string;
      valorCentavos: number;
      validadeAte: Date | null;
      entidadeClienteId: string;
    } | null = null;

    if (dto.propostaId) {
      proposta = await this.prisma.propostaComercial.findFirst({
        where: { id: dto.propostaId, tenantId },
        select: {
          id: true,
          codigo: true,
          titulo: true,
          valorCentavos: true,
          validadeAte: true,
          entidadeClienteId: true,
        },
      });
      if (!proposta) throw new NotFoundException("Proposta não encontrada.");
      if (proposta.entidadeClienteId !== dto.entidadeClienteId) {
        throw new BadRequestException("A proposta não pertence a este cliente.");
      }
    }

    const templateId = dto.templateId?.trim() || null;
    if (templateId && !isAllowedTemplateId("crm", templateId)) {
      throw new BadRequestException("Template inválido.");
    }

    const codigo = dto.codigo?.trim() || generateContratoCodigo();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });

    let metadata: ContratoMetadata | undefined;
    if (templateId && tenant?.metadata) {
      const entry = getModuloTemplates(tenant.metadata, "crm")[templateId];
      if (entry?.logos?.length) {
        metadata = {
          logoPlacements: parseDocumentLogoPlacements(entry.logos),
          ...(entry.orientacao ? { orientacao: entry.orientacao } : {}),
          ...(entry.alinhamentoVertical
            ? { alinhamentoVertical: entry.alinhamentoVertical }
            : {}),
        };
      }
    }

    try {
      return await this.prisma.contratoComercial.create({
        data: {
          tenantId,
          entidadeClienteId: dto.entidadeClienteId,
          propostaId: proposta?.id ?? null,
          codigo,
          titulo: dto.titulo.trim(),
          templateId,
          dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : null,
          dataFim: dto.dataFim ? new Date(dto.dataFim) : proposta?.validadeAte ?? null,
          valorCentavos: dto.valorCentavos ?? proposta?.valorCentavos ?? 0,
          notasInternas: dto.notasInternas?.trim() || null,
          criadoPorUserId: user.sub ?? null,
          metadata: metadata ?? undefined,
          estado: "RASCUNHO",
        },
        include: CONTRATO_DETAIL_INCLUDE,
      });
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
      if (code === "P2002") {
        throw new ConflictException("Já existe um contrato com este código.");
      }
      throw e;
    }
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateContratoDto,
  ): Promise<ContratoDetail> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.contratoComercial.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException("Contrato não encontrado.");
    assertContratoAcessivel(user, existing);

    return this.prisma.contratoComercial.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        ...(dto.bodyHtml !== undefined ? { bodyHtml: dto.bodyHtml?.trim() || null } : {}),
        ...(dto.dataInicio !== undefined
          ? { dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : null }
          : {}),
        ...(dto.dataFim !== undefined
          ? { dataFim: dto.dataFim ? new Date(dto.dataFim) : null }
          : {}),
        ...(dto.valorCentavos !== undefined ? { valorCentavos: dto.valorCentavos } : {}),
        ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
        ...(dto.notasInternas !== undefined
          ? { notasInternas: dto.notasInternas?.trim() || null }
          : {}),
      },
      include: CONTRATO_DETAIL_INCLUDE,
    });
  }

  async remove(user: RequestUser, id: string): Promise<{ ok: true }> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.contratoComercial.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException("Contrato não encontrado.");
    assertContratoAcessivel(user, existing);
    if (existing.estado !== "RASCUNHO") {
      throw new BadRequestException("Só contratos em rascunho podem ser eliminados.");
    }
    await this.prisma.contratoComercial.delete({ where: { id } });
    return { ok: true };
  }

  async previewHtml(
    user: RequestUser,
    id: string,
    dto?: ContratoPreviewDto,
  ): Promise<{
    html: string;
    bodyHtml: string;
    label: string;
    logoPlacements: DocumentLogoPlacement[];
    moduleLogos: ReturnType<typeof getModuloLogos>;
    orientacao: DocumentOrientacao;
    alinhamentoVertical: DocumentVerticalAlign;
  }> {
    const { contrato, tenantMetadata, context, meta } = await this.loadRenderContext(user, id);
    const isPersonalizado = !contrato.templateId;
    const bodyOverride =
      dto?.bodyHtml?.trim() ||
      contrato.bodyHtml?.trim() ||
      (isPersonalizado ? "<p></p>" : undefined);
    const templateId = contrato.templateId ?? "contrato";

    try {
      const rendered = await renderMatriculaDocumentHtml({
        metadata: tenantMetadata,
        modulo: "crm",
        templateId,
        context,
        storage: this.storage,
        bodyHtmlOverride: bodyOverride,
        logoPlacements: meta.logoPlacements,
        orientacaoOverride: meta.orientacao,
        alinhamentoVerticalOverride: meta.alinhamentoVertical,
        includeLegacyBranding: true,
      });
      return {
        ...rendered,
        moduleLogos: getModuloLogos(tenantMetadata, "crm"),
      };
    } catch (e) {
      if (e instanceof Error && e.message === "EMPTY_TEMPLATE") {
        throw new BadRequestException(
          "Documento vazio. Edite o texto do contrato ou configure um template em Configurações → CRM.",
        );
      }
      throw e;
    }
  }

  async buildPdf(
    user: RequestUser,
    id: string,
    dto?: ContratoPdfDto,
  ): Promise<{ pdf: Buffer; filename: string }> {
    const preview = await this.previewHtml(user, id, dto);
    const pdf = await this.htmlPdf.htmlToPdfBuffer(preview.html, {
      landscape: preview.orientacao === "landscape",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    const filename =
      `${preview.label} - ${preview.bodyHtml.slice(0, 40)}`.replace(/[\\/:*?"<>|]/g, "-") + ".pdf";
    return { pdf, filename: filename.slice(0, 120) };
  }

  private async loadRenderContext(user: RequestUser, id: string) {
    const row = await this.getOne(user, id);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: row.tenantId },
      select: { metadata: true },
    });
    const comercialNome = row.criadoPor?.displayName ?? null;
    const context = await buildCrmContratoTemplateContext(this.prisma, row.tenantId, {
      contrato: {
        codigo: row.codigo,
        titulo: row.titulo,
        valorCentavos: row.valorCentavos,
        dataInicio: row.dataInicio,
        dataFim: row.dataFim,
      },
      entidadeClienteId: row.entidadeClienteId,
      comercialNome,
      proposta: row.proposta,
    });
    return {
      contrato: row,
      tenantMetadata: tenant?.metadata,
      context,
      meta: parseContratoMetadata(row.metadata),
    };
  }
}
