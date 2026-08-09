import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@nexiforma/database";
import AdmZip from "adm-zip";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import {
  countsFromGroupBy,
  parseListPagination,
} from "../common/paginated-list.util";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";
import { resolveProjectPath } from "../config/env-paths";
import {
  calcularTotaisFatura,
  calcularValorIvaCentavos,
  type LinhaIvaInput,
} from "./fatura-iva.util";
import type {
  CreateFaturaDto,
  FaturaLinhaDto,
  UpdateConfigFaturacaoDto,
  UpdateFaturaDto,
  UpdateSerieFaturacaoDto,
} from "./dto/fatura.dto";
import { FaturaHtmlExportService } from "./fatura-html-export.service";
import {
  mergeFaturaTemplateCoresMetadata,
  parseFaturaTemplateCores,
} from "./fatura-template-cores.util";
import {
  buildFaturaEmitidaInternaEmail,
  buildFaturaEnviadaClienteEmail,
  fmtDataFaturaEmail,
  fmtEuroCentavos,
  type FaturaEmailResumo,
} from "./fatura-email.util";
import {
  formatarAtcud,
} from "./fatura-atcud.util";
import { hashIntegridadeFatura } from "./fatura-integridade.util";
import {
  assinarDocumentoFaturaAt,
  carregarChaveAtDeFicheiro,
  formatarAtInvoiceNo,
  isAssinaturaAtRsa,
} from "./fatura-assinatura-at.util";
import {
  avaliarCertificacaoAt,
  resolverSoftwareCertificado,
} from "./at-certificacao.util";
import { AtFaturasIntegrationService } from "./at-faturas-integration.service";
import { AtSeriesIntegrationService } from "./at-series-integration.service";
import {
  identificacaoDocumentoAt,
  type AtFaturaDocumentoInput,
  type AtInvoiceStatus,
} from "./at-faturas-payload.util";
import { isMotivoIsencaoValido } from "./at-tax-codes.util";
import {
  desencriptarPasswordWfa,
  encriptarPasswordWfa,
} from "./at-faturas-credentials.util";
import { PortalNotificacoesService } from "../notificacoes/portal-notificacoes.service";
import {
  GESTOR_ROLES,
  resolverEmailNotificacaoUtilizador,
} from "../notificacoes/notificacao-roles.util";
import { MailService } from "../mail/mail.service";
import type {
  AnularFaturaDto,
  EnviarFaturaEmailDto,
  RejeitarPedidoAnulacaoDto,
} from "./dto/fatura.dto";
import { ConfigService } from "@nestjs/config";
import { buildSaftPtXml } from "./saft-pt-export.util";
import { normalizeMoradaOpcional, resolveMoradaCarga, resolveMoradaDescarga } from "./faturacao-moradas.util";
import { mergeFaturaSearchWhere } from "./fatura-search.util";
import {
  assertDadosClienteCompletos,
  assertDadosEmitenteCompletos,
  normalizarBic,
  normalizarIban,
} from "./faturacao-dados-legais.util";
import {
  AT_LICENCA_ANEXO_II_TEXTO,
  AT_LICENCA_ANEXO_II_VERSAO,
  isAtLicencaAnexoIiAceite,
} from "./at-licenca-anexo-ii.util";
import { AuditService } from "../audit/audit.service";

const FATURACAO_AUDITORIA_SCHEMA = "nexiforma.faturacao_auditoria.v1";
const MAX_PDFS_PACOTE_AUDITORIA = 50;

const FATURA_INCLUDE = {
  entidadeCliente: { select: { id: true, nome: true, nif: true, email: true } },
  proposta: { select: { id: true, codigo: true, titulo: true, estado: true } },
  serie: { select: { id: true, codigo: true, tipo: true } },
  faturaReferencia: {
    select: {
      id: true,
      numero: true,
      codigoAtcud: true,
      serie: { select: { codigo: true, tipo: true } },
    },
  },
  linhas: { orderBy: { ordem: "asc" as const } },
  comunicacoesAt: { orderBy: { tentativaEm: "desc" as const }, take: 5 },
  pedidosAnulacao: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
    include: {
      solicitadoPor: { select: { id: true, displayName: true, email: true } },
      resolvidoPor: { select: { id: true, displayName: true } },
    },
  },
} satisfies Prisma.FaturaComercialInclude;

@Injectable()
export class FaturasService {
  private readonly logger = new Logger(FaturasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly htmlExport: FaturaHtmlExportService,
    private readonly atFaturas: AtFaturasIntegrationService,
    private readonly atSeries: AtSeriesIntegrationService,
    private readonly portalNotificacoes: PortalNotificacoesService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async list(
    user: RequestUser,
    filters?: {
      entidadeClienteId?: string;
      estado?: string;
      q?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    const tenantId = requireTenantId(user);
    const pagination = parseListPagination(filters?.page, filters?.pageSize);
    const base: Prisma.FaturaComercialWhereInput = {
      tenantId,
      ...(filters?.entidadeClienteId
        ? { entidadeClienteId: filters.entidadeClienteId }
        : {}),
      ...(filters?.estado ? { estado: filters.estado as never } : {}),
    };
    const where = mergeFaturaSearchWhere(base, filters?.q);
    const whereForCounts: Prisma.FaturaComercialWhereInput = mergeFaturaSearchWhere(
      {
        tenantId,
        ...(filters?.entidadeClienteId
          ? { entidadeClienteId: filters.entidadeClienteId }
          : {}),
      },
      filters?.q,
    );

    const [total, items, countRows] = await Promise.all([
      this.prisma.faturaComercial.count({ where }),
      this.prisma.faturaComercial.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        include: FATURA_INCLUDE,
      }),
      this.prisma.faturaComercial.groupBy({
        by: ["estado"],
        where: whereForCounts,
        _count: { _all: true },
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

  async getOne(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.faturaComercial.findFirst({
      where: { id, tenantId },
      include: FATURA_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    return row;
  }

  async createFromProposta(user: RequestUser, propostaId: string) {
    const tenantId = requireTenantId(user);
    const proposta = await this.prisma.propostaComercial.findFirst({
      where: { id: propostaId, tenantId },
      include: {
        curso: { select: { designacao: true } },
        fatura: { select: { id: true } },
        entidadeCliente: { select: { nome: true, nif: true, moradaFiscal: true } },
        linhas: { orderBy: { ordem: "asc" } },
      },
    });
    if (!proposta) {
      throw new NotFoundException("Proposta não encontrada.");
    }
    if (proposta.estado !== "ACEITE") {
      throw new BadRequestException("Só é possível faturar propostas aceites.");
    }
    if (proposta.fatura) {
      throw new ConflictException("Esta proposta já tem fatura associada.");
    }

    assertDadosClienteCompletos(proposta.entidadeCliente);

    const { serie, taxaIva } = await this.resolveSerieETaxa(tenantId);
    const descricaoFallback =
      proposta.curso?.designacao?.trim() ||
      proposta.titulo.trim() ||
      "Prestação de serviços de formação";

    const linhas =
      proposta.linhas.length > 0
        ? proposta.linhas.map((l) => ({
            descricao: l.descricao,
            quantidade: Number(l.quantidade),
            precoUnitCentavos: l.precoUnitCentavos,
            taxaIva: Number(l.taxaIva),
            codigoIsencaoIva: Number(l.taxaIva) <= 0 ? "M07" : null,
          }))
        : [
            {
              descricao: descricaoFallback,
              quantidade: 1,
              precoUnitCentavos: proposta.valorCentavos,
              taxaIva,
              codigoIsencaoIva: taxaIva <= 0 ? "M07" : null,
            },
          ];

    return this.createFaturaInternal(tenantId, {
      entidadeClienteId: proposta.entidadeClienteId,
      propostaId: proposta.id,
      serieId: serie.id,
      dataVencimento: null,
      notas: proposta.notasInternas,
      destinatarioNome: proposta.entidadeCliente.nome,
      destinatarioNif: proposta.entidadeCliente.nif,
      destinatarioMorada: proposta.entidadeCliente.moradaFiscal!.trim(),
      linhas,
    });
  }

  async create(user: RequestUser, dto: CreateFaturaDto) {
    const tenantId = requireTenantId(user);
    await this.assertEntidade(tenantId, dto.entidadeClienteId);
    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: dto.entidadeClienteId, tenantId },
      select: { nome: true, nif: true, moradaFiscal: true },
    });
    if (!entidade) {
      throw new NotFoundException("Entidade cliente não encontrada.");
    }
    assertDadosClienteCompletos(entidade);

    const { serie, taxaIva } = await this.resolveSerieETaxa(tenantId, dto.serieId);

    return this.createFaturaInternal(tenantId, {
      entidadeClienteId: dto.entidadeClienteId,
      serieId: serie.id,
      dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : null,
      notas: dto.notas?.trim() || null,
      destinatarioNome: dto.destinatarioNome?.trim() || entidade.nome,
      destinatarioNif: dto.destinatarioNif?.trim() || entidade.nif,
      destinatarioMorada: dto.destinatarioMorada?.trim() || entidade.moradaFiscal!.trim(),
      linhas: dto.linhas.map((l) => this.normalizeLinha(l, taxaIva)),
    });
  }

  async update(user: RequestUser, id: string, dto: UpdateFaturaDto) {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.faturaComercial.findFirst({
      where: { id, tenantId },
      include: { linhas: true },
    });
    if (!existing) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    if (existing.estado !== "RASCUNHO") {
      throw new BadRequestException("Só faturas em rascunho podem ser editadas.");
    }

    const { taxaIva } = await this.resolveSerieETaxa(tenantId, existing.serieId);
    const linhasInput =
      dto.linhas?.map((l) => this.normalizeLinha(l, taxaIva)) ??
      existing.linhas.map((l) => ({
        descricao: l.descricao,
        quantidade: Number(l.quantidade),
        precoUnitCentavos: l.precoUnitCentavos,
        taxaIva: Number(l.taxaIva),
        descontoPercent: Number(l.descontoPercent ?? 0),
        codigoIsencaoIva: l.codigoIsencaoIva,
      }));

    const totais = calcularTotaisFatura(linhasInput);
    if (linhasInput.length === 0) {
      throw new BadRequestException("A fatura precisa de pelo menos uma linha.");
    }

    const retencaoCentavos =
      dto.retencaoCentavos !== undefined
        ? Math.max(0, dto.retencaoCentavos)
        : existing.retencaoCentavos;

    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: existing.entidadeClienteId, tenantId },
      select: { nome: true, nif: true, moradaFiscal: true },
    });
    if (!entidade) {
      throw new NotFoundException("Entidade cliente não encontrada.");
    }
    assertDadosClienteCompletos(entidade);

    const destinatarioSync = {
      destinatarioNome: entidade.nome,
      destinatarioNif: entidade.nif,
      destinatarioMorada: entidade.moradaFiscal!.trim(),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.faturaLinha.deleteMany({ where: { faturaId: id } });
      await tx.faturaComercial.update({
        where: { id },
        data: {
          dataVencimento:
            dto.dataVencimento !== undefined
              ? dto.dataVencimento
                ? new Date(dto.dataVencimento)
                : null
              : existing.dataVencimento,
          ...destinatarioSync,
          moradaCarga:
            dto.moradaCarga !== undefined
              ? normalizeMoradaOpcional(dto.moradaCarga)
              : existing.moradaCarga,
          moradaDescarga:
            dto.moradaDescarga !== undefined
              ? normalizeMoradaOpcional(dto.moradaDescarga)
              : existing.moradaDescarga,
          notas: dto.notas !== undefined ? dto.notas?.trim() || null : existing.notas,
          valorCentavos: totais.valorCentavos,
          ivaCentavos: totais.ivaCentavos,
          retencaoCentavos,
          linhas: {
            create: linhasInput.map((l, i) => ({
              ordem: i + 1,
              descricao: l.descricao,
              quantidade: l.quantidade,
              precoUnitCentavos: l.precoUnitCentavos,
              taxaIva: l.taxaIva,
              descontoPercent: l.descontoPercent ?? 0,
              valorIvaCentavos: calcularValorIvaCentavos(l),
              codigoIsencaoIva: l.codigoIsencaoIva,
            })),
          },
        },
      });
    });

    return this.getOne(user, id);
  }

