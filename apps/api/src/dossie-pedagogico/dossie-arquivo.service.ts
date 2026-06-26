import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ExportArquivoTipo } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { DossiePedagogicoService } from "./dossie-pedagogico.service";
import { DossieHtmlExportService } from "./dossie-html-export.service";
import { SigoExportService } from "./sigo-export.service";
import { InspecaoPacoteService } from "./inspecao-pacote.service";

const MIME: Record<ExportArquivoTipo, string> = {
  DOSSIE_JSON: "application/json; charset=utf-8",
  SIGO_JSON: "application/json; charset=utf-8",
  DOSSIE_HTML: "text/html; charset=utf-8",
  CRONOGRAMA_HTML: "text/html; charset=utf-8",
  INSPECAO_ZIP: "application/zip",
};

@Injectable()
export class DossieArquivoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly dossie: DossiePedagogicoService,
    private readonly sigo: SigoExportService,
    private readonly html: DossieHtmlExportService,
    private readonly config: ConfigService,
    private readonly inspecaoPacote: InspecaoPacoteService,
  ) {}

  listByAcao(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.arquivoExportacao.findMany({
      where: { tenantId, acaoFormacaoId: acaoId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tipo: true,
        nomeFicheiro: true,
        mimeType: true,
        tamanhoBytes: true,
        createdAt: true,
        expiresAt: true,
        createdBy: { select: { email: true, displayName: true } },
      },
    });
  }

  async storeExport(user: RequestUser, acaoId: string, tipo: ExportArquivoTipo) {
    const tenantId = requireTenantId(user);
    await this.assertAcao(tenantId, acaoId);

    if (tipo === "INSPECAO_ZIP") {
      return this.inspecaoPacote.storePacote(user, acaoId);
    }

    let body: string;
    let filename: string;

    if (tipo === "DOSSIE_JSON") {
      const pkg = await this.dossie.buildExportPackage(user, acaoId);
      body = JSON.stringify(pkg.body, null, 2);
      filename = pkg.filename;
    } else if (tipo === "SIGO_JSON") {
      const pkg = await this.sigo.buildSigoJsonPackage(user, acaoId);
      body = JSON.stringify(pkg.body, null, 2);
      filename = pkg.filename;
    } else if (tipo === "DOSSIE_HTML") {
      const pkg = await this.html.buildPrintableHtml(user, acaoId);
      body = pkg.html;
      filename = pkg.filename;
    } else {
      throw new BadRequestException("Tipo de export inválido.");
    }

    const buffer = Buffer.from(body, "utf8");
    const storageKey = `${tenantId}/${acaoId}/${tipo.toLowerCase()}/${Date.now()}-${filename}`;
    const ttlDays = Number(this.config.get<string>("STORAGE_EXPORT_TTL_DAYS") ?? "90");
    const expiresAt = new Date(Date.now() + ttlDays * 86400000);

    await this.storage.putObject(storageKey, buffer, MIME[tipo]);

    const row = await this.prisma.arquivoExportacao.create({
      data: {
        tenantId,
        acaoFormacaoId: acaoId,
        tipo,
        storageKey,
        nomeFicheiro: filename,
        mimeType: MIME[tipo],
        tamanhoBytes: buffer.byteLength,
        createdByUserId: user.sub,
        expiresAt,
      },
    });

    const downloadUrl = await this.storage.getDownloadUrl(storageKey);

    return {
      id: row.id,
      tipo: row.tipo,
      nomeFicheiro: row.nomeFicheiro,
      tamanhoBytes: row.tamanhoBytes,
      storageBackend: this.storage.getBackend(),
      downloadUrl,
      expiresAt: row.expiresAt,
    };
  }

  async getDownloadUrl(user: RequestUser, arquivoId: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.arquivoExportacao.findFirst({
      where: { id: arquivoId, tenantId },
    });
    if (!row) {
      throw new NotFoundException("Arquivo não encontrado.");
    }
    if (row.expiresAt && row.expiresAt < new Date()) {
      throw new BadRequestException("Export expirado.");
    }
    return {
      id: row.id,
      nomeFicheiro: row.nomeFicheiro,
      downloadUrl: await this.storage.getDownloadUrl(row.storageKey),
      expiresAt: row.expiresAt,
    };
  }

  private async assertAcao(tenantId: string, acaoId: string) {
    const acao = await this.prisma.acaoFormacao.findFirst({ where: { id: acaoId, tenantId } });
    if (!acao) {
      throw new NotFoundException("Acção de formação não encontrada.");
    }
  }
}
