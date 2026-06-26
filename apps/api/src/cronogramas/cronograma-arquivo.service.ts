import { ExportArquivoTipo } from "@nexiforma/database";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { CronogramaHtmlExportService } from "./cronograma-html-export.service";

@Injectable()
export class CronogramaArquivoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly htmlExport: CronogramaHtmlExportService,
  ) {}

  async storeTransferivel(user: RequestUser, cronogramaId: string) {
    const tenantId = requireTenantId(user);
    const cronograma = await this.prisma.cronograma.findFirst({
      where: { id: cronogramaId, tenantId },
      select: { id: true, acaoFormacaoId: true, versao: true },
    });
    if (!cronograma) {
      throw new NotFoundException("Cronograma não encontrado.");
    }

    const pkg = await this.htmlExport.buildPrintableHtml(user, cronogramaId);
    const buffer = Buffer.from(pkg.html, "utf8");
    const storageKey = `${tenantId}/${cronograma.acaoFormacaoId}/cronograma_html/v${cronograma.versao}-${Date.now()}-${pkg.filename}`;
    const mimeType = "text/html; charset=utf-8";
    const ttlDays = Number(this.config.get<string>("STORAGE_EXPORT_TTL_DAYS") ?? "90");
    const expiresAt = new Date(Date.now() + ttlDays * 86400000);

    await this.storage.putObject(storageKey, buffer, mimeType);

    const row = await this.prisma.arquivoExportacao.create({
      data: {
        tenantId,
        acaoFormacaoId: cronograma.acaoFormacaoId,
        tipo: ExportArquivoTipo.CRONOGRAMA_HTML,
        storageKey,
        nomeFicheiro: pkg.filename,
        mimeType,
        tamanhoBytes: buffer.byteLength,
        createdByUserId: user.sub,
        expiresAt,
      },
    });

    return {
      id: row.id,
      tipo: row.tipo,
      nomeFicheiro: row.nomeFicheiro,
      tamanhoBytes: row.tamanhoBytes,
      versaoCronograma: cronograma.versao,
      downloadPath: `/api/v1/cronogramas/arquivos/${row.id}/download`,
      expiresAt: row.expiresAt,
      criadoEm: row.createdAt,
    };
  }

  async streamArquivo(user: RequestUser, arquivoId: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.arquivoExportacao.findFirst({
      where: { id: arquivoId, tenantId, tipo: ExportArquivoTipo.CRONOGRAMA_HTML },
    });
    if (!row) {
      throw new NotFoundException("Arquivo de cronograma não encontrado.");
    }
    if (row.expiresAt && row.expiresAt < new Date()) {
      throw new BadRequestException("Arquivo expirado. Gera novamente o cronograma transferível.");
    }

    const obj = await this.storage.getObject(row.storageKey);
    if (!obj) {
      throw new NotFoundException("Ficheiro em falta no storage.");
    }

    return {
      body: obj.body,
      contentType: obj.contentType,
      filename: row.nomeFicheiro,
    };
  }

  listByAcao(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    return this.prisma.arquivoExportacao.findMany({
      where: { tenantId, acaoFormacaoId: acaoId, tipo: ExportArquivoTipo.CRONOGRAMA_HTML },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nomeFicheiro: true,
        tamanhoBytes: true,
        createdAt: true,
        expiresAt: true,
        createdBy: { select: { email: true, displayName: true } },
      },
    });
  }
}
