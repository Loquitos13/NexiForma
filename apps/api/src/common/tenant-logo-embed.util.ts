import { readTenantLogoStorageKey } from "../auth/tenant-branding.util";

type StorageGetObject = {
  getObject(key: string): Promise<{ body: Buffer; contentType: string } | null>;
};

type BrandingMeta = {
  branding?: {
    logoUrl?: string;
    logoStorageKey?: string;
  };
};

/**
 * Resolve o logo do tenant para embutir em HTML/PDF (data-URI preferido).
 * Evita URLs autenticadas que falham no Puppeteer / impressão.
 */
export async function resolveTenantLogoDataUri(
  storage: StorageGetObject,
  metadata: unknown,
): Promise<string | null> {
  const key = readTenantLogoStorageKey(metadata);
  if (key) {
    const obj = await storage.getObject(key);
    if (obj?.body?.length) {
      return `data:${obj.contentType};base64,${obj.body.toString("base64")}`;
    }
  }

  const url = ((metadata ?? {}) as BrandingMeta).branding?.logoUrl?.trim();
  if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:"))) {
    return url;
  }
  return null;
}

/** Markup HTML do logo para cabeçalhos de documentos (escape-safe: só data/http URLs). */
export function tenantLogoImgHtml(logoSrc: string | null | undefined, alt = "Logo"): string {
  if (!logoSrc?.trim()) return "";
  const src = logoSrc.trim();
  if (!(src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://"))) {
    return "";
  }
  return `<img class="tenant-logo" src="${src}" alt="${alt}" />`;
}

/**
 * Insere o logo no início do `<body>` de um HTML gerado (templates de inscrição, etc.).
 * Não duplica se já existir `.tenant-logo`.
 */
export function injectTenantLogoIntoHtml(
  html: string,
  logoSrc: string | null | undefined,
): string {
  const img = tenantLogoImgHtml(logoSrc);
  if (!img || !html.trim()) return html;
  if (/class=["'][^"']*tenant-logo/.test(html)) return html;
  const wrap = `<div class="tenant-logo-wrap" style="margin:0 0 16px;">${img}</div>`;
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${wrap}`);
  }
  return `${wrap}${html}`;
}
