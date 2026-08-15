import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { opaqueStorageKey } from "../common/opaque-storage-key.util";
import { PersonaApiClient, type PersonaJsonApiResource } from "./persona-api.client";
import { buildPersonaIdPdf, orderPersonaIdFiles, type DownloadedIdPart } from "./persona-id-pdf.util";

type PhotoUrl = { page?: string; url?: string; "normalized-url"?: string };

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
    const inquiryStatus = payload.status.toLowerCase();
    const passed =
      inquiryStatus === "approved" ||
      inquiryStatus === "completed" ||
      inquiryStatus === "passed";

    let gov = findPassedGovernmentIdVerification(payload.included);
    if (gov?.id && !hasDownloadablePhotos(gov)) {
      try {
        gov = await this.personaApi.retrieveGovernmentIdVerification(gov.id);
      } catch (err) {
        this.logger.warn(
          `Falha ao obter detalhes da verificação ${gov.id}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
    if (!gov && !passed) {
      await this.prisma.personaInquiry.updateMany({
        where: { personaInquiryId: input.personaInquiryId, tenantId: input.tenantId },
        data: {
          personaStatus: payload.status,
          status: mapInquiryStatus(payload.status),
        },
      });
      return { synced: false, documents: 0, reason: "not_passed" };
    }

    const attrs = gov?.attributes ?? {};
    const photoUrls = (attrs["photo-urls"] as PhotoUrl[] | undefined) ?? [];
    const files = extractDownloadables(photoUrls, attrs);

    if (!files.length) {
      return { synced: false, documents: 0, reason: "no_files" };
    }

    let saved = 0;
    if (input.roleKind === "formando" && input.formandoId) {
      saved = await this.saveFormandoIdPdf({
        tenantId: input.tenantId,
        userId: input.userId,
        formandoId: input.formandoId,
        files,
      });
    } else if (input.roleKind === "formador" && input.formadorId) {
      saved = await this.saveFormadorIdPdf({
        tenantId: input.tenantId,
        userId: input.userId,
        formadorId: input.formadorId,
        files,
      });
    }

    const extractedName = [attrs["name-first"], attrs["name-last"]]
      .filter(Boolean)
      .join(" ")
      .trim();
    const extractedDocNumber = String(attrs["identification-number"] ?? "").trim() || null;

    await this.prisma.personaInquiry.updateMany({
      where: { personaInquiryId: input.personaInquiryId, tenantId: input.tenantId },
      data: {
        personaStatus: payload.status,
        status: saved > 0 ? "completed" : mapInquiryStatus(payload.status),
        syncedAt: saved > 0 ? new Date() : undefined,
        extractedName: extractedName || undefined,
        extractedDocNumber: extractedDocNumber || undefined,
      },
    });

    return { synced: saved > 0, documents: saved };
  }

  private async buildIdPdfBuffer(
    files: Array<{ url: string; page: string; filename: string }>,
  ): Promise<Buffer | null> {
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
    files: Array<{ url: string; page: string; filename: string }>;
  }): Promise<number> {
    const pdfBuffer = await this.buildIdPdfBuffer(input.files);
    if (!pdfBuffer) return 0;
    return this.upsertFormandoIdPdf({ ...input, pdfBuffer });
  }

  private async saveFormadorIdPdf(input: {
    tenantId: string;
    userId: string;
    formadorId: string;
    files: Array<{ url: string; page: string; filename: string }>;
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

function findPassedGovernmentIdVerification(
  included: PersonaJsonApiResource[],
): PersonaJsonApiResource | undefined {
  return included.find((item) => {
    if (item.type !== "verification/government-id") return false;
    const status = String(item.attributes?.status ?? "").toLowerCase();
    return status === "passed" || status === "approved";
  });
}

function hasDownloadablePhotos(gov: PersonaJsonApiResource): boolean {
  const attrs = gov.attributes ?? {};
  const photoUrls = (attrs["photo-urls"] as PhotoUrl[] | undefined) ?? [];
  if (photoUrls.some((p) => p["normalized-url"] || p.url)) return true;
  const files = attrs.files as Array<{ url?: string }> | undefined;
  return Boolean(files?.some((f) => f.url));
}

function extractDownloadables(
  photoUrls: PhotoUrl[],
  attrs: Record<string, unknown>,
): Array<{ url: string; page: string; filename: string }> {
  const out: Array<{ url: string; page: string; filename: string }> = [];
  for (const p of photoUrls) {
    const url = p["normalized-url"] || p.url;
    if (!url) continue;
    const page = p.page ?? "front";
    out.push({
      url,
      page,
      filename: `persona-id-${page}${extensionFromUrl(url)}`,
    });
  }
  const files = attrs.files as Array<{ url?: string; filename?: string }> | undefined;
  if (!out.length && files?.length) {
    for (const f of files) {
      if (!f.url) continue;
      out.push({
        url: f.url,
        page: "front",
        filename: f.filename ?? `persona-id-front${extensionFromUrl(f.url)}`,
      });
    }
  }
  return out;
}

function extensionFromUrl(url: string): string {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".pdf")) return ".pdf";
  if (path.endsWith(".png")) return ".png";
  if (path.endsWith(".heic")) return ".heic";
  return ".jpg";
}

function mapInquiryStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved" || s === "completed" || s === "passed") return "completed";
  if (s === "declined" || s === "failed") return "failed";
  if (s === "needs_review" || s === "marked-for-review") return "needs_review";
  return "pending";
}
