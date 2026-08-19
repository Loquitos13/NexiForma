import {
  applyDocumentLogosToHtml,
  getModuloLogos,
  getModuloTemplates,
  mergeTemplateHtml,
  parseDocumentLogoPlacements,
  resolveMergedTemplateBody,
  type DocumentLogoPlacement,
  type DocumentOrientacao,
  type DocumentVerticalAlign,
  type ResolvedDocumentLogo,
  type TemplateModulo,
} from "@nexiforma/shared";
import {
  applyTenantDocumentBranding,
  resolveTenantLogoDataUri,
  resolveTenantSignatureDataUri,
  tenantSignatureImgHtml,
} from "../common/tenant-logo-embed.util";
import { readTenantSignatureResponsibleName } from "../auth/tenant-branding.util";
import {
  ensureFullDocumentHtml,
  resolveTenantTemplateContent,
  templateLabelForId,
} from "./tenant-document-pdf.util";

type StorageGetObject = {
  getObject(key: string): Promise<{ body: Buffer; contentType: string } | null>;
};

export type RenderMatriculaDocumentInput = {
  metadata: unknown;
  modulo: TemplateModulo;
  templateId: string;
  context: Record<string, string | number | null | undefined>;
  storage: StorageGetObject;
  /** HTML do corpo já mergeado (ex.: edição no wizard). */
  bodyHtmlOverride?: string;
  /** Posicionamento final de logos (ex.: ajuste no wizard). */
  logoPlacements?: DocumentLogoPlacement[];
  /** false = não injeta logo global legacy se o template tiver logos próprios */
  includeLegacyBranding?: boolean;
  /** Overrides temporários na emissão (não alteram o template guardado). */
  orientacaoOverride?: DocumentOrientacao;
  alinhamentoVerticalOverride?: DocumentVerticalAlign;
};

export type RenderMatriculaDocumentResult = {
  html: string;
  bodyHtml: string;
  label: string;
  logoPlacements: DocumentLogoPlacement[];
  orientacao: DocumentOrientacao;
  alinhamentoVertical: DocumentVerticalAlign;
};

async function resolveLogoDataUris(
  storage: StorageGetObject,
  metadata: unknown,
  modulo: TemplateModulo,
  placements: DocumentLogoPlacement[],
): Promise<ResolvedDocumentLogo[]> {
  const library = getModuloLogos(metadata, modulo);
  const byId = new Map(library.map((l) => [l.id, l] as const));
  const resolved: ResolvedDocumentLogo[] = [];

  for (const p of placements) {
    const asset = byId.get(p.logoId);
    if (!asset) continue;
    const obj = await storage.getObject(asset.storageKey);
    if (!obj?.body?.length) continue;
    resolved.push({
      ...p,
      nome: asset.nome,
      dataUri: `data:${obj.contentType};base64,${obj.body.toString("base64")}`,
    });
  }
  return resolved;
}

async function enrichDocumentContext(
  context: Record<string, string | number | null | undefined>,
  storage: StorageGetObject,
  metadata: unknown,
): Promise<Record<string, string | number | null | undefined>> {
  const signatureSrc = await resolveTenantSignatureDataUri(storage, metadata);
  const responsible =
    readTenantSignatureResponsibleName(metadata) ||
    String(context["entidade.responsavel_assinatura"] ?? "");
  return {
    ...context,
    "entidade.responsavel_assinatura": responsible,
    "entidade.assinatura": tenantSignatureImgHtml(signatureSrc),
  };
}

export async function renderMatriculaDocumentHtml(
  input: RenderMatriculaDocumentInput,
): Promise<RenderMatriculaDocumentResult> {
  const entry = getModuloTemplates(input.metadata, input.modulo)[input.templateId];
  const label = templateLabelForId(input.templateId, input.metadata);
  const rawTemplate = resolveTenantTemplateContent(
    input.metadata,
    input.modulo,
    input.templateId,
  );

  const context = await enrichDocumentContext(input.context, input.storage, input.metadata);

  let mergedBody = input.bodyHtmlOverride?.trim() ?? "";
  if (!mergedBody) {
    if (!rawTemplate.trim()) {
      throw new Error("EMPTY_TEMPLATE");
    }
    mergedBody = resolveMergedTemplateBody(rawTemplate, context, entry?.formato);
  } else {
    mergedBody = mergeTemplateHtml(mergedBody, context);
  }

  let html = ensureFullDocumentHtml(label, mergedBody, input.metadata, {
    orientacao: input.orientacaoOverride ?? entry?.orientacao ?? "portrait",
    verticalAlign:
      input.alinhamentoVerticalOverride ?? entry?.alinhamentoVertical ?? "top",
  });

  const templateLogos = parseDocumentLogoPlacements(entry?.logos);
  const logoPlacements = input.logoPlacements?.length
    ? parseDocumentLogoPlacements(input.logoPlacements)
    : templateLogos;

  if (logoPlacements.length) {
    const resolved = await resolveLogoDataUris(
      input.storage,
      input.metadata,
      input.modulo,
      logoPlacements,
    );
    if (resolved.length) {
      html = applyDocumentLogosToHtml(html, resolved);
    } else if (input.includeLegacyBranding !== false) {
      const logoSrc = await resolveTenantLogoDataUri(input.storage, input.metadata);
      html = applyTenantDocumentBranding(html, logoSrc, input.metadata);
    }
  } else if (input.includeLegacyBranding !== false) {
    const logoSrc = await resolveTenantLogoDataUri(input.storage, input.metadata);
    html = applyTenantDocumentBranding(html, logoSrc, input.metadata);
  }

  return {
    html,
    bodyHtml: mergedBody,
    label,
    logoPlacements,
    orientacao: (input.orientacaoOverride ?? entry?.orientacao ?? "portrait") as DocumentOrientacao,
    alinhamentoVertical: (input.alinhamentoVerticalOverride ??
      entry?.alinhamentoVertical ??
      "top") as DocumentVerticalAlign,
  };
}
