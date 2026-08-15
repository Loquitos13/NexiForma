import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { opaqueStorageKey } from "../common/opaque-storage-key.util";
import { PersonaApiClient } from "./persona-api.client";
import { buildPersonaIdPdf, orderPersonaIdFiles, type DownloadedIdPart } from "./persona-id-pdf.util";
import {
  isInquiryPassed,
  resolvePersonaIdFiles,
  type PersonaIdFile,
} from "./persona-id-files.util";

const PERSONA_ID_PDF_NAME = "documento-identificacao-persona.pdf";

@Injectable()
export class PersonaDocumentSyncService {
  private readonly logger = new Logger(PersonaDocumentSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly personaApi: PersonaApiClient,
  ) {}

  async syncFromPersonaInquiry(input: {
    tenantId: string;
    userId: string;
    roleKind: "formando" | "formador";
    formandoId?: string | null;
    formadorId?: string | null;
    personaInquiryId: string;
  }): Promise<{ synced: boolean; documents: number; reason?: string }> {
    const payload = await this.personaApi.retrieveInquiry(input.personaInquiryId);
    const inquiryPassed = isInquiryPassed(payload.status);

    const resolved = await resolvePersonaIdFiles(payload.included, this.personaApi);
    if (!resolved) {
      await this.prisma.personaInquiry.updateMany({
        where: { personaInquiryId: input.personaInquiryId, tenantId: input.tenantId },
        data: {
          personaStatus: payload.status,
          status: mapInquiryStatus(payload.status),
        },
      });
      return {
        synced: false,
        documents: 0,
        reason: inquiryPassed ? "no_files" : "not_passed",
      };
    }

    let saved = 0;
    if (input.roleKind === "formando" && input.formandoId) {
      saved = await this.saveFormandoIdPdf({
        tenantId: input.tenantId,
        userId: input.userId,
        formandoId: input.formandoId,
        files: resolved.files,
      });
    } else if (input.roleKind === "formador" && input.formadorId) {
      saved = await this.saveFormadorIdPdf({
        tenantId: input.tenantId,
        userId: input.userId,
        formadorId: input.formadorId,
        files: resolved.files,
      });
    }

    if (!saved) {
      return { synced: false, documents: 0, reason: "pdf_failed" };
    }

    const attrs = resolved.attrs;
    const extractedName = [attrs["name-first"], attrs["name-last"]]
      .filter(Boolean)
      .join(" ")
      .trim();
    const extractedDocNumber = String(attrs["identification-number"] ?? "").trim() || null;

    await this.prisma.personaInquiry.updateMany({
      where: { personaInquiryId: input.personaInquiryId, tenantId: input.tenantId },
      data: {
        personaStatus: payload.status,
        status: "completed",
        syncedAt: new Date(),
        extractedName: extractedName || undefined,
        extractedDocNumber: extractedDocNumber || undefined,
      },
    });

    return { synced: true, documents: saved };
  }

  private async buildIdPdfBuffer(files: PersonaIdFile[]): Promise<Buffer | null> {
    const ordered = orderPersonaIdFiles(files);
    const parts: DownloadedIdPart[] = [];

    for (const file of ordered) {
      const { buffer, contentType } = await this.personaApi.downloadFile(file.url);
      parts.push({ buffer, contentType });
    }

    if (!parts.length) return null;

    try {
      return await buildPersonaIdPdf(parts);
    } catch (err) {
      this.logger.error(
        "Falha ao gerar PDF do documento Persona",
        err instanceof Error ? err.stack : String(err),
      );
      return null;
    }
  }

  private async saveFormandoIdPdf(input: {
    tenantId: string;
    userId: string;
    formandoId: string;
    files: PersonaIdFile[];
  }): Promise<number> {
    const pdfBuffer = await this.buildIdPdfBuffer(input.files);
    if (!pdfBuffer) return 0;
    return this.upsertFormandoIdPdf({ ...input, pdfBuffer });
  }

  private async saveFormadorIdPdf(input: {
    tenantId: string;
    userId: string;
    formadorId: string;
    files: PersonaIdFile[];
  }): Promise<number> {
    const pdfBuffer = await this.buildIdPdfBuffer(input.files);
    if (!pdfBuffer) return 0;
    return this.upsertFormadorIdPdf({ ...input, pdfBuffer });
  }

  private async upsertFormandoIdPdf(input: {
    tenantId: string;
    userId: string;
    formandoId: string;
    pdfBuffer: Buffer;
  }): Promise<number> {
    const existing = await this.prisma.documentoAnexo.findMany({
      where: {
        tenantId: input.tenantId,
        formandoId: input.formandoId,
        matriculaId: null,
        categoria: "documento_identificacao",
      },
    });
    const storageKey = opaqueStorageKey([
      "docs",
      input.tenantId,
      "f",
      input.formandoId,
      "persona-id",
      String(Date.now()),
    ]);
    await this.storage.putObject(storageKey, input.pdfBuffer, "application/pdf");
    await this.prisma.$transaction(async (tx) => {
      for (const doc of existing) {
        await tx.documentoAnexo.delete({ where: { id: doc.id } });
      }
      await tx.documentoAnexo.create({
        data: {
          tenantId: input.tenantId,
          formandoId: input.formandoId,
          matriculaId: null,
          categoria: "documento_identificacao",
          lado: "unico",
          nome: PERSONA_ID_PDF_NAME,
          storageKey,
          mimeType: "application/pdf",
          tamanhoBytes: input.pdfBuffer.length,
          createdByUserId: input.userId,
          visivelFormando: true,
        },
      });
    });
    for (const doc of existing) {
      await this.storage.deleteObject(doc.storageKey).catch(() => undefined);
    }
    return 1;
  }

  private async upsertFormadorIdPdf(input: {
    tenantId: string;
    userId: string;
    formadorId: string;
    pdfBuffer: Buffer;
  }): Promise<number> {
    const existing = await this.prisma.documentoAnexo.findMany({
      where: {
        tenantId: input.tenantId,
        formadorId: input.formadorId,
        categoria: "documento_identificacao",
      },
    });
    const storageKey = opaqueStorageKey([
      "docs",
      input.tenantId,
      "formador",
      input.formadorId,
      "persona-id",
      String(Date.now()),
    ]);
    await this.storage.putObject(storageKey, input.pdfBuffer, "application/pdf");
    await this.prisma.$transaction(async (tx) => {
      for (const doc of existing) {
        await tx.documentoAnexo.delete({ where: { id: doc.id } });
      }
      await tx.documentoAnexo.create({
        data: {
          tenantId: input.tenantId,
          formadorId: input.formadorId,
          categoria: "documento_identificacao",
          lado: "unico",
          nome: PERSONA_ID_PDF_NAME,
          storageKey,
          mimeType: "application/pdf",
          tamanhoBytes: input.pdfBuffer.length,
          createdByUserId: input.userId,
          visivelFormador: true,
        },
      });
    });
    for (const doc of existing) {
      await this.storage.deleteObject(doc.storageKey).catch(() => undefined);
    }
    return 1;
  }
}

function mapInquiryStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved" || s === "completed" || s === "passed") return "completed";
  if (s === "declined" || s === "failed") return "failed";
  if (s === "needs_review" || s === "marked-for-review") return "needs_review";
  return "pending";
}
