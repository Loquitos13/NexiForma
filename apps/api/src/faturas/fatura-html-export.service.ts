import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import QRCode from "qrcode";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { resolveTenantLogoDataUri } from "../common/tenant-logo-embed.util";
import { requireTenantId } from "../common/tenant-scope";
import { StorageService } from "../storage/storage.service";
import { buildFaturaQrPayload } from "./fatura-atcud.util";
import { resolverSoftwareCertificado } from "./at-certificacao.util";
import {
  buildFaturaDocumentoHtml,
  faturaDocumentoFilename,
  type FaturaDocumentoExemplar,
  type FaturaDocumentoInput,
} from "./fatura-documento-html.util";
import { parseFaturaTemplateCores } from "./fatura-template-cores.util";
import { FaturaPdfExportService } from "./fatura-pdf-export.service";
import { resolveMoradaCarga, resolveMoradaDescarga } from "./faturacao-moradas.util";

export type FaturaDocumentoPackage = {
  html: string;
  filenameHtml: string;
  filenamePdf: string;
  identificacao: string;
};

export type FaturaDocumentoBuildOptions = {
  exemplar?: FaturaDocumentoExemplar;
};

@Injectable()
export class FaturaHtmlExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pdfExport: FaturaPdfExportService,
    private readonly storage: StorageService,
  ) {}

  async buildPrintableHtml(
    user: RequestUser,
    faturaId: string,
    opts?: FaturaDocumentoBuildOptions,
  ) {
    const pkg = await this.buildDocumentoPackage(user, faturaId, opts);
    return { html: pkg.html, filename: pkg.filenameHtml };
  }

  async buildPrintablePdf(
    user: RequestUser,
    faturaId: string,
    opts?: FaturaDocumentoBuildOptions,
  ) {
    const pkg = await this.buildDocumentoPackage(user, faturaId, opts);
    const pdf = await this.pdfExport.htmlToPdfBuffer(pkg.html);
    return { pdf, filename: pkg.filenamePdf, identificacao: pkg.identificacao };
  }

  private async buildDocumentoPackage(
    user: RequestUser,
    faturaId: string,
    opts?: FaturaDocumentoBuildOptions,
  ): Promise<FaturaDocumentoPackage> {
    const exemplar = opts?.exemplar === "DUPLICADO" ? "DUPLICADO" : "ORIGINAL";
    const input = await this.loadDocumentoInput(user, faturaId, exemplar);
    const html = buildFaturaDocumentoHtml(input);
    const base = faturaDocumentoFilename(
      input.tipoSerie,
      input.serieCodigo,
      input.numero,
      exemplar,
    );
    const identificacao = `${input.tipoSerie} ${input.numeroDocumento}`;
    return {
      html,
      filenameHtml: `${base}.html`,
      filenamePdf: `${base}.pdf`,
      identificacao,
    };
  }

  private async loadDocumentoInput(
    user: RequestUser,
    faturaId: string,
    exemplar: FaturaDocumentoExemplar = "ORIGINAL",
  ): Promise<FaturaDocumentoInput> {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.faturaComercial.findFirst({
      where: { id: faturaId, tenantId },
      include: {
        entidadeCliente: { select: { nome: true, nif: true, email: true } },
        serie: { select: { codigo: true, tipo: true } },
        linhas: { orderBy: { ordem: "asc" } },
      },
    });
    if (!row) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    if (row.estado === "RASCUNHO") {
      throw new NotFoundException("Emita a fatura antes de gerar o documento.");
    }
    if (!row.numero || !row.codigoAtcud || !row.dataEmissao) {
      throw new NotFoundException("Fatura emitida sem numeração ou ATCUD.");
    }

    const [config, tenantMeta] = await Promise.all([
      this.prisma.configFaturacaoTenant.findUnique({ where: { tenantId } }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { metadata: true },
      }),
    ]);
    const softwareCert = resolverSoftwareCertificado(
      config?.softwareCertificado,
      this.config.get<string>("AT_SOFTWARE_CERT_NUMBER"),
    ).numero;

    const identificacao = `${row.serie.tipo} ${row.serie.codigo}/${row.numero}`;
    const qrPayload = buildFaturaQrPayload({
      nifEmitente: config?.nifEmitente ?? "-",
      nifCliente: row.destinatarioNif,
      tipoDocumento: row.serie.tipo,
      dataEmissao: row.dataEmissao,
      identificacaoDocumento: identificacao,
      atcud: row.codigoAtcud,
      totalSemIvaCentavos: row.valorCentavos,
      totalIvaCentavos: row.ivaCentavos,
      hashIntegridade: row.hashIntegridade,
      softwareCertificado: softwareCert,
    });
    const [qrDataUrl, logoSrc] = await Promise.all([
      QRCode.toDataURL(qrPayload, { width: 240, margin: 1 }),
      resolveTenantLogoDataUri(this.storage, tenantMeta?.metadata),
    ]);
    const cores = parseFaturaTemplateCores(tenantMeta?.metadata);

    return {
      tipoSerie: row.serie.tipo,
      tipoDocumentoLabel: row.serie.tipo === "FT" ? "FATURA" : row.serie.tipo,
      numeroDocumento: `${row.serie.codigo}/${row.numero}`,
      codigoAtcud: row.codigoAtcud,
      dataEmissao: row.dataEmissao,
      dataVencimento: row.dataVencimento,
      exemplar,
      logoSrc,
      cores,
      emitente: {
        nomeEmpresa: config?.nomeEmpresa ?? "-",
        moradaFiscal: config?.moradaFiscal ?? null,
        nifEmitente: config?.nifEmitente ?? "-",
        iban: config?.iban ?? null,
        bicSwift: config?.bicSwift ?? null,
        emailGestor: config?.emailGestor ?? null,
        capitalSocial: config?.capitalSocial ?? null,
        consRegCom: config?.consRegCom ?? null,
      },
      destinatario: {
        nome: row.destinatarioNome,
        nif: row.destinatarioNif,
        morada: row.destinatarioMorada,
        email: row.entidadeCliente.email,
      },
      moradaCarga: resolveMoradaCarga(row.moradaCarga, config?.moradaFiscal),
      moradaDescarga: resolveMoradaDescarga(row.moradaDescarga, row.destinatarioMorada),
      linhas: row.linhas.map((l) => ({
        descricao: l.descricao,
        quantidade: Number(l.quantidade),
        precoUnitCentavos: l.precoUnitCentavos,
        descontoPercent: Number(l.descontoPercent ?? 0),
        taxaIva: Number(l.taxaIva),
        valorIvaCentavos: l.valorIvaCentavos,
        codigoIsencaoIva: l.codigoIsencaoIva,
      })),
      notas: row.notas,
      valorCentavos: row.valorCentavos,
      ivaCentavos: row.ivaCentavos,
      retencaoCentavos: row.retencaoCentavos ?? 0,
      hashIntegridade: row.hashIntegridade,
      softwareCertificado: softwareCert,
      qrDataUrl,
      serieCodigo: row.serie.codigo,
      numero: row.numero,
    };
  }
}
