import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { opaqueStorageKey } from "../common/opaque-storage-key.util";
import { PersonaApiClient, type PersonaJsonApiResource } from "./persona-api.client";

type PhotoUrl = { page?: string; url?: string; "normalized-url"?: string };

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

    const gov = findPassedGovernmentIdVerification(payload.included);
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
      saved = await this.saveFormandoIdPhotos({
        tenantId: input.tenantId,
        userId: input.userId,
        formandoId: input.formandoId,
        files,
      });
    } else if (input.roleKind === "formador" && input.formadorId) {
      saved = await this.saveFormadorIdPhoto({
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

  private async saveFormandoIdPhotos(input: {
    tenantId: string;
    userId: string;
    formandoId: string;
    files: Array<{ url: string; page: string; filename: string }>;
  }): Promise<number> {
    const front = input.files.find((f) => f.page === "front");
    const back = input.files.find((f) => f.page === "back");
    const single = input.files.length === 1 ? input.files[0] : null;

    let saved = 0;
    if (single && !back) {
      saved += await this.upsertFormandoDoc({
        ...input,
        lado: "unico",
        file: single,
      });
    } else {
      if (front) {
        saved += await this.upsertFormandoDoc({
          ...input,
          lado: "frente",
          file: front,
        });
      }
      if (back) {
        saved += await this.upsertFormandoDoc({
          ...input,
          lado: "verso",
          file: back,
        });
      }
    }
    return saved;
  }

  private async saveFormadorIdPhoto(input: {
    tenantId: string;
    userId: string;
    formadorId: string;
    files: Array<{ url: string; page: string; filename: string }>;
  }): Promise<number> {
    const preferred =
      input.files.find((f) => f.page === "front") ??
      input.files.find((f) => f.page === "back") ??
      input.files[0];
    if (!preferred) return 0;
    return this.upsertFormadorDoc({ ...input, file: preferred });
  }

  private async upsertFormandoDoc(input: {
    tenantId: string;
    userId: string;
    formandoId: string;
    lado: string;
    file: { url: string; filename: string };
  }): Promise<number> {
    const { buffer, contentType } = await this.personaApi.downloadFile(input.file.url);
    const existing = await this.prisma.documentoAnexo.findFirst({
      where: {
        tenantId: input.tenantId,
        formandoId: input.formandoId,
        matriculaId: null,
        categoria: "documento_identificacao",
        lado: input.lado,
      },
    });
    const storageKey = opaqueStorageKey(["docs", input.tenantId, "f", input.formandoId]);
    await this.storage.putObject(storageKey, buffer, contentType);
    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.documentoAnexo.delete({ where: { id: existing.id } });
      }
      await tx.documentoAnexo.create({
        data: {
          tenantId: input.tenantId,
          formandoId: input.formandoId,
          matriculaId: null,
          categoria: "documento_identificacao",
          lado: input.lado,
          nome: input.file.filename,
          storageKey,
          mimeType: contentType,
          tamanhoBytes: buffer.length,
          createdByUserId: input.userId,
          visivelFormando: true,
        },
      });
    });
    if (existing) {
      await this.storage.deleteObject(existing.storageKey).catch(() => undefined);
    }
    return 1;
  }

  private async upsertFormadorDoc(input: {
    tenantId: string;
    userId: string;
    formadorId: string;
    file: { url: string; filename: string };
  }): Promise<number> {
    const { buffer, contentType } = await this.personaApi.downloadFile(input.file.url);
    const storageKey = opaqueStorageKey(["docs", input.tenantId, "formador", input.formadorId]);
    await this.storage.putObject(storageKey, buffer, contentType);
    await this.prisma.documentoAnexo.create({
      data: {
        tenantId: input.tenantId,
        formadorId: input.formadorId,
        categoria: "documento_identificacao",
        lado: "unico",
        nome: input.file.filename,
        storageKey,
        mimeType: contentType,
        tamanhoBytes: buffer.length,
        createdByUserId: input.userId,
        visivelFormador: true,
      },
    });
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