  async emitir(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.faturaComercial.findFirst({
      where: { id, tenantId },
      include: { serie: true, linhas: true },
    });
    if (!existing) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    if (existing.estado !== "RASCUNHO") {
      throw new BadRequestException("Só faturas em rascunho podem ser emitidas.");
    }
    if (existing.linhas.length === 0) {
      throw new BadRequestException("A fatura precisa de pelo menos uma linha.");
    }

    const config = await this.ensureConfig(tenantId);
    assertDadosEmitenteCompletos(config);
    assertDadosClienteCompletos({
      nome: existing.destinatarioNome,
      nif: existing.destinatarioNif,
      moradaFiscal: existing.destinatarioMorada,
    });
    const softwareCertificado = this.resolveSoftwareCertNumber(config);

    await this.ensureSerieComunicadaAt(tenantId, existing.serieId, config);

    await this.prisma.$transaction(async (tx) => {
      const serieRow = await tx.serieFaturacao.findUnique({
        where: { id: existing.serieId },
      });
      if (!serieRow || !serieRow.ativo) {
        throw new NotFoundException("Série de faturação inválida.");
      }

      const codigoValidacao = serieRow.codigoValidacaoAt;
      if (!codigoValidacao?.trim()) {
        throw new BadRequestException(
          "A série não tem código de validação AT. Comunique a série antes de emitir documentos.",
        );
      }
      if (serieRow.estadoAt === "ANULADA") {
        throw new BadRequestException("Série anulada na AT – não pode emitir documentos.");
      }

      const numero = serieRow.proximoNumero;
      const atcud = formatarAtcud(codigoValidacao, numero);
      const dataEmissao = new Date();
      const invoiceNo = formatarAtInvoiceNo(serieRow.tipo, serieRow.codigo, numero);
      const grossCentavos = existing.valorCentavos + existing.ivaCentavos;

      const ultimaEmitida = await tx.faturaComercial.findFirst({
        where: {
          serieId: serieRow.id,
          id: { not: id },
          numero: { not: null },
          estado: { in: ["EMITIDA", "COMUNICADA_AT", "ANULADA"] },
        },
        orderBy: { numero: "desc" },
        select: { hashIntegridade: true },
      });

      const privateKeyPath = resolveProjectPath(
        this.config.get<string>("AT_SAFT_PRIVATE_KEY_PATH"),
      );
      const hashControlDefault =
        this.config.get<string>("AT_SAFT_HASH_CONTROL")?.trim() || "1";

      let hashIntegridade: string;
      let hashControl: string | null = null;

      if (privateKeyPath) {
        try {
          const privateKey = carregarChaveAtDeFicheiro(privateKeyPath);
          const hashAnterior = isAssinaturaAtRsa(ultimaEmitida?.hashIntegridade)
            ? ultimaEmitida!.hashIntegridade
            : null;
          hashIntegridade = assinarDocumentoFaturaAt(privateKey, {
            invoiceDate: dataEmissao,
            systemEntryDate: dataEmissao,
            invoiceNo,
            grossTotalCentavos: grossCentavos,
            hashDocumentoAnterior: hashAnterior,
          });
          hashControl = hashControlDefault;
        } catch {
          throw new BadRequestException(
            "Chave privada AT inválida ou inacessível (AT_SAFT_PRIVATE_KEY_PATH).",
          );
        }
      } else {
        hashIntegridade = hashIntegridadeFatura({
          tenantId,
          faturaId: id,
          nifEmitente: config.nifEmitente,
          destinatarioNif: existing.destinatarioNif,
          tipoDocumento: serieRow.tipo,
          serie: serieRow.codigo,
          numero,
          atcud,
          dataEmissao,
          valorCentavos: existing.valorCentavos,
          ivaCentavos: existing.ivaCentavos,
          moeda: existing.moeda,
          softwareCertificado,
          linhas: existing.linhas.map((l, i) => ({
            ordem: l.ordem ?? i + 1,
            descricao: l.descricao,
            quantidade: Number(l.quantidade),
            precoUnitCentavos: l.precoUnitCentavos,
            taxaIva: Number(l.taxaIva),
            valorIvaCentavos: l.valorIvaCentavos,
          })),
        });
      }

      await tx.serieFaturacao.update({
        where: { id: serieRow.id },
        data: { proximoNumero: numero + 1 },
      });

      await tx.faturaComercial.update({
        where: { id },
        data: {
          numero,
          codigoAtcud: atcud,
          estado: "EMITIDA",
          dataEmissao,
          emitidaPorUserId: user.sub,
          hashIntegridade,
          hashControl,
        },
      });
    });

    await this.tentarComunicacaoAutomatica(user, id, config);
    await this.enviarCopiaDocumentoAposEmissao(user, id);

    const emitida = await this.getOne(user, id);
    void this.audit.log({
      actorType: "TENANT_USER",
      actorId: user.sub,
      action: "fatura.emitir",
      resourceType: "FaturaComercial",
      resourceId: id,
      targetTenantId: tenantId,
      targetUserId: user.sub,
      payload: {
        numero: emitida.numero,
        atcud: emitida.codigoAtcud,
        estado: emitida.estado,
      },
    });
    return emitida;
  }

  /** Cópia interna do documento emitido para quem emitiu e gestores do tenant. */
  private async enviarCopiaDocumentoAposEmissao(user: RequestUser, faturaId: string) {
    try {
      const tenantId = requireTenantId(user);
      const config = await this.ensureConfig(tenantId);
      const fatura = await this.prisma.faturaComercial.findFirst({
        where: { id: faturaId, tenantId },
        include: { serie: { select: { codigo: true, tipo: true } } },
      });
      if (!fatura?.numero) return;

      const pkg = await this.htmlExport.buildPrintablePdf(user, faturaId, {
        exemplar: "DUPLICADO",
      });

      const emitente = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { email: true, role: true },
      });

      const gestores = await this.prisma.user.findMany({
        where: { tenantId, active: true, role: { in: GESTOR_ROLES } },
        select: { email: true, role: true },
      });

      const destinatarios = new Set<string>();
      const emailEmitente = emitente
        ? resolverEmailNotificacaoUtilizador(emitente.role, emitente.email)
        : null;
      if (emailEmitente) destinatarios.add(emailEmitente.toLowerCase());

      for (const g of gestores) {
        const email = resolverEmailNotificacaoUtilizador(g.role, g.email);
        if (email) destinatarios.add(email.toLowerCase());
      }
      if (config.emailGestor?.trim()) {
        destinatarios.add(config.emailGestor.trim().toLowerCase());
      }

      if (destinatarios.size === 0) return;

      const resumo = this.buildFaturaEmailResumo(fatura, config, pkg.filename);
      const emailTpl = buildFaturaEmitidaInternaEmail(resumo);

