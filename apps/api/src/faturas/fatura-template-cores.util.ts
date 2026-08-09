/** Cores do template visual da fatura (por tenant). */
export type FaturaHeaderMode = "solid" | "gradient";

export type FaturaTemplateCores = {
  /** Cor sólida no hero vs gradiente de 3 cores. */
  headerMode: FaturaHeaderMode;
  headerFrom: string;
  headerVia: string;
  headerTo: string;
  accent: string;
  surface: string;
  border: string;
};

export const FATURA_TEMPLATE_CORES_DEFAULT: FaturaTemplateCores = {
  headerMode: "gradient",
  headerFrom: "#6d28d9",
  headerVia: "#9333ea",
  headerTo: "#6366f1",
  accent: "#7c3aed",
  surface: "#f5f3ff",
  border: "#ddd6fe",
};

const HEX = /^#([0-9a-fA-F]{6})$/;

function normalizeHex(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const v = raw.trim();
  if (!HEX.test(v)) return fallback;
  return v.toLowerCase();
}

function normalizeHeaderMode(raw: unknown): FaturaHeaderMode {
  return raw === "solid" ? "solid" : "gradient";
}

export function parseFaturaTemplateCores(metadata: unknown): FaturaTemplateCores {
  const meta = (metadata ?? {}) as {
    faturacao?: { templateCores?: Partial<FaturaTemplateCores> | null };
  };
  const raw = meta.faturacao?.templateCores ?? {};
  return {
    headerMode: normalizeHeaderMode(raw.headerMode),
    headerFrom: normalizeHex(raw.headerFrom, FATURA_TEMPLATE_CORES_DEFAULT.headerFrom),
    headerVia: normalizeHex(raw.headerVia, FATURA_TEMPLATE_CORES_DEFAULT.headerVia),
    headerTo: normalizeHex(raw.headerTo, FATURA_TEMPLATE_CORES_DEFAULT.headerTo),
    accent: normalizeHex(raw.accent, FATURA_TEMPLATE_CORES_DEFAULT.accent),
    surface: normalizeHex(raw.surface, FATURA_TEMPLATE_CORES_DEFAULT.surface),
    border: normalizeHex(raw.border, FATURA_TEMPLATE_CORES_DEFAULT.border),
  };
}

export function mergeFaturaTemplateCoresMetadata(
  metadata: unknown,
  patch: Partial<FaturaTemplateCores> | null | undefined,
): Record<string, unknown> {
  const meta = { ...((metadata ?? {}) as Record<string, unknown>) };
  const prevFaturacao =
    meta.faturacao && typeof meta.faturacao === "object" && !Array.isArray(meta.faturacao)
      ? (meta.faturacao as Record<string, unknown>)
      : {};
  const faturacao = { ...prevFaturacao };
  if (patch == null) {
    delete faturacao.templateCores;
  } else {
    // class-transformer / DTO instances → plain JSON serializável
    const plain = JSON.parse(JSON.stringify(patch)) as Partial<FaturaTemplateCores>;
    const current = parseFaturaTemplateCores(metadata);
    faturacao.templateCores = {
      headerMode: normalizeHeaderMode(
        plain.headerMode !== undefined ? plain.headerMode : current.headerMode,
      ),
      headerFrom: normalizeHex(plain.headerFrom, current.headerFrom),
      headerVia: normalizeHex(plain.headerVia, current.headerVia),
      headerTo: normalizeHex(plain.headerTo, current.headerTo),
      accent: normalizeHex(plain.accent, current.accent),
      surface: normalizeHex(plain.surface, current.surface),
      border: normalizeHex(plain.border, current.border),
    };
  }
  meta.faturacao = faturacao;
  return meta;
}

/** Fundo do hero: cor sólida ou gradiente conforme `headerMode`. */
export function faturaHeaderBackground(cores: FaturaTemplateCores): string {
  if (cores.headerMode === "solid") {
    return cores.headerFrom;
  }
  return `linear-gradient(135deg, ${cores.headerFrom} 0%, ${cores.headerVia} 45%, ${cores.headerTo} 100%)`;
}

/** @deprecated usar faturaHeaderBackground */
export function faturaHeaderGradient(cores: FaturaTemplateCores): string {
  return faturaHeaderBackground({ ...cores, headerMode: "gradient" });
}
