import type { PersonaApiClient, PersonaJsonApiResource } from "./persona-api.client";

type PhotoUrl = { page?: string; url?: string; "normalized-url"?: string };

export type PersonaIdFile = { url: string; page: string; filename: string };

const PASSED_STATUSES = new Set(["passed", "approved", "completed"]);

export function isInquiryPassed(status: string): boolean {
  return PASSED_STATUSES.has(status.toLowerCase());
}

export function isVerificationPassed(resource: PersonaJsonApiResource): boolean {
  return PASSED_STATUSES.has(String(resource.attributes?.status ?? "").toLowerCase());
}

export function hasDownloadablePhotos(resource: PersonaJsonApiResource): boolean {
  return extractDownloadablesFromAttrs(resource.attributes ?? {}).length > 0;
}

export function extractDownloadablesFromAttrs(
  attrs: Record<string, unknown>,
): PersonaIdFile[] {
  const photoUrls = (attrs["photo-urls"] as PhotoUrl[] | undefined) ?? [];
  const out: PersonaIdFile[] = [];

  for (const p of photoUrls) {
    const url = p["normalized-url"] || p.url;
    if (!url) continue;
    const page = p.page ?? "front";
    if (out.some((f) => f.page === page)) continue;
    out.push({
      url,
      page,
      filename: `persona-id-${page}${extensionFromUrl(url)}`,
    });
  }

  const files = attrs.files as Array<{ url?: string; filename?: string; page?: string }> | undefined;
  if (!out.length && files?.length) {
    for (const f of files) {
      if (!f.url) continue;
      const page = f.page ?? "front";
      if (out.some((item) => item.page === page)) continue;
      out.push({
        url: f.url,
        page,
        filename: f.filename ?? `persona-id-${page}${extensionFromUrl(f.url)}`,
      });
    }
  }

  const front = attrs["front-photo-url"] as string | undefined;
  const back = attrs["back-photo-url"] as string | undefined;
  if (!out.some((f) => f.page === "front") && front) {
    out.push({
      url: front,
      page: "front",
      filename: `persona-id-front${extensionFromUrl(front)}`,
    });
  }
  if (!out.some((f) => f.page === "back") && back) {
    out.push({
      url: back,
      page: "back",
      filename: `persona-id-back${extensionFromUrl(back)}`,
    });
  }

  return out;
}

/** Obtém imagens do BI/CC a partir de verifications/documents incluídos na inquiry. */
export async function resolvePersonaIdFiles(
  included: PersonaJsonApiResource[],
  personaApi: PersonaApiClient,
): Promise<{ attrs: Record<string, unknown>; files: PersonaIdFile[] } | null> {
  const verifications = included.filter((item) => item.type === "verification/government-id");
  const orderedVerifications = [
    ...verifications.filter(isVerificationPassed),
    ...verifications.filter((item) => !isVerificationPassed(item)),
  ];

  for (const candidate of orderedVerifications) {
    const resolved = await loadVerificationFiles(candidate, personaApi);
    if (resolved) return resolved;
  }

  for (const doc of included.filter((item) => item.type === "document/government-id")) {
    const files = extractDownloadablesFromAttrs(doc.attributes ?? {});
    if (files.length) {
      return { attrs: doc.attributes ?? {}, files };
    }
  }

  return null;
}

async function loadVerificationFiles(
  candidate: PersonaJsonApiResource,
  personaApi: PersonaApiClient,
): Promise<{ attrs: Record<string, unknown>; files: PersonaIdFile[] } | null> {
  let gov = candidate;
  if (gov.id && !hasDownloadablePhotos(gov)) {
    try {
      gov = await personaApi.retrieveGovernmentIdVerification(gov.id);
    } catch {
      return null;
    }
  }
  const files = extractDownloadablesFromAttrs(gov.attributes ?? {});
  if (!files.length) return null;
  return { attrs: gov.attributes ?? {}, files };
}

function extensionFromUrl(url: string): string {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".pdf")) return ".pdf";
  if (path.endsWith(".png")) return ".png";
  if (path.endsWith(".heic")) return ".heic";
  return ".jpg";
}
