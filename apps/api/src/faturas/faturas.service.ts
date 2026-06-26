import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
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
  formatarAtcud,
  gerarCodigoValidacaoSerie,
} from "./fatura-atcud.util";
import { hashIntegridadeFatura } from "./fatura-integridade.util";
import {
  avaliarCertificacaoAt,
  resolverSoftwareCertificado,
} from "./at-certificacao.util";
import { AtFaturasIntegrationService } from "./at-faturas-integration.service";
import type { AtFaturaDocumentoInput, AtInvoiceStatus } from "./at-faturas-payload.util";
import {
  desencriptarPasswordWfa,
  encriptarPasswordWfa,
} from "./at-faturas-credentials.util";
import { PortalNotificacoesService } from "../notificacoes/portal-notificacoes.service";
import { MailService } from "../mail/mail.service";
import type {
  AnularFaturaDto,
  EnviarFaturaEmailDto,
  RejeitarPedidoAnulacaoDto,
  SolicitarAnulacaoFaturaDto,
} from "./dto/fatura.dto";
import { ConfigService } from "@nestjs/config";
import { buildSaftPtXml } from "./saft-pt-export.util";

const FATURA_INCLUDE = {
  entidadeCliente: { select: { id: true, nome: true, nif: true, email: true } },
  proposta: { select: { id: true, codigo: true, titulo: true, estado: true } },
  serie: { select: { id: true, codigo: true, tipo: true } },
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly htmlExport: FaturaHtmlExportService,
    private readonly atFaturas: AtFaturasIntegrationService,
    private readonly portalNotificacoes: PortalNotificacoesService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  list(
    user: RequestUser,
    filters?: { entidadeClienteId?: string; estado?: string },
  ) {
    const tenantId = requireTenantId(user);
    return this.prisma.faturaComercial.findMany({
      where: {
        tenantId,
        ...(filters?.entidadeClienteId
          ? { entidadeClienteId: filters.entidadeClienteId }
          : {}),
        ...(filters?.estado ? { estado: filters.estado as never } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: FATURA_INCLUDE,
    });
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
        entidadeCliente: { select: { nome: true, nif: true } },
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

    const { serie, taxaIva } = await this.resolveSerieETaxa(tenantId);
    const descricao =
      proposta.curso?.designacao?.trim() ||
      proposta.titulo.trim() ||
      "Prestação de serviços de formação";

    return this.createFaturaInternal(tenantId, {
      entidadeClienteId: proposta.entidadeClienteId,
      propostaId: proposta.id,
      serieId: serie.id,
      dataVencimento: null,
      notas: proposta.notasInternas,
      destinatarioNome: proposta.entidadeCliente.nome,
      destinatarioNif: proposta.entidadeCliente.nif,
      destinatarioMorada: null,
      linhas: [
        {
          descricao,
          quantidade: 1,
          precoUnitCentavos: proposta.valorCentavos,
          taxaIva,
        },
      ],
    });
  }

  async create(user: RequestUser, dto: CreateFaturaDto) {
    const tenantId = requireTenantId(user);
    await this.assertEntidade(tenantId, dto.entidadeClienteId);
    const entidade = await this.prisma.entidadeCliente.findFirst({
      where: { id: dto.entidadeClienteId, tenantId },
      select: { nome: true, nif: true },
    });
    if (!entidade) {
      throw new NotFoundException("Entidade cliente não encontrada.");
    }
    const { serie, taxaIva } = await this.resolveSerieETaxa(tenantId, dto.serieId);

    return this.createFaturaInternal(tenantId, {
      entidadeClienteId: dto.entidadeClienteId,
      serieId: serie.id,
      dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : null,
      notas: dto.notas?.trim() || null,
      destinatarioNome: dto.destinatarioNome?.trim() || entidade.nome,
      destinatarioNif: dto.destinatarioNif?.trim() || entidade.nif,
      destinatarioMorada: dto.destinatarioMorada?.trim() || null,
      linhas: dto.linhas.map((l) => ({
        descricao: l.descricao.trim(),
        quantidade: l.quantidade ?? 1,
        precoUnitCentavos: l.precoUnitCentavos,
        taxaIva: l.taxaIva ?? taxaIva,
      })),
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
      }));

    const totais = calcularTotaisFatura(linhasInput);
    if (linhasInput.length === 0) {
      throw new BadRequestException("A fatura precisa de pelo menos uma linha.");
    }

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
          destinatarioNome:
            dto.destinatarioNome !== undefined
              ? dto.destinatarioNome.trim()
              : existing.destinatarioNome,
          destinatarioNif:
            dto.destinatarioNif !== undefined
              ? dto.destinatarioNif.trim()
              : existing.destinatarioNif,
          destinatarioMorada:
            dto.destinatarioMorada !== undefined
              ? dto.destinatarioMorada?.trim() || null
              : existing.destinatarioMorada,
          notas: dto.notas !== undefined ? dto.notas?.trim() || null : existing.notas,
          valorCentavos: totais.valorCentavos,
          ivaCentavos: totais.ivaCentavos,
          linhas: {
            create: linhasInput.map((l, i) => ({
              ordem: i + 1,
              descricao: l.descricao,
              quantidade: l.quantidade,
              precoUnitCentavos: l.precoUnitCentavos,
              taxaIva: l.taxaIva,
              valorIvaCentavos: calcularValorIvaCentavos(l),
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
    const softwareCertificado = this.resolveSoftwareCertNumber(config);

    await this.prisma.$transaction(async (tx) => {
      const serieRow = await tx.serieFaturacao.findUnique({
        where: { id: existing.serieId },
      });
      if (!serieRow || !serieRow.ativo) {
        throw new NotFoundException("Série de faturação inválida.");
      }

      let codigoValidacao = serieRow.codigoValidacaoAt;
      if (!codigoValidacao) {
        codigoValidacao = gerarCodigoValidacaoSerie(
          tenantId,
          serieRow.codigo,
          serieRow.tipo,
        );
        await tx.serieFaturacao.update({
          where: { id: serieRow.id },
          data: { codigoValidacaoAt: codigoValidacao },
        });
      }

      const numero = serieRow.proximoNumero;
      const atcud = formatarAtcud(codigoValidacao, numero);
      const dataEmissao = new Date();

      const hashIntegridade = hashIntegridadeFatura({
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
        },
      });
    });

    return this.getOne(user, id);
  }

  buildDocumentoHtml(user: RequestUser, id: string) {
    return this.htmlExport.buildPrintableHtml(user, id);
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

    const pkg = await this.htmlExport.buildPrintableHtml(user, id);
    const ref = this.refFatura(existing);
    const config = await this.ensureConfig(tenantId);

    await this.mail.send({
      to,
      subject: `Fatura ${ref} - ${config.nomeEmpresa}`,
      text:
        `Exmo(a). Sr(a).,\n\n` +
        `Enviamos em anexo a fatura ${ref} emitida por ${config.nomeEmpresa}.\n\n` +
        `Com os melhores cumprimentos,\n${config.nomeEmpresa}`,
      html:
        `<p>Exmo(a). Sr(a).,</p>` +
        `<p>Segue a fatura <strong>${ref}</strong> emitida por <strong>${config.nomeEmpresa}</strong>.</p>` +
        `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />` +
        pkg.html,
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

  async solicitarAnulacao(user: RequestUser, id: string, dto: SolicitarAnulacaoFaturaDto) {
    const tenantId = requireTenantId(user);
    if (user.role !== "comercial") {
      throw new BadRequestException(
        "Comerciais solicitam anulação; gestores anulam directamente.",
      );
    }

    const fatura = await this.loadFaturaParaAnulacao(tenantId, id);
    const motivo = dto.motivo.trim();
    if (!motivo) {
      throw new BadRequestException("Indique o motivo da anulação.");
    }

    const pendente = await this.prisma.faturaPedidoAnulacao.findFirst({
      where: { faturaId: id, estado: "PENDENTE" },
    });
    if (pendente) {
      throw new ConflictException("Já existe um pedido de anulação pendente para esta fatura.");
    }

    const solicitante = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { displayName: true, email: true },
    });

    const pedido = await this.prisma.faturaPedidoAnulacao.create({
      data: {
        faturaId: id,
        solicitadoPorUserId: user.sub,
        motivo,
      },
    });

    const faturaRef = this.refFatura(fatura);
    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const link = `/portal/crm/faturas/${id}`;

    await this.portalNotificacoes.notifyGestores(tenantId, {
      tipo: "FATURA_PEDIDO_ANULACAO",
      titulo: `Pedido de anulação – ${faturaRef}`,
      mensagem: `${solicitante?.displayName ?? "Comercial"} solicitou anular ${faturaRef}: ${motivo}`,
      link,
      buildEmail: (gestor) =>
        this.portalNotificacoes.buildPedidoAnulacaoFaturaEmail({
          gestorNome: gestor.displayName,
          comercialNome: solicitante?.displayName ?? "Comercial",
          faturaRef,
          motivo,
          portalUrl: `${appUrl}${link}`,
        }),
    });

    const updated = await this.getOne(user, id);
    return { pedido, fatura: updated };
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
      const documento = this.buildDocumentoAtInput(fatura, config, "A");
      const resultado = await this.atFaturas.registarDocumento(documento, {
        nifEmitente: config.nifEmitente,
        subutilizador: config.atSubutilizador ?? "",
        password: this.resolveAtWfaPassword(config),
      });
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

    return this.getOne(user, id);
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
      include: { solicitadoPor: { select: { id: true, displayName: true } } },
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
    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";

    await this.portalNotificacoes.notifyUser({
      tenantId,
      userId: pendente.solicitadoPorUserId,
      tipo: "FATURA_PEDIDO_ANULACAO_REJEITADO",
      titulo: `Pedido de anulação rejeitado – ${faturaRef}`,
      mensagem:
        dto.respostaMotivo?.trim() ||
        `O gestor rejeitou o pedido de anulação da fatura ${faturaRef}.`,
      link: `/portal/crm/faturas/${id}`,
      push: {
        title: "Pedido de anulação rejeitado",
        body: `Fatura ${faturaRef}`,
        url: `${appUrl}/portal/crm/faturas/${id}`,
      },
    });

    return this.getOne(user, id);
  }

  private async loadFaturaParaAnulacao(tenantId: string, id: string) {
    const fatura = await this.prisma.faturaComercial.findFirst({
      where: { id, tenantId },
      include: { serie: true, linhas: { orderBy: { ordem: "asc" } } },
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

  async getConfig(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const config = await this.ensureConfig(tenantId);
    const series = await this.prisma.serieFaturacao.findMany({
      where: { tenantId, ativo: true },
      orderBy: { codigo: "asc" },
    });
    const integracao = this.atFaturas.getPublicConfig();
    const certificacao = this.buildCertificacaoStatus(config, series);
    return {
      config: this.sanitizeConfigForApi({
        ...config,
        softwareCertificadoEfectivo: this.resolveSoftwareCertNumber(config),
      }),
      series,
      integracao,
      certificacao,
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
    const codigo = dto.codigoValidacaoAt?.trim().toUpperCase() || null;
    if (codigo && !/^[A-Z0-9]{8}$/.test(codigo)) {
      throw new BadRequestException(
        "Código de validação AT deve ter 8 caracteres alfanuméricos.",
      );
    }
    const updated = await this.prisma.serieFaturacao.update({
      where: { id: serieId },
      data: { codigoValidacaoAt: codigo },
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

  async updateConfig(user: RequestUser, dto: UpdateConfigFaturacaoDto) {
    const tenantId = requireTenantId(user);
    const existing = await this.ensureConfig(tenantId);
    const integracao = this.atFaturas.getPublicConfig();

    const nextSoftware =
      dto.softwareCertificado !== undefined
        ? dto.softwareCertificado?.trim() || null
        : existing.softwareCertificado;
    const nextComunicacao =
      dto.comunicacaoAtiva !== undefined ? dto.comunicacaoAtiva : existing.comunicacaoAtiva;

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
        comunicacaoAtiva: nextComunicacao,
      },
    });

    const series = await this.prisma.serieFaturacao.findMany({
      where: { tenantId, ativo: true },
      orderBy: { codigo: "asc" },
    });
    return {
      config: this.sanitizeConfigForApi({
        ...config,
        softwareCertificadoEfectivo: this.resolveSoftwareCertNumber(config),
      }),
      series,
      integracao,
      certificacao: this.buildCertificacaoStatus(config, series),
    };
  }

  private resolveSoftwareCertNumber(
    config: { softwareCertificado: string | null },
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
      serieId: string;
      dataVencimento: Date | null;
      notas: string | null;
      destinatarioNome: string;
      destinatarioNif: string;
      destinatarioMorada: string | null;
      linhas: Array<{
        descricao: string;
        quantidade: number;
        precoUnitCentavos: number;
        taxaIva: number;
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
        serieId: input.serieId,
        dataVencimento: input.dataVencimento,
        notas: input.notas,
        destinatarioNome: input.destinatarioNome,
        destinatarioNif: input.destinatarioNif,
        destinatarioMorada: input.destinatarioMorada,
        valorCentavos: totais.valorCentavos,
        ivaCentavos: totais.ivaCentavos,
        linhas: {
          create: input.linhas.map((l, i) => ({
            ordem: i + 1,
            descricao: l.descricao,
            quantidade: l.quantidade,
            precoUnitCentavos: l.precoUnitCentavos,
            taxaIva: l.taxaIva,
            valorIvaCentavos: calcularValorIvaCentavos(l),
          })),
        },
      },
      include: FATURA_INCLUDE,
    });
  }

  private normalizeLinha(l: FaturaLinhaDto, taxaPadrao: number): LinhaIvaInput & { descricao: string } {
    return {
      descricao: l.descricao.trim(),
      quantidade: l.quantidade ?? 1,
      precoUnitCentavos: l.precoUnitCentavos,
      taxaIva: l.taxaIva ?? taxaPadrao,
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
    return desencriptarPasswordWfa(config.atWfaPasswordEnc, encKey);
  }

  private async loadFaturaParaComunicacaoAt(tenantId: string, id: string) {
    const existing = await this.prisma.faturaComercial.findFirst({
      where: { id, tenantId },
      include: {
        serie: { select: { codigo: true, tipo: true } },
        linhas: { orderBy: { ordem: "asc" } },
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
      serie: { codigo: string; tipo: string };
      linhas: Array<{
        descricao: string;
        quantidade: unknown;
        precoUnitCentavos: number;
        taxaIva: unknown;
        valorIvaCentavos: number;
      }>;
    },
    config: { nifEmitente: string },
    invoiceStatus: AtInvoiceStatus,
  ): AtFaturaDocumentoInput {
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
      linhas: existing.linhas.map((l) => ({
        descricao: l.descricao,
        quantidade: Number(l.quantidade),
        precoUnitCentavos: l.precoUnitCentavos,
        taxaIva: Number(l.taxaIva),
        valorIvaCentavos: l.valorIvaCentavos,
      })),
    };
  }

  private assertComunicacaoAtPermitida(config: {
    comunicacaoAtiva: boolean;
    softwareCertificado: string | null;
  }) {
    const atMode = this.atFaturas.getPublicConfig().mode;
    if (atMode === "disabled") {
      throw new BadRequestException("Integração AT desactivada no servidor.");
    }
    if (atMode === "production") {
      if (!config.comunicacaoAtiva) {
        throw new BadRequestException(
          "Comunicação AT não activa - active em Configuração → Faturação.",
        );
      }
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
      },
      orderBy: { dataEmissao: "asc" },
    });

    const productNif =
      this.config.get<string>("AT_PRODUCT_COMPANY_TAX_ID") ??
      this.config.get<string>("NEXIFORMA_NIF") ??
      "999999990";

    const xml = buildSaftPtXml({
      nifEmitente: config.nifEmitente,
      nomeEmpresa: config.nomeEmpresa,
      softwareCertificado: config.softwareCertificado,
      productCompanyTaxId: productNif,
      periodoInicio,
      periodoFim,
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
          destinatarioNome: f.destinatarioNome,
          destinatarioNif: f.destinatarioNif,
          serieCodigo: f.serie.codigo,
          serieTipo: f.serie.tipo,
          linhas: f.linhas.map((l) => ({
            descricao: l.descricao,
            quantidade: Number(l.quantidade),
            precoUnitCentavos: l.precoUnitCentavos,
            taxaIva: Number(l.taxaIva),
            valorIvaCentavos: l.valorIvaCentavos,
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
}