      for (const to of destinatarios) {
        await this.mail.send({
          to,
          subject: emailTpl.subject,
          text: emailTpl.text,
          html: emailTpl.html,
          attachments: [
            {
              filename: pkg.filename,
              content: pkg.pdf,
              contentType: "application/pdf",
            },
          ],
        });
      }
    } catch (err) {
      this.logger.warn(
        `Falha ao enviar cópia da fatura ${faturaId} por email: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Comunica à AT automaticamente após emissão se activo no tenant. */
  private async tentarComunicacaoAutomatica(
    user: RequestUser,
    id: string,
    config: {
      comunicacaoAtiva: boolean;
      comunicacaoAutomatica: boolean;
      softwareCertificado: string | null;
      nifEmitente: string;
      atSubutilizador: string | null;
      atWfaPasswordEnc: string | null;
    },
  ) {
    if (!config.comunicacaoAtiva || !config.comunicacaoAutomatica) return;

    const atMode = this.atFaturas.getPublicConfig().mode;
    if (atMode === "disabled") return;

    try {
      const tenantId = requireTenantId(user);
      this.assertComunicacaoAtPermitida(config);
      const existing = await this.loadFaturaParaComunicacaoAt(tenantId, id);
      const documento = this.buildDocumentoAtInput(existing, config, "N");
      await this.executarComunicacaoAt(id, documento, config, { marcarComunicada: true });
    } catch {
      // Emissão mantém-se EMITIDA; comunicação manual ou reenvio posterior.
    }
  }

  buildDocumentoHtml(user: RequestUser, id: string) {
    return this.htmlExport.buildPrintableHtml(user, id);
  }

  buildDocumentoPdf(user: RequestUser, id: string) {
    return this.htmlExport.buildPrintablePdf(user, id);
  }

  async comunicarAt(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const existing = await this.loadFaturaParaComunicacaoAt(tenantId, id);
    const config = await this.ensureConfig(tenantId);
    this.assertComunicacaoAtPermitida(config);

    const documento = this.buildDocumentoAtInput(existing, config, "N");
    const resultado = await this.executarComunicacaoAt(id, documento, config, {
      marcarComunicada: true,
    });

    const fatura = await this.getOne(user, id);
    void this.audit.log({
      actorType: "TENANT_USER",
      actorId: user.sub,
      action: "fatura.comunicar_at",
      resourceType: "FaturaComercial",
      resourceId: id,
      targetTenantId: tenantId,
      targetUserId: user.sub,
      payload: {
        sucesso: resultado.sucesso,
        codigoResposta: resultado.codigoResposta,
        mode: resultado.mode,
      },
    });
    return {
      fatura,
      comunicacao: {
        sucesso: resultado.sucesso,
        codigoResposta: resultado.codigoResposta,
        mensagemAt: resultado.mensagemAt,
        mode: resultado.mode,
      },
    };
  }

  async reenviarAt(user: RequestUser, id: string) {
    const tenantId = requireTenantId(user);
    const existing = await this.loadFaturaParaComunicacaoAt(tenantId, id);
    if (existing.estado !== "EMITIDA" && existing.estado !== "COMUNICADA_AT") {
      throw new BadRequestException(
        "Só faturas emitidas ou já comunicadas podem ser reenviadas à AT.",
      );
    }

    const config = await this.ensureConfig(tenantId);
    this.assertComunicacaoAtPermitida(config);

    const documento = this.buildDocumentoAtInput(existing, config, "N");
    const resultado = await this.executarComunicacaoAt(id, documento, config, {
      marcarComunicada: existing.estado === "EMITIDA",
    });

    const fatura = await this.getOne(user, id);
    void this.audit.log({
      actorType: "TENANT_USER",
      actorId: user.sub,
      action: "fatura.reenviar_at",
      resourceType: "FaturaComercial",
      resourceId: id,
      targetTenantId: tenantId,
      targetUserId: user.sub,
      payload: {
        sucesso: resultado.sucesso,
        codigoResposta: resultado.codigoResposta,
        mode: resultado.mode,
      },
    });
    return {
      fatura,
      comunicacao: {
        sucesso: resultado.sucesso,
        codigoResposta: resultado.codigoResposta,
        mensagemAt: resultado.mensagemAt,
        mode: resultado.mode,
      },
    };
  }

  async enviarEmail(user: RequestUser, id: string, dto?: EnviarFaturaEmailDto) {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.faturaComercial.findFirst({
      where: { id, tenantId },
      include: {
        entidadeCliente: { select: { nome: true, email: true } },
        serie: { select: { codigo: true, tipo: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    if (existing.estado !== "EMITIDA" && existing.estado !== "COMUNICADA_AT") {
      throw new BadRequestException("Só faturas emitidas podem ser enviadas por email.");
    }

    const to = dto?.email?.trim() || existing.entidadeCliente.email?.trim();
    if (!to) {
      throw new BadRequestException(
        "Email do cliente em falta - indique um destinatário ou actualize a ficha da entidade.",
      );
    }

    const pkg = await this.htmlExport.buildPrintablePdf(user, id, {
      exemplar: "ORIGINAL",
    });
    const config = await this.ensureConfig(tenantId);
    const resumo = this.buildFaturaEmailResumo(existing, config, pkg.filename);
    const emailTpl = buildFaturaEnviadaClienteEmail(resumo);

    await this.mail.send({
      to,
      subject: emailTpl.subject,
      text: emailTpl.text,
      html: emailTpl.html,
      attachments: [
        {
          filename: pkg.filename,
          content: pkg.pdf,
          contentType: "application/pdf",
        },
      ],
    });

    return { enviado: true, destinatario: to, faturaId: id };
  }

  async getCertificacaoStatus(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const config = await this.ensureConfig(tenantId);
    const series = await this.prisma.serieFaturacao.findMany({
      where: { tenantId, ativo: true },
      orderBy: { codigo: "asc" },
    });
    return this.buildCertificacaoStatus(config, series);
  }

  async anular(user: RequestUser, id: string, dto: AnularFaturaDto) {
    const tenantId = requireTenantId(user);
    const fatura = await this.loadFaturaParaAnulacao(tenantId, id);
    const motivo = dto.motivo.trim();
    if (!motivo) {
      throw new BadRequestException("Indique o motivo da anulação.");
    }

    const comunicadaAt = fatura.estado === "COMUNICADA_AT";
    const config = await this.ensureConfig(tenantId);

    if (comunicadaAt) {
      this.assertComunicacaoAtPermitida(config);
      const documento = this.buildDocumentoAtInput(fatura, config, "N");
      const resultado = await this.atFaturas.alterarEstadoDocumento(
        documento,
        "A",
        new Date(),
        {
          nifEmitente: config.nifEmitente,
          subutilizador: config.atSubutilizador ?? "",
          password: this.resolveAtWfaPassword(config),
        },
      );
      await this.prisma.faturaComunicacaoAt.create({
        data: {
          faturaId: id,
          sucesso: resultado.sucesso,
          codigoResposta: resultado.codigoResposta,
          mensagemAt: resultado.mensagemAt,
          payloadHash: resultado.payloadHash,
        },
      });
      if (!resultado.sucesso) {
        throw new BadRequestException(
          resultado.mensagemAt ?? "A AT rejeitou a anulação do documento.",
        );
      }
    }

    const pendente = await this.prisma.faturaPedidoAnulacao.findFirst({
      where: { faturaId: id, estado: "PENDENTE" },
    });

    await this.prisma.$transaction(async (tx) => {
      if (pendente) {
        await tx.faturaPedidoAnulacao.update({
          where: { id: pendente.id },
          data: {
            estado: "APROVADO",
            resolvidoPorUserId: user.sub,
            resolvidoEm: new Date(),
          },
        });
      }
      await tx.faturaComercial.update({
        where: { id },
        data: {
          estado: "ANULADA",
          anuladaEm: new Date(),
          motivoAnulacao: motivo,
        },
      });
    });

    const anulada = await this.getOne(user, id);
    void this.audit.log({
      actorType: "TENANT_USER",
      actorId: user.sub,
      action: "fatura.anular",
      resourceType: "FaturaComercial",
      resourceId: id,
      targetTenantId: tenantId,
      targetUserId: user.sub,
      payload: {
        motivo,
        comunicadaAt,
        numero: fatura.numero,
        atcud: fatura.codigoAtcud,
      },
    });
    return anulada;
  }

  async rejeitarPedidoAnulacao(
    user: RequestUser,
    id: string,
    dto: RejeitarPedidoAnulacaoDto,
  ) {
    const tenantId = requireTenantId(user);
    await this.assertFaturaTenant(tenantId, id);

    const pendente = await this.prisma.faturaPedidoAnulacao.findFirst({
      where: { faturaId: id, estado: "PENDENTE" },
      include: { solicitadoPor: { select: { id: true, displayName: true, email: true } } },
    });
    if (!pendente) {
      throw new NotFoundException("Não há pedido de anulação pendente.");
    }

    await this.prisma.faturaPedidoAnulacao.update({
      where: { id: pendente.id },
      data: {
        estado: "REJEITADO",
        respostaMotivo: dto.respostaMotivo?.trim() || null,
        resolvidoPorUserId: user.sub,
        resolvidoEm: new Date(),
      },
    });

    const fatura = await this.prisma.faturaComercial.findFirst({
      where: { id, tenantId },
      include: { serie: true },
    });
    const faturaRef = fatura ? this.refFatura(fatura) : id;
    const appUrl = resolveAppPublicUrlForLinks(this.config);
    const link = `/portal/crm/faturas/${id}`;
    const respostaMotivo =
      dto.respostaMotivo?.trim() ||
      `O gestor rejeitou o pedido de anulação da fatura ${faturaRef}.`;

    await this.portalNotificacoes.notifyUser({
      tenantId,
      userId: pendente.solicitadoPorUserId,
      tipo: "FATURA_PEDIDO_ANULACAO_REJEITADO",
      titulo: `Pedido de anulação rejeitado – ${faturaRef}`,
      mensagem: respostaMotivo,
      link,
      emailConteudo: this.portalNotificacoes.buildPedidoAnulacaoRejeitadoEmail({
        comercialNome: pendente.solicitadoPor.displayName,
        faturaRef,
        respostaMotivo,
        portalUrl: `${appUrl}${link}`,
      }),
      push: {
        title: "Pedido de anulação rejeitado",
        body: `Fatura ${faturaRef}`,
        url: `${appUrl}${link}`,
      },
    });

    return this.getOne(user, id);
  }

  private async loadFaturaParaAnulacao(tenantId: string, id: string) {
    const fatura = await this.prisma.faturaComercial.findFirst({
      where: { id, tenantId },
      include: {
        serie: true,
        linhas: { orderBy: { ordem: "asc" } },
        faturaReferencia: {
          select: {
            numero: true,
            serie: { select: { codigo: true, tipo: true } },
          },
        },
      },
    });
    if (!fatura) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    if (fatura.estado === "ANULADA") {
      throw new BadRequestException("A fatura já está anulada.");
    }
    if (fatura.estado === "RASCUNHO") {
      throw new BadRequestException("Rascunhos não são anulados - edite ou elimine o rascunho.");
    }
    if (fatura.estado !== "EMITIDA" && fatura.estado !== "COMUNICADA_AT") {
      throw new BadRequestException("Só faturas emitidas podem ser anuladas.");
    }
    return fatura;
  }

  private async assertFaturaTenant(tenantId: string, id: string) {
    const f = await this.prisma.faturaComercial.findFirst({ where: { id, tenantId } });
    if (!f) throw new NotFoundException("Fatura não encontrada.");
  }

  private refFatura(fatura: { serie: { codigo: string; tipo: string }; numero: number | null }) {
    if (fatura.numero == null) return `${fatura.serie.tipo} ${fatura.serie.codigo}`;
    return `${fatura.serie.tipo} ${fatura.serie.codigo}/${fatura.numero}`;
  }

  private buildFaturaEmailResumo(
    fatura: {
      id: string;
      numero: number | null;
      codigoAtcud: string | null;
      dataEmissao: Date | null;
      dataVencimento: Date | null;
      valorCentavos: number;
      ivaCentavos: number;
      retencaoCentavos: number;
      destinatarioNome: string;
      destinatarioNif: string;
      serie: { codigo: string; tipo: string };
    },
    config: {
      nomeEmpresa: string;
      nifEmitente: string;
      iban: string | null;
      emailGestor: string | null;
    },
    filename: string,
  ): FaturaEmailResumo {
    const appUrl = resolveAppPublicUrlForLinks(this.config);
    const totalLiquido =
      fatura.valorCentavos + fatura.ivaCentavos - (fatura.retencaoCentavos ?? 0);
    return {
      ref: this.refFatura(fatura),
      nomeEmpresa: config.nomeEmpresa,
      nifEmitente: config.nifEmitente,
      clienteNome: fatura.destinatarioNome,
      clienteNif: fatura.destinatarioNif,
      dataEmissao: fmtDataFaturaEmail(fatura.dataEmissao),
      dataVencimento: fmtDataFaturaEmail(fatura.dataVencimento),
      atcud: fatura.codigoAtcud ?? "-",
      totalSemIva: fmtEuroCentavos(fatura.valorCentavos),
      totalIva: fmtEuroCentavos(fatura.ivaCentavos),
      totalComIva: fmtEuroCentavos(totalLiquido),
      iban: config.iban,
      emailGestor: config.emailGestor,
      filename,
      portalUrl: `${appUrl}/portal/crm/faturas/${fatura.id}`,
    };
  }

  async getConfig(user: RequestUser) {
    return this.getConfigForTenant(requireTenantId(user));
  }

  /** Configuração de faturação por tenant (control-plane / superadmin). */
  async getConfigForTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, metadata: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");

    const config = await this.ensureConfig(tenantId);
    const series = await this.prisma.serieFaturacao.findMany({
      where: { tenantId, ativo: true },
      orderBy: { codigo: "asc" },
    });
    const integracao = this.atFaturas.getPublicConfig();
    const certificacao = this.buildCertificacaoStatus(config, series);
    const templateCores = parseFaturaTemplateCores(tenant.metadata);
    return {
      config: this.sanitizeConfigForApi({
        ...config,
        softwareCertificadoEfectivo: this.resolveSoftwareCertNumber(config),
        templateCores,
      }),
      series,
      integracao,
      certificacao,
      licencaAt: {
        versao: AT_LICENCA_ANEXO_II_VERSAO,
        texto: AT_LICENCA_ANEXO_II_TEXTO,
        aceite: isAtLicencaAnexoIiAceite(config),
        aceiteEm: config.atLicencaAceiteEm?.toISOString() ?? null,
      },
    };
  }

  async updateSerie(
    user: RequestUser,
    serieId: string,
    dto: UpdateSerieFaturacaoDto,
  ) {
    const tenantId = requireTenantId(user);
    const serie = await this.prisma.serieFaturacao.findFirst({
      where: { id: serieId, tenantId },
    });
    if (!serie) {
      throw new NotFoundException("Série não encontrada.");
    }
    const emitidas = await this.prisma.faturaComercial.count({
      where: { serieId, numero: { not: null } },
    });
    if (emitidas > 0 && dto.codigoValidacaoAt !== undefined) {
      throw new BadRequestException(
        "Não pode alterar o código de validação AT após emissão de documentos nesta série.",
      );
    }
    const codigo = dto.codigoValidacaoAt?.trim().toUpperCase() || null;
    if (codigo && !/^[A-Z0-9]{8}$/.test(codigo)) {
      throw new BadRequestException(
        "Código de validação AT deve ter 8 caracteres alfanuméricos.",
      );
    }
    const updated = await this.prisma.serieFaturacao.update({
      where: { id: serieId },
      data: {
        codigoValidacaoAt: codigo,
        ...(codigo ? { estadoAt: "REGISTADA" } : {}),
      },
    });
    const config = await this.ensureConfig(tenantId);
    const series = await this.prisma.serieFaturacao.findMany({
      where: { tenantId, ativo: true },
      orderBy: { codigo: "asc" },
    });
    return {
      serie: updated,
      certificacao: this.buildCertificacaoStatus(config, series),
    };
  }

  /**
   * Campos de integração AT / certificação - só superadmin (control-plane)
   * ou personificação. O gestor preenche emitente, séries e template.
   */
  private assertTenantMayUpdateFaturacaoFields(
    user: RequestUser,
    dto: UpdateConfigFaturacaoDto,
  ) {
    if (user.impersonating || user.role === "super_admin") return;
    const atKeys: (keyof UpdateConfigFaturacaoDto)[] = [
      "softwareCertificado",
      "atSubutilizador",
      "atWfaPassword",
      "atCertificadoRef",
      "comunicacaoAtiva",
      "comunicacaoAutomatica",
      "aceitarLicencaAtWs",
    ];
    const presentes = atKeys.filter((k) => dto[k] !== undefined);
    if (presentes.length > 0) {
      throw new ForbiddenException(
        "Campos de integração AT e certificação só podem ser alterados pelo superadmin na plataforma.",
      );
    }
  }

  async updateConfig(user: RequestUser, dto: UpdateConfigFaturacaoDto) {
    this.assertTenantMayUpdateFaturacaoFields(user, dto);
    const tenantId = requireTenantId(user);
    return this.applyConfigUpdate(tenantId, user, dto);
  }

  /** Actualização de config AT pelo superadmin (control-plane). */
  async updateConfigForTenantAsPlatform(
    actor: RequestUser,
    tenantId: string,
    dto: UpdateConfigFaturacaoDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");
    const asUser: RequestUser = {
      ...actor,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      impersonating: true,
    };
    return this.applyConfigUpdate(tenantId, asUser, dto);
  }

  private async applyConfigUpdate(
    tenantId: string,
    user: RequestUser,
    dto: UpdateConfigFaturacaoDto,
  ) {
    const existing = await this.ensureConfig(tenantId);
    const integracao = this.atFaturas.getPublicConfig();

    const nextSoftware =
      dto.softwareCertificado !== undefined
        ? dto.softwareCertificado?.trim() || null
        : existing.softwareCertificado;
    const nextComunicacao =
      dto.comunicacaoAtiva !== undefined ? dto.comunicacaoAtiva : existing.comunicacaoAtiva;
    const nextComunicacaoAutomatica =
      dto.comunicacaoAutomatica !== undefined
        ? dto.comunicacaoAutomatica
        : existing.comunicacaoAutomatica;

    let nextLicencaAceiteEm = existing.atLicencaAceiteEm;
    let nextLicencaAceitePor = existing.atLicencaAceitePorUserId;
    let nextLicencaVersao = existing.atLicencaVersao;
    const aceitarAgora = dto.aceitarLicencaAtWs === true;
    if (aceitarAgora) {
      nextLicencaAceiteEm = new Date();
      nextLicencaAceitePor = user.sub;
      nextLicencaVersao = AT_LICENCA_ANEXO_II_VERSAO;
    }

    const licencaOk = isAtLicencaAnexoIiAceite({
      atLicencaAceiteEm: nextLicencaAceiteEm,
      atLicencaVersao: nextLicencaVersao,
    });

    if (nextComunicacao && !licencaOk) {
      throw new BadRequestException(
        "Aceite a Licença de utilização dos serviços web da AT (Anexo II) antes de activar a comunicação.",
      );
    }

    if (nextComunicacao && integracao.mode === "production") {
      const cert = resolverSoftwareCertificado(
        nextSoftware,
        integracao.softwareCertificado,
      ).numero;
      if (!cert) {
        throw new BadRequestException(
          "Não pode activar comunicação AT em produção sem número de certificação do software.",
        );
      }
      if (!existing.atSubutilizador?.trim() && !dto.atSubutilizador?.trim()) {
        throw new BadRequestException(
          "Configure o subutilizador WFA antes de activar comunicação AT em produção.",
        );
      }
      const hasPassword =
        !!existing.atWfaPasswordEnc?.trim() || !!dto.atWfaPassword?.trim();
      if (!hasPassword) {
        throw new BadRequestException(
          "Configure a password WFA antes de activar comunicação AT em produção.",
        );
      }
    }

    let nextPasswordEnc = existing.atWfaPasswordEnc;
    if (dto.atWfaPassword?.trim()) {
      const encKey = this.config.get<string>("AT_CREDENTIALS_ENCRYPTION_KEY");
      if (!encKey?.trim()) {
        throw new BadRequestException(
          "AT_CREDENTIALS_ENCRYPTION_KEY não configurado no servidor.",
        );
      }
      nextPasswordEnc = encriptarPasswordWfa(dto.atWfaPassword.trim(), encKey);
    }

    const serieCodigo = dto.seriePadraoCodigo?.trim() || existing.seriePadraoCodigo;
    await this.ensureAllSeries(tenantId, serieCodigo);

    const config = await this.prisma.configFaturacaoTenant.update({
      where: { tenantId },
      data: {
        nomeEmpresa: dto.nomeEmpresa?.trim() ?? existing.nomeEmpresa,
        moradaFiscal:
          dto.moradaFiscal !== undefined
            ? dto.moradaFiscal?.trim() || null
            : existing.moradaFiscal,
        nifEmitente: dto.nifEmitente?.trim() ?? existing.nifEmitente,
        iban:
          dto.iban !== undefined
            ? dto.iban?.trim()
              ? normalizarIban(dto.iban)
              : null
            : existing.iban,
        bicSwift:
          dto.bicSwift !== undefined
            ? dto.bicSwift?.trim()
              ? normalizarBic(dto.bicSwift)
              : null
            : existing.bicSwift,
        emailGestor:
          dto.emailGestor !== undefined
            ? dto.emailGestor?.trim() || null
            : existing.emailGestor,
        capitalSocial:
          dto.capitalSocial !== undefined
            ? dto.capitalSocial?.trim() || null
            : existing.capitalSocial,
        consRegCom:
          dto.consRegCom !== undefined
            ? dto.consRegCom?.trim() || null
            : existing.consRegCom,
        seriePadraoCodigo: dto.seriePadraoCodigo?.trim() ?? existing.seriePadraoCodigo,
        taxaIvaPadrao: dto.taxaIvaPadrao ?? Number(existing.taxaIvaPadrao),
        regimeIva: dto.regimeIva?.trim() ?? existing.regimeIva,
        atSubutilizador:
          dto.atSubutilizador !== undefined
            ? dto.atSubutilizador?.trim() || null
            : existing.atSubutilizador,
        atWfaPasswordEnc: nextPasswordEnc,
        atCertificadoRef:
          dto.atCertificadoRef !== undefined
            ? dto.atCertificadoRef?.trim() || null
            : existing.atCertificadoRef,
        softwareCertificado: nextSoftware,
        atLicencaAceiteEm: nextLicencaAceiteEm,
        atLicencaAceitePorUserId: nextLicencaAceitePor,
        atLicencaVersao: nextLicencaVersao,
        comunicacaoAtiva: nextComunicacao,
        comunicacaoAutomatica: nextComunicacaoAutomatica,
      },
    });

    const emitenteTouched =
      dto.nomeEmpresa !== undefined ||
      dto.moradaFiscal !== undefined ||
      dto.nifEmitente !== undefined ||
      dto.iban !== undefined ||
      dto.bicSwift !== undefined ||
      dto.emailGestor !== undefined ||
      dto.capitalSocial !== undefined ||
      dto.consRegCom !== undefined;
    if (emitenteTouched || nextComunicacao) {
      assertDadosEmitenteCompletos(config);
    }

    let templateCores = parseFaturaTemplateCores(null);
    if (dto.templateCores !== undefined) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { metadata: true },
      });
      // Garantir plain object (DTO Nest) com headerMode explícito.
      const coresPatch = {
        headerMode:
          dto.templateCores.headerMode === "solid" ? ("solid" as const) : ("gradient" as const),
        headerFrom: dto.templateCores.headerFrom,
        headerVia: dto.templateCores.headerVia,
        headerTo: dto.templateCores.headerTo,
        accent: dto.templateCores.accent,
        surface: dto.templateCores.surface,
        border: dto.templateCores.border,
      };
      const nextMeta = mergeFaturaTemplateCoresMetadata(tenant?.metadata, coresPatch);
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { metadata: nextMeta as Prisma.InputJsonValue },
      });
      templateCores = parseFaturaTemplateCores(nextMeta);
    } else {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { metadata: true },
      });
      templateCores = parseFaturaTemplateCores(tenant?.metadata);
    }

    if (aceitarAgora) {
      void this.audit.log({
        actorType: "TENANT_USER",
        actorId: user.sub,
        action: "at.licenca.accepted",
        resourceType: "ConfigFaturacaoTenant",
        resourceId: tenantId,
        targetTenantId: tenantId,
        targetUserId: user.sub,
        payload: { versao: AT_LICENCA_ANEXO_II_VERSAO },
      });
    }

    const series = await this.prisma.serieFaturacao.findMany({
      where: { tenantId, ativo: true },
      orderBy: { codigo: "asc" },
    });
    return {
      config: this.sanitizeConfigForApi({
        ...config,
        softwareCertificadoEfectivo: this.resolveSoftwareCertNumber(config),
        templateCores,
      }),
      series,
      integracao,
      certificacao: this.buildCertificacaoStatus(config, series),
      licencaAt: {
        versao: AT_LICENCA_ANEXO_II_VERSAO,
        texto: AT_LICENCA_ANEXO_II_TEXTO,
        aceite: isAtLicencaAnexoIiAceite(config),
        aceiteEm: config.atLicencaAceiteEm?.toISOString() ?? null,
      },
    };
  }

  async testarLigacaoAtAsPlatform(actor: RequestUser, tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");
    return this.testarLigacaoAt({
      ...actor,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      impersonating: true,
    });
  }

  async testarLigacaoAt(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const config = await this.ensureConfig(tenantId);
    const integracao = this.atFaturas.getPublicConfig();

    if (integracao.mode === "disabled") {
      throw new BadRequestException(
        "Integração AT desactivada - configure AT_FATURAS_MODE=sandbox ou production.",
      );
    }

    if (
      !isAtLicencaAnexoIiAceite({
        atLicencaAceiteEm: config.atLicencaAceiteEm,
        atLicencaVersao: config.atLicencaVersao,
      })
    ) {
      throw new BadRequestException(
        "Aceite a Licença Anexo II (serviços web AT) antes de testar a ligação.",
      );
    }

    const resultado = await this.atFaturas.testarLigacao({
      nifEmitente: config.nifEmitente,
      subutilizador: config.atSubutilizador ?? "",
      password: this.resolveAtWfaPassword(config),
    });

    return {
      sucesso: resultado.sucesso,
      codigoResposta: resultado.codigoResposta,
      mensagemAt: resultado.mensagemAt,
      mode: resultado.mode,
      sandboxSimulado: integracao.sandboxSimulado ?? false,
      sandboxReal: integracao.sandboxReal ?? false,
      endpoint: integracao.endpoint,
    };
  }

  async criarNotaCredito(user: RequestUser, faturaId: string) {
    const tenantId = requireTenantId(user);
    const original = await this.prisma.faturaComercial.findFirst({
      where: { id: faturaId, tenantId },
      include: {
        serie: true,
        linhas: { orderBy: { ordem: "asc" } },
      },
    });
    if (!original) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    if (original.serie.tipo !== "FT") {
      throw new BadRequestException("Notas de crédito só podem ser criadas a partir de faturas (FT).");
    }
    if (original.estado !== "EMITIDA" && original.estado !== "COMUNICADA_AT") {
      throw new BadRequestException(
        "Só faturas emitidas ou comunicadas podem originar nota de crédito.",
      );
    }

    const ncExistente = await this.prisma.faturaComercial.findFirst({
      where: {
        tenantId,
        faturaReferenciaId: faturaId,
        estado: { in: ["RASCUNHO", "EMITIDA", "COMUNICADA_AT"] },
        serie: { tipo: "NC" },
      },
    });
    if (ncExistente) {
      throw new ConflictException(
        "Já existe uma nota de crédito activa para esta fatura.",
      );
    }

    await this.ensureConfig(tenantId);
    const serieNc = await this.ensureSerieByTipo(tenantId, original.serie.codigo, "NC");
    const refOriginal = this.refFatura(original);

    return this.createFaturaInternal(tenantId, {
      entidadeClienteId: original.entidadeClienteId,
      faturaReferenciaId: original.id,
      serieId: serieNc.id,
      dataVencimento: original.dataVencimento,
      notas: `Nota de crédito referente a ${refOriginal}`,
      destinatarioNome: original.destinatarioNome,
      destinatarioNif: original.destinatarioNif,
      destinatarioMorada: original.destinatarioMorada,
      moradaCarga: original.moradaCarga,
      moradaDescarga: original.moradaDescarga,
      retencaoCentavos: original.retencaoCentavos,
      linhas: original.linhas.map((l) => ({
        descricao: `Anulação parcial/total: ${l.descricao}`,
        quantidade: Number(l.quantidade),
        precoUnitCentavos: l.precoUnitCentavos,
        taxaIva: Number(l.taxaIva),
        descontoPercent: Number(l.descontoPercent ?? 0),
        codigoIsencaoIva: l.codigoIsencaoIva,
      })),
    });
  }

  private resolveSoftwareCertNumber(
    config: { softwareCertificado?: string | null },
  ): string | null {
    return resolverSoftwareCertificado(
      config.softwareCertificado,
      this.atFaturas.getPublicConfig().softwareCertificado,
    ).numero;
  }

  private buildCertificacaoStatus(
    config: {
      nifEmitente: string;
      moradaFiscal: string | null;
      atSubutilizador: string | null;
      atWfaPasswordEnc?: string | null;
      atCertificadoRef: string | null;
      softwareCertificado: string | null;
      comunicacaoAtiva: boolean;
      nomeEmpresa: string;
      atLicencaAceiteEm?: Date | null;
      atLicencaVersao?: string | null;
      iban?: string | null;
      bicSwift?: string | null;
      emailGestor?: string | null;
      capitalSocial?: string | null;
      consRegCom?: string | null;
    },
    series?: Array<{ codigo: string; tipo: string; codigoValidacaoAt: string | null }>,
  ) {
    const integracao = this.atFaturas.getPublicConfig();
    return avaliarCertificacaoAt({
      config,
      series: series ?? [],
      softwarePlataforma: integracao.softwareCertificado,
      modoServidor: integracao.mode,
    });
  }

  private async createFaturaInternal(
    tenantId: string,
    input: {
      entidadeClienteId: string;
      propostaId?: string;
      faturaReferenciaId?: string;
      serieId: string;
      dataVencimento: Date | null;
      notas: string | null;
      destinatarioNome: string;
      destinatarioNif: string;
      destinatarioMorada: string | null;
      moradaCarga?: string | null;
      moradaDescarga?: string | null;
      retencaoCentavos?: number;
      linhas: Array<{
        descricao: string;
        quantidade: number;
        precoUnitCentavos: number;
        taxaIva: number;
        descontoPercent?: number;
        codigoIsencaoIva?: string | null;
      }>;
    },
  ) {
    if (input.linhas.length === 0) {
      throw new BadRequestException("A fatura precisa de pelo menos uma linha.");
    }
    const totais = calcularTotaisFatura(input.linhas);

    return this.prisma.faturaComercial.create({
      data: {
        tenantId,
        entidadeClienteId: input.entidadeClienteId,
        propostaId: input.propostaId ?? null,
        faturaReferenciaId: input.faturaReferenciaId ?? null,
        serieId: input.serieId,
        dataVencimento: input.dataVencimento,
        notas: input.notas,
        destinatarioNome: input.destinatarioNome,
        destinatarioNif: input.destinatarioNif,
        destinatarioMorada: input.destinatarioMorada,
        moradaCarga: input.moradaCarga ?? null,
        moradaDescarga: input.moradaDescarga ?? null,
        valorCentavos: totais.valorCentavos,
        ivaCentavos: totais.ivaCentavos,
        retencaoCentavos: input.retencaoCentavos ?? 0,
        linhas: {
          create: input.linhas.map((l, i) => ({
            ordem: i + 1,
            descricao: l.descricao,
            quantidade: l.quantidade,
            precoUnitCentavos: l.precoUnitCentavos,
            taxaIva: l.taxaIva,
            descontoPercent: l.descontoPercent ?? 0,
            valorIvaCentavos: calcularValorIvaCentavos(l),
            codigoIsencaoIva: l.codigoIsencaoIva ?? null,
          })),
        },
      },
      include: FATURA_INCLUDE,
    });
  }

  private normalizeLinha(
    l: FaturaLinhaDto,
    taxaPadrao: number,
  ): LinhaIvaInput & { descricao: string; codigoIsencaoIva: string | null } {
    const taxaIva = l.taxaIva ?? taxaPadrao;
    let codigoIsencaoIva: string | null = null;
    if (taxaIva <= 0) {
      const raw = (l.codigoIsencaoIva?.trim() || "M07").toUpperCase();
      if (!isMotivoIsencaoValido(raw)) {
        throw new BadRequestException(
          `Código de isenção IVA inválido (${raw}). Use códigos M01–M99 da AT.`,
        );
      }
      codigoIsencaoIva = raw;
    }
    return {
      descricao: l.descricao.trim(),
      quantidade: l.quantidade ?? 1,
      precoUnitCentavos: l.precoUnitCentavos,
      taxaIva,
      descontoPercent: Math.min(100, Math.max(0, l.descontoPercent ?? 0)),
      codigoIsencaoIva,
    };
  }

  private async resolveSerieETaxa(tenantId: string, serieId?: string) {
    const config = await this.ensureConfig(tenantId);
    const taxaIva = Number(config.taxaIvaPadrao);

    if (serieId) {
      const serie = await this.prisma.serieFaturacao.findFirst({
        where: { id: serieId, tenantId, ativo: true },
      });
      if (!serie) {
        throw new NotFoundException("Série de faturação não encontrada.");
      }
      return { serie, taxaIva };
    }

    const serie = await this.ensureSerie(tenantId, config.seriePadraoCodigo, config.nifEmitente);
    return { serie, taxaIva };
  }

  private async ensureConfig(tenantId: string) {
    const existing = await this.prisma.configFaturacaoTenant.findUnique({
      where: { tenantId },
    });
    if (existing) {
      return existing;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nif: true, legalName: true },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const year = String(new Date().getFullYear());
    const config = await this.prisma.configFaturacaoTenant.create({
      data: {
        tenantId,
        nomeEmpresa: tenant.legalName,
        nifEmitente: tenant.nif,
        seriePadraoCodigo: year,
      },
    });
    await this.ensureAllSeries(tenantId, year);
    return config;
  }

  private async ensureAllSeries(tenantId: string, codigo: string) {
    for (const tipo of ["FT", "NC", "FS"] as const) {
      await this.ensureSerieByTipo(tenantId, codigo, tipo);
    }
  }

  private async ensureSerie(tenantId: string, codigo: string, _nif: string) {
    return this.ensureSerieByTipo(tenantId, codigo, "FT");
  }

  private async ensureSerieByTipo(
    tenantId: string,
    codigo: string,
    tipo: "FT" | "NC" | "FS",
  ) {
    const existing = await this.prisma.serieFaturacao.findFirst({
      where: { tenantId, codigo, tipo },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.serieFaturacao.create({
      data: {
        tenantId,
        codigo,
        tipo,
      },
    });
  }

  private sanitizeConfigForApi(
    config: Record<string, unknown> & { atWfaPasswordEnc?: string | null },
  ) {
    const { atWfaPasswordEnc, ...rest } = config;
    return {
      ...rest,
      atWfaPasswordConfigured: !!atWfaPasswordEnc?.trim(),
    };
  }

  private resolveAtWfaPassword(config: { atWfaPasswordEnc: string | null }): string {
    if (!config.atWfaPasswordEnc?.trim()) return "";
    const encKey = this.config.get<string>("AT_CREDENTIALS_ENCRYPTION_KEY");
    if (!encKey?.trim()) {
      throw new BadRequestException("AT_CREDENTIALS_ENCRYPTION_KEY não configurado no servidor.");
    }
    try {
      return desencriptarPasswordWfa(config.atWfaPasswordEnc, encKey);
    } catch {
      throw new BadRequestException(
        "Password WFA não pode ser lida - guarde novamente a password em Configuração → Faturação (ou verifique AT_CREDENTIALS_ENCRYPTION_KEY).",
      );
    }
  }

  private async loadFaturaParaComunicacaoAt(tenantId: string, id: string) {
    const existing = await this.prisma.faturaComercial.findFirst({
      where: { id, tenantId },
      include: {
        serie: { select: { codigo: true, tipo: true } },
        linhas: { orderBy: { ordem: "asc" } },
        faturaReferencia: {
          select: {
            numero: true,
            serie: { select: { codigo: true, tipo: true } },
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    if (existing.estado !== "EMITIDA" && existing.estado !== "COMUNICADA_AT") {
      throw new BadRequestException(
        "Só faturas emitidas podem ser comunicadas à AT.",
      );
    }
    if (existing.numero == null || !existing.codigoAtcud || !existing.dataEmissao) {
      throw new BadRequestException("Fatura emitida sem numeração ou ATCUD.");
    }
    return existing;
  }

  private buildDocumentoAtInput(
    existing: {
      destinatarioNif: string;
      numero: number | null;
      codigoAtcud: string | null;
      dataEmissao: Date | null;
      valorCentavos: number;
      ivaCentavos: number;
      moeda: string;
      hashIntegridade?: string | null;
      retencaoCentavos?: number;
      serie: { codigo: string; tipo: string };
      linhas: Array<{
        descricao: string;
        quantidade: unknown;
        precoUnitCentavos: number;
        taxaIva: unknown;
        descontoPercent?: unknown;
        valorIvaCentavos: number;
        codigoIsencaoIva?: string | null;
      }>;
      faturaReferencia?: {
        numero: number | null;
        serie: { codigo: string; tipo: string };
      } | null;
    },
    config: { nifEmitente: string; softwareCertificado?: string | null },
    invoiceStatus: AtInvoiceStatus,
  ): AtFaturaDocumentoInput {
    const sw = this.resolveSoftwareCertNumber(config);
    const ref =
      existing.faturaReferencia?.numero != null
        ? {
            tipo: existing.faturaReferencia.serie.tipo,
            serie: existing.faturaReferencia.serie.codigo,
            numero: existing.faturaReferencia.numero,
          }
        : null;

    return {
      nifEmitente: config.nifEmitente,
      nifCliente: existing.destinatarioNif,
      tipoDocumento: existing.serie.tipo,
      serie: existing.serie.codigo,
      numero: existing.numero!,
      atcud: existing.codigoAtcud!,
      dataEmissao: existing.dataEmissao!,
      valorCentavos: existing.valorCentavos,
      ivaCentavos: existing.ivaCentavos,
      moeda: existing.moeda,
      invoiceStatus,
      hashIntegridade: existing.hashIntegridade,
      softwareCertificado: sw,
      systemEntryDate: existing.dataEmissao!,
      retencaoCentavos: existing.retencaoCentavos ?? 0,
      retencaoTipo: "IRS",
      documentoReferencia: ref,
      linhas: existing.linhas.map((l) => ({
        descricao: l.descricao,
        quantidade: Number(l.quantidade),
        precoUnitCentavos: l.precoUnitCentavos,
        descontoPercent: Number(l.descontoPercent ?? 0),
        taxaIva: Number(l.taxaIva),
        valorIvaCentavos: l.valorIvaCentavos,
        codigoMotivoIsencao: l.codigoIsencaoIva,
      })),
    };
  }

  private assertComunicacaoAtPermitida(config: {
    comunicacaoAtiva: boolean;
    softwareCertificado: string | null;
    atLicencaAceiteEm?: Date | null;
    atLicencaVersao?: string | null;
  }) {
    const atMode = this.atFaturas.getPublicConfig().mode;
    if (atMode === "disabled") {
      throw new BadRequestException("Integração AT desactivada no servidor.");
    }
    if (
      !isAtLicencaAnexoIiAceite({
        atLicencaAceiteEm: config.atLicencaAceiteEm,
        atLicencaVersao: config.atLicencaVersao,
      })
    ) {
      throw new BadRequestException(
        "Aceite a Licença Anexo II (serviços web AT) em Configuração → Faturação antes de comunicar.",
      );
    }
    if (!config.comunicacaoAtiva) {
      throw new BadRequestException(
        "Comunicação AT não activa - active em Configuração → Faturação.",
      );
    }
    if (atMode === "sandbox") {
      return;
    }
    if (atMode === "production") {
      if (!this.resolveSoftwareCertNumber(config)) {
        throw new BadRequestException(
          "Software não certificado pela AT - configure o número de certificação antes de comunicar em produção.",
        );
      }
    }
  }

  private async executarComunicacaoAt(
    id: string,
    documento: AtFaturaDocumentoInput,
    config: {
      nifEmitente: string;
      atSubutilizador: string | null;
      atWfaPasswordEnc: string | null;
    },
    opts: { marcarComunicada: boolean },
  ) {
    const resultado = await this.atFaturas.registarDocumento(documento, {
      nifEmitente: config.nifEmitente,
      subutilizador: config.atSubutilizador ?? "",
      password: this.resolveAtWfaPassword(config),
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.faturaComunicacaoAt.create({
        data: {
          faturaId: id,
          sucesso: resultado.sucesso,
          codigoResposta: resultado.codigoResposta,
          mensagemAt: resultado.mensagemAt,
          payloadHash: resultado.payloadHash,
        },
      });
      if (resultado.sucesso && opts.marcarComunicada) {
        await tx.faturaComercial.update({
          where: { id },
          data: { estado: "COMUNICADA_AT" },
        });
      }
    });

    return resultado;
  }

  private async assertEntidade(tenantId: string, id: string) {
    const ec = await this.prisma.entidadeCliente.findFirst({ where: { id, tenantId } });
    if (!ec) {
      throw new NotFoundException("Entidade cliente não encontrada.");
    }
  }

  /** Comunica uma série à AT via webservice e grava código de validação. */
  async comunicarSerieAt(user: RequestUser, serieId: string) {
    const tenantId = requireTenantId(user);
    const config = await this.ensureConfig(tenantId);
    this.assertLicencaAtAceite(config);
    return this.comunicarSerieInterno(tenantId, serieId, config);
  }

  /** Comunica todas as séries activas sem código AT. */
  async comunicarTodasSeriesAt(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const config = await this.ensureConfig(tenantId);
    this.assertLicencaAtAceite(config);
    const series = await this.prisma.serieFaturacao.findMany({
      where: {
        tenantId,
        ativo: true,
        OR: [{ codigoValidacaoAt: null }, { estadoAt: "PENDENTE" }],
      },
    });
    const results = [];
    for (const s of series) {
      results.push(await this.comunicarSerieInterno(tenantId, s.id, config));
    }
    return { total: results.length, results };
  }

  private assertLicencaAtAceite(config: {
    atLicencaAceiteEm?: Date | null;
    atLicencaVersao?: string | null;
  }) {
    if (
      !isAtLicencaAnexoIiAceite({
        atLicencaAceiteEm: config.atLicencaAceiteEm,
        atLicencaVersao: config.atLicencaVersao,
      })
    ) {
      throw new BadRequestException(
        "Aceite a Licença Anexo II (serviços web AT) em Configuração → Faturação antes de comunicar.",
      );
    }
  }

  private async ensureSerieComunicadaAt(
    tenantId: string,
    serieId: string,
    config: { nifEmitente: string; atSubutilizador: string | null; atWfaPasswordEnc: string | null; softwareCertificado: string | null },
  ) {
    const serie = await this.prisma.serieFaturacao.findFirst({
      where: { id: serieId, tenantId },
    });
    if (!serie) return;
    if (serie.codigoValidacaoAt?.trim() && serie.estadoAt === "REGISTADA") return;

    const auto =
      this.config.get<string>("AT_SERIES_AUTO_REGISTER") === "1" ||
      this.atSeries.getPublicConfig().mode !== "disabled";
    if (!auto) return;

    await this.comunicarSerieInterno(tenantId, serieId, config);
  }

  private async comunicarSerieInterno(
    tenantId: string,
    serieId: string,
    config: {
      nifEmitente: string;
      atSubutilizador: string | null;
      atWfaPasswordEnc: string | null;
      softwareCertificado: string | null;
    },
  ) {
    const serie = await this.prisma.serieFaturacao.findFirst({
      where: { id: serieId, tenantId },
    });
    if (!serie) {
      throw new NotFoundException("Série não encontrada.");
    }
    if (serie.estadoAt === "REGISTADA" && serie.codigoValidacaoAt?.trim()) {
      return { serie, resultado: { sucesso: true, mensagemAt: "Série já registada na AT." } };
    }
    if (serie.estadoAt === "ANULADA") {
      throw new BadRequestException("Série anulada na AT – crie uma nova série.");
    }

    const sw = resolverSoftwareCertificado(
      config.softwareCertificado,
      this.config.get<string>("AT_SOFTWARE_CERT_NUMBER"),
    ).numero;
    if (!sw && this.atSeries.getPublicConfig().mode === "production") {
      throw new BadRequestException(
        "Número de certificação software AT em falta para comunicar séries.",
      );
    }

    const dataInicio = serie.dataInicioPrevUtiliz ?? new Date();
    const resultado = await this.atSeries.registarSerie(
      {
        serie: serie.codigo,
        tipoDocumento: serie.tipo,
        numInicialSeq: serie.numInicialComunicado ?? serie.proximoNumero,
        dataInicioPrevUtiliz: dataInicio,
        numCertSWFatur: sw ?? "0",
      },
      {
        nifEmitente: config.nifEmitente,
        subutilizador: config.atSubutilizador ?? "",
        password: this.resolveAtWfaPassword(config),
      },
    );

    const updated = await this.prisma.serieFaturacao.update({
      where: { id: serieId },
      data: {
        mensagemAtSerie: resultado.mensagemAt,
        ...(resultado.sucesso && resultado.codigoValidacao
          ? {
              codigoValidacaoAt: resultado.codigoValidacao,
              estadoAt: "REGISTADA",
              comunicadaAtEm: new Date(),
              dataInicioPrevUtiliz: dataInicio,
              numInicialComunicado: serie.numInicialComunicado ?? serie.proximoNumero,
            }
          : {}),
      },
    });

    if (!resultado.sucesso) {
      throw new BadRequestException(resultado.mensagemAt);
    }

    return { serie: updated, resultado };
  }

  async exportSaftPt(
    user: RequestUser,
    opts: { ano: number; mes?: number },
  ): Promise<{ xml: string; filename: string; faturas: number }> {
    const tenantId = requireTenantId(user);
    const config = await this.prisma.configFaturacaoTenant.findUnique({ where: { tenantId } });
    if (!config) {
      throw new BadRequestException("Configure a faturação antes de exportar SAF-T.");
    }

    let periodoInicio: Date;
    let periodoFim: Date;
    if (opts.mes) {
      periodoInicio = new Date(Date.UTC(opts.ano, opts.mes - 1, 1));
      periodoFim = new Date(Date.UTC(opts.ano, opts.mes, 0, 23, 59, 59));
    } else {
      periodoInicio = new Date(Date.UTC(opts.ano, 0, 1));
      periodoFim = new Date(Date.UTC(opts.ano, 11, 31, 23, 59, 59));
    }

    const faturas = await this.prisma.faturaComercial.findMany({
      where: {
        tenantId,
        dataEmissao: { gte: periodoInicio, lte: periodoFim },
        estado: { in: ["EMITIDA", "COMUNICADA_AT", "ANULADA"] },
      },
      include: {
        linhas: { orderBy: { ordem: "asc" } },
        serie: { select: { codigo: true, tipo: true } },
        faturaReferencia: {
          select: {
            numero: true,
            serie: { select: { codigo: true, tipo: true } },
          },
        },
      },
      orderBy: [{ serieId: "asc" }, { numero: "asc" }],
    });

    const series = await this.prisma.serieFaturacao.findMany({
      where: { tenantId, ativo: true },
      select: {
        codigo: true,
        tipo: true,
        codigoValidacaoAt: true,
        proximoNumero: true,
        estadoAt: true,
      },
    });

    const productNif =
      this.config.get<string>("AT_PRODUCT_COMPANY_TAX_ID") ??
      this.config.get<string>("NEXIFORMA_NIF") ??
      "999999990";

    const xml = buildSaftPtXml({
      nifEmitente: config.nifEmitente,
      nomeEmpresa: config.nomeEmpresa,
      moradaFiscal: config.moradaFiscal,
      softwareCertificado: config.softwareCertificado,
      productCompanyTaxId: productNif,
      periodoInicio,
      periodoFim,
      series: series.map((s) => ({
        codigo: s.codigo,
        tipo: s.tipo,
        codigoValidacaoAt: s.codigoValidacaoAt,
        proximoNumero: s.proximoNumero,
        estadoAt: s.estadoAt,
      })),
      faturas: faturas
        .filter((f) => f.numero != null && f.dataEmissao)
        .map((f) => ({
          id: f.id,
          numero: f.numero!,
          codigoAtcud: f.codigoAtcud,
          estado: f.estado,
          dataEmissao: f.dataEmissao!,
          valorCentavos: f.valorCentavos,
          ivaCentavos: f.ivaCentavos,
          retencaoCentavos: f.retencaoCentavos,
          hashIntegridade: f.hashIntegridade,
          hashControl: f.hashControl,
          destinatarioNome: f.destinatarioNome,
          destinatarioNif: f.destinatarioNif,
          destinatarioMorada: f.destinatarioMorada,
          serieCodigo: f.serie.codigo,
          serieTipo: f.serie.tipo,
          documentoReferencia:
            f.faturaReferencia?.numero != null
              ? identificacaoDocumentoAt(
                  f.faturaReferencia.serie.tipo,
                  f.faturaReferencia.serie.codigo,
                  f.faturaReferencia.numero,
                )
              : null,
          linhas: f.linhas.map((l) => ({
            descricao: l.descricao,
            quantidade: Number(l.quantidade),
            precoUnitCentavos: l.precoUnitCentavos,
            descontoPercent: Number(l.descontoPercent ?? 0),
            taxaIva: Number(l.taxaIva),
            valorIvaCentavos: l.valorIvaCentavos,
            codigoIsencaoIva: l.codigoIsencaoIva,
          })),
        })),
    });

    const suffix = opts.mes
      ? `${opts.ano}-${String(opts.mes).padStart(2, "0")}`
      : String(opts.ano);

    return {
      xml,
      filename: `SAFT-PT_${config.nifEmitente}_${suffix}.xml`,
      faturas: faturas.length,
    };
  }

  /**
   * Pacote ZIP para auditoria de faturação: SAF-T, inventário CSV,
   * log de comunicações AT, séries e PDFs (até ao limite).
   */
  async exportAuditoriaFaturacao(
    user: RequestUser,
    opts: { ano: number; mes?: number },
  ): Promise<{ buffer: Buffer; filename: string; faturas: number }> {
    const tenantId = requireTenantId(user);
    const saft = await this.exportSaftPt(user, opts);

    let periodoInicio: Date;
    let periodoFim: Date;
    if (opts.mes) {
      periodoInicio = new Date(Date.UTC(opts.ano, opts.mes - 1, 1));
      periodoFim = new Date(Date.UTC(opts.ano, opts.mes, 0, 23, 59, 59));
    } else {
      periodoInicio = new Date(Date.UTC(opts.ano, 0, 1));
      periodoFim = new Date(Date.UTC(opts.ano, 11, 31, 23, 59, 59));
    }

    const [config, faturas, series] = await Promise.all([
      this.prisma.configFaturacaoTenant.findUnique({ where: { tenantId } }),
      this.prisma.faturaComercial.findMany({
        where: {
          tenantId,
          dataEmissao: { gte: periodoInicio, lte: periodoFim },
          estado: { in: ["EMITIDA", "COMUNICADA_AT", "ANULADA"] },
        },
        include: {
          serie: { select: { codigo: true, tipo: true } },
          comunicacoesAt: { orderBy: { tentativaEm: "asc" } },
        },
        orderBy: [{ serieId: "asc" }, { numero: "asc" }],
      }),
      this.prisma.serieFaturacao.findMany({
        where: { tenantId, ativo: true },
        orderBy: { codigo: "asc" },
        select: {
          codigo: true,
          tipo: true,
          codigoValidacaoAt: true,
          proximoNumero: true,
          estadoAt: true,
          comunicadaAtEm: true,
          dataInicioPrevUtiliz: true,
        },
      }),
    ]);

    if (!config) {
      throw new BadRequestException("Configure a faturação antes de exportar o pacote de auditoria.");
    }

    const suffix = opts.mes
      ? `${opts.ano}-${String(opts.mes).padStart(2, "0")}`
      : String(opts.ano);
    const geradoEm = new Date().toISOString();

    const csvHeader =
      "serie;tipo;numero;atcud;estado;data_emissao;cliente_nif;cliente_nome;base_eur;iva_eur;retencao_eur;total_eur;hash_control;anulada_em;motivo_anulacao\n";
    const csvRows = faturas.map((f) => {
      const total = f.valorCentavos + f.ivaCentavos - f.retencaoCentavos;
      const esc = (v: string | null | undefined) =>
        `"${String(v ?? "").replace(/"/g, '""')}"`;
      return [
        f.serie.codigo,
        f.serie.tipo,
        f.numero ?? "",
        f.codigoAtcud ?? "",
        f.estado,
        f.dataEmissao?.toISOString() ?? "",
        f.destinatarioNif,
        esc(f.destinatarioNome),
        (f.valorCentavos / 100).toFixed(2),
        (f.ivaCentavos / 100).toFixed(2),
        (f.retencaoCentavos / 100).toFixed(2),
        (total / 100).toFixed(2),
        f.hashControl ?? "",
        f.anuladaEm?.toISOString() ?? "",
        esc(f.motivoAnulacao),
      ].join(";");
    });

    const comunicacoes = faturas.flatMap((f) =>
      f.comunicacoesAt.map((c) => ({
        faturaId: f.id,
        documento: f.numero != null
          ? identificacaoDocumentoAt(f.serie.tipo, f.serie.codigo, f.numero)
          : null,
        atcud: f.codigoAtcud,
        tentativaEm: c.tentativaEm,
        sucesso: c.sucesso,
        codigoResposta: c.codigoResposta,
        mensagemAt: c.mensagemAt,
        payloadHash: c.payloadHash,
      })),
    );

    const pdfsIncluidos: string[] = [];
    const pdfsOmitidos: string[] = [];
    const zip = new AdmZip();
    zip.addFile(`saft/${saft.filename}`, Buffer.from(saft.xml, "utf8"));
    zip.addFile("inventario/faturas.csv", Buffer.from(csvHeader + csvRows.join("\n"), "utf8"));
    zip.addFile(
      "at/comunicacoes.json",
      Buffer.from(
        JSON.stringify(
          {
            schema: "nexiforma.faturacao_comunicacoes_at.v1",
            periodo: { inicio: periodoInicio, fim: periodoFim },
            total: comunicacoes.length,
            comunicacoes,
          },
          null,
          2,
        ),
        "utf8",
      ),
    );
    zip.addFile(
      "series/series.json",
      Buffer.from(JSON.stringify({ schema: "nexiforma.series_faturacao.v1", series }, null, 2), "utf8"),
    );

    const paraPdf = faturas.filter((f) => f.numero != null).slice(0, MAX_PDFS_PACOTE_AUDITORIA);
    for (const f of paraPdf) {
      const docId = identificacaoDocumentoAt(f.serie.tipo, f.serie.codigo, f.numero!).replace(
        /[^\w.-]+/g,
        "_",
      );
      try {
        const pkg = await this.htmlExport.buildPrintablePdf(user, f.id);
        const name = `documentos/${docId}.pdf`;
        zip.addFile(name, pkg.pdf);
        pdfsIncluidos.push(name);
      } catch (err) {
        pdfsOmitidos.push(
          `${docId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (faturas.length > MAX_PDFS_PACOTE_AUDITORIA) {
      pdfsOmitidos.push(
        `Limite de ${MAX_PDFS_PACOTE_AUDITORIA} PDFs – restantes disponíveis por download individual.`,
      );
    }

    const ficheiros = [
      `saft/${saft.filename}`,
      "inventario/faturas.csv",
      "at/comunicacoes.json",
      "series/series.json",
      ...pdfsIncluidos,
      "manifest.json",
      "README.txt",
    ];

    const manifest = {
      schema: FATURACAO_AUDITORIA_SCHEMA,
      geradoEm,
      nifEmitente: config.nifEmitente,
      nomeEmpresa: config.nomeEmpresa,
      periodo: {
        ano: opts.ano,
        mes: opts.mes ?? null,
        inicio: periodoInicio.toISOString(),
        fim: periodoFim.toISOString(),
      },
      totais: {
        faturas: faturas.length,
        comunicacoesAt: comunicacoes.length,
        pdfs: pdfsIncluidos.length,
      },
      ficheiros,
      pdfsOmitidos,
    };

    const readme =
      `Pacote de auditoria de faturação – NexiForma\n` +
      `Gerado: ${geradoEm}\n` +
      `Emitente: ${config.nifEmitente} – ${config.nomeEmpresa}\n` +
      `Período: ${suffix}\n\n` +
      `Conteúdo:\n` +
      `- saft/ – ficheiro SAF-T PT (XML)\n` +
      `- inventario/faturas.csv – inventário fiscal do período\n` +
      `- at/comunicacoes.json – log de comunicações à AT\n` +
      `- series/series.json – séries activas e códigos de validação\n` +
      `- documentos/ – PDFs emitidos (até ${MAX_PDFS_PACOTE_AUDITORIA})\n\n` +
      `Documentos no período: ${faturas.length}\n` +
      `Comunicações AT: ${comunicacoes.length}\n`;

    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));
    zip.addFile("README.txt", Buffer.from(readme, "utf8"));

    return {
      buffer: zip.toBuffer(),
      filename: `auditoria-faturacao_${config.nifEmitente}_${suffix}.zip`,
      faturas: faturas.length,
    };
  }
}
