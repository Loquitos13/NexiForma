import {
  readTenantLogoStorageKey,
  readTenantSignatureStorageKey,
} from "../auth/tenant-branding.util";

type StorageGetObject = {
  getObject(key: string): Promise<{ body: Buffer; contentType: string } | null>;
};

export type TenantLogoPlacement = {
  posicao?: "left" | "center" | "right";
  larguraPx?: number;
  alturaPx?: number;
};

type BrandingMeta = {
  branding?: {
    logoUrl?: string;
    logoStorageKey?: string;
    footerText?: string;
    logoCabecalho?: TenantLogoPlacement;
    logoRodape?: TenantLogoPlacement;
  };
};

const DEFAULT_HEADER: TenantLogoPlacement = { posicao: "left", larguraPx: 160, alturaPx: 52 };
const DEFAULT_FOOTER: TenantLogoPlacement = { posicao: "center", larguraPx: 120, alturaPx: 40 };

function readPlacement(
  metadata: unknown,
  key: "logoCabecalho" | "logoRodape",
  defaults: TenantLogoPlacement,
): TenantLogoPlacement {
  const raw = ((metadata ?? {}) as BrandingMeta).branding?.[key];
  if (!raw || typeof raw !== "object") return defaults;
  const pos = raw.posicao;
  const posicao =
    pos === "center" || pos === "right" || pos === "left" ? pos : defaults.posicao ?? "left";
  const larguraPx =
    typeof raw.larguraPx === "number" && raw.larguraPx > 0
      ? Math.min(400, Math.max(24, raw.larguraPx))
      : defaults.larguraPx;
  const alturaPx =
    typeof raw.alturaPx === "number" && raw.alturaPx > 0
      ? Math.min(200, Math.max(16, raw.alturaPx))
      : defaults.alturaPx;
  return { posicao, larguraPx, alturaPx };
}

function alignStyle(posicao: TenantLogoPlacement["posicao"]): string {
  switch (posicao) {
    case "center":
      return "text-align:center;";
    case "right":
      return "text-align:right;";
    default:
      return "text-align:left;";
  }
}

function logoImgStyle(placement: TenantLogoPlacement): string {
  const w = placement.larguraPx ?? 160;
  const h = placement.alturaPx ?? 52;
  const center = placement.posicao === "center" ? "margin-left:auto;margin-right:auto;" : "";
  return `max-width:${w}px;max-height:${h}px;width:auto;height:auto;object-fit:contain;display:block;${center}`;
}

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
export function tenantLogoImgHtml(
  logoSrc: string | null | undefined,
  alt = "Logo",
  placement: TenantLogoPlacement = DEFAULT_HEADER,
  className = "tenant-logo",
): string {
  if (!logoSrc?.trim()) return "";
  const src = logoSrc.trim();
  if (!(src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://"))) {
    return "";
  }
  return `<img class="${className}" src="${src}" alt="${alt}" style="${logoImgStyle(placement)}" />`;
}

/** Resolve assinatura digitalizada do tenant (PNG transparente) para PDF/HTML. */
export async function resolveTenantSignatureDataUri(
  storage: StorageGetObject,
  metadata: unknown,
): Promise<string | null> {
  const key = readTenantSignatureStorageKey(metadata);
  if (!key) return null;
  const obj = await storage.getObject(key);
  if (!obj?.body?.length) return null;
  return `data:${obj.contentType};base64,${obj.body.toString("base64")}`;
}

/** Markup HTML da assinatura para {{entidade.assinatura}}. */
export function tenantSignatureImgHtml(
  signatureSrc: string | null | undefined,
  alt = "Assinatura",
): string {
  if (!signatureSrc?.trim()) return "";
  const src = signatureSrc.trim();
  if (!(src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://"))) {
    return "";
  }
  return `<img class="tenant-signature" src="${src}" alt="${escapeHtml(alt)}" style="max-width:280px;max-height:110px;width:auto;height:auto;display:block;object-fit:contain;" />`;
}

function tenantLogoBlockHtml(
  logoSrc: string | null | undefined,
  placement: TenantLogoPlacement,
  className: string,
  margin: string,
): string {
  const img = tenantLogoImgHtml(logoSrc, "Logo", placement, className);
  if (!img) return "";
  return `<div class="${className}-wrap" style="${alignStyle(placement.posicao)}${margin}">${img}</div>`;
}

/** CSS partilhado para documentos tenant (fallback em templates sem estilo inline). */
export function tenantDocumentBrandingCss(metadata: unknown): string {
  const header = readPlacement(metadata, "logoCabecalho", DEFAULT_HEADER);
  const footer = readPlacement(metadata, "logoRodape", DEFAULT_FOOTER);
  return `
    .tenant-logo-header { ${logoImgStyle(header).replace(/"/g, "")} }
    .tenant-logo-footer { ${logoImgStyle(footer).replace(/"/g, "")} }
    .tenant-doc-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #666; }
  `.trim();
}

/**
 * Aplica cabeçalho e rodapé com logo conforme branding do tenant.
 * Não duplica se já existir `.tenant-logo-header`.
 */
export function applyTenantDocumentBranding(
  html: string,
  logoSrc: string | null | undefined,
  metadata: unknown,
): string {
  if (!html.trim()) return html;

  const branding = ((metadata ?? {}) as BrandingMeta).branding;
  const headerPlacement = readPlacement(metadata, "logoCabecalho", DEFAULT_HEADER);
  const footerPlacement = readPlacement(metadata, "logoRodape", DEFAULT_FOOTER);
  const footerText = branding?.footerText?.trim() ?? "";

  let out = html;
  const hasHeaderLogo = /tenant-logo-header/.test(out);

  if (logoSrc && !hasHeaderLogo) {
    const header = tenantLogoBlockHtml(
      logoSrc,
      headerPlacement,
      "tenant-logo-header",
      "margin:0 0 16px;",
    );
    if (header) {
      if (/<body[^>]*>/i.test(out)) {
        out = out.replace(/<body([^>]*)>/i, `<body$1>${header}`);
      } else {
        out = `${header}${out}`;
      }
    }
  }

  const footerLogo = tenantLogoBlockHtml(
    logoSrc,
    footerPlacement,
    "tenant-logo-footer",
    "margin:0 0 8px;",
  );
  const footerBlock =
    footerLogo || footerText
      ? `<div class="tenant-doc-footer" style="${alignStyle(footerPlacement.posicao)}">${footerLogo}${footerText ? `<p style="margin:4px 0 0;">${escapeHtml(footerText)}</p>` : ""}</div>`
      : "";

  if (footerBlock && !/tenant-doc-footer/.test(out)) {
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${footerBlock}</body>`);
    } else {
      out = `${out}${footerBlock}`;
    }
  }

  return out;
}

/**
 * Insere o logo no início do `<body>` (legado - delega em applyTenantDocumentBranding).
 */
export function injectTenantLogoIntoHtml(
  html: string,
  logoSrc: string | null | undefined,
  metadata?: unknown,
): string {
  if (!logoSrc?.trim() || !html.trim()) return html;
  if (/class=["'][^"']*tenant-logo/.test(html)) return html;
  return applyTenantDocumentBranding(html, logoSrc, metadata ?? {});
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
