/**
 * Confirmação de NIF PT:
 * - particulares: algoritmo Portugal NIF (módulo 11)
 * - empresas: webservice NIF.PT
 */

export type ParsedVatInput = {
  countryCode: string;
  vatNumber: string;
};

/** Normaliza NIF PT (aceita prefixo PT e separadores). */
export function parseVatInput(
  rawVat: string,
  countryHint?: string | null,
): ParsedVatInput | null {
  const hint = (countryHint ?? "PT").trim().toUpperCase() || "PT";
  if (hint !== "PT") return null;

  let raw = rawVat.trim().toUpperCase().replace(/[\s.\-_/]/g, "");
  if (!raw) return null;
  if (raw.startsWith("PT")) raw = raw.slice(2);

  const vatNumber = raw.replace(/\D/g, "");
  if (!/^\d{9}$/.test(vatNumber)) return null;
  return { countryCode: "PT", vatNumber };
}

export function isPlaceholderViesField(value: string | null | undefined): boolean {
  if (value == null) return true;
  const t = value.trim();
  return !t || t === "---" || t === "-" || t === "N/A";
}

export function cleanViesText(value: string | null | undefined): string | null {
  if (isPlaceholderViesField(value)) return null;
  return value!
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

export type NifPtRecord = {
  nif?: number | string;
  title?: string;
  address?: string;
  pc4?: string;
  pc3?: string;
  city?: string;
  status?: string;
  place?: { address?: string; pc4?: string; pc3?: string; city?: string };
};

export type NifPtApiResponse = {
  result?: string;
  nif_validation?: boolean;
  is_nif?: boolean;
  records?: Record<string, NifPtRecord>;
  error?: string;
  message?: string;
};

export type ViesVerificacaoResult = {
  countryCode: string;
  vatNumber: string;
  formatoValido: boolean;
  /** Registo confirmado no NIF.PT (empresas); null se só checksum / indisponível. */
  validoRegisto: boolean | null;
  /** Alias legado (= validoRegisto). */
  validoVies: boolean | null;
  disponivel: boolean;
  nome: string | null;
  morada: string | null;
  requestDate: string | null;
  userError: string | null;
  mensagem: string;
  fonte: "portugal_nif" | "nif_pt" | null;
};

export function buildViesResult(params: {
  countryCode: string;
  vatNumber: string;
  formatoValido: boolean;
  disponivel: boolean;
  validoRegisto: boolean | null;
  nome?: string | null;
  morada?: string | null;
  requestDate?: string | null;
  userError?: string | null;
  mensagem?: string;
  fonte?: "portugal_nif" | "nif_pt" | null;
}): ViesVerificacaoResult {
  const {
    countryCode,
    vatNumber,
    formatoValido,
    disponivel,
    validoRegisto,
    nome = null,
    morada = null,
    requestDate = null,
    userError = null,
    fonte = null,
  } = params;

  let mensagem = params.mensagem;
  if (!mensagem) {
    if (!formatoValido) {
      mensagem = "NIF inválido (formato ou dígito de controlo Portugal NIF).";
    } else if (fonte === "portugal_nif") {
      mensagem = "NIF pessoal confirmado (algoritmo Portugal NIF).";
    } else if (!disponivel) {
      mensagem = "Não foi possível confirmar o NIF no NIF.PT. Tente novamente mais tarde.";
    } else if (validoRegisto === true) {
      mensagem = "NIF de empresa confirmado no NIF.PT.";
    } else {
      mensagem = "NIF de empresa não encontrado ou inválido no NIF.PT.";
    }
  }

  return {
    countryCode,
    vatNumber,
    formatoValido,
    validoRegisto,
    validoVies: validoRegisto,
    disponivel,
    nome: cleanViesText(nome),
    morada: cleanViesText(morada),
    requestDate: requestDate ?? null,
    userError,
    mensagem,
    fonte,
  };
}

export function formatNifPtMorada(rec: NifPtRecord): string | null {
  const place = rec.place;
  const address = place?.address || rec.address;
  const pc4 = place?.pc4 || rec.pc4;
  const pc3 = place?.pc3 || rec.pc3;
  const city = place?.city || rec.city;
  const parts = [
    address?.trim(),
    [pc4, pc3].filter(Boolean).join("-") || null,
    city?.trim(),
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : null;
}

export function mapNifPtResponse(
  vatNumber: string,
  formatoValido: boolean,
  body: NifPtApiResponse,
): ViesVerificacaoResult {
  const result = (body.result ?? "").toLowerCase();
  if (result && result !== "success") {
    const rawMsg = (body.message || body.error || "").trim();
    const rateLimited =
      /limit per minute|buy credits|rate.?limit|quota/i.test(rawMsg) ||
      result.includes("limit");
    return buildViesResult({
      countryCode: "PT",
      vatNumber,
      formatoValido,
      disponivel: false,
      validoRegisto: null,
      userError: rateLimited ? "RATE_LIMIT" : result.toUpperCase(),
      fonte: "nif_pt",
      mensagem: rateLimited
        ? "Limite de consultas ao NIF.PT atingido. Aguarde cerca de 1 minuto e tente novamente, ou contacte o administrador para renovar créditos."
        : rawMsg || "Serviço NIF.PT temporariamente indisponível ou sem créditos.",
    });
  }

  const records = body.records ?? {};
  const rec =
    records[vatNumber] ??
    Object.values(records).find((r) => String(r.nif ?? "") === vatNumber) ??
    Object.values(records)[0];

  const valid = body.nif_validation === true || body.is_nif === true;
  return buildViesResult({
    countryCode: "PT",
    vatNumber,
    formatoValido,
    disponivel: true,
    validoRegisto: valid,
    nome: rec?.title ?? null,
    morada: rec ? formatNifPtMorada(rec) : null,
    requestDate: new Date().toISOString(),
    fonte: "nif_pt",
  });
}

export function nifPtUrl(vatNumber: string, apiKey: string, baseUrl?: string): string {
  const base = (baseUrl ?? process.env.NIF_PT_BASE_URL ?? "https://www.nif.pt/").replace(/\?.*$/, "");
  const url = new URL(base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("json", "1");
  url.searchParams.set("q", vatNumber);
  url.searchParams.set("key", apiKey);
  return url.toString();
}

/** Pessoa (formando/formador) vs empresa (cliente). */
export type NifConfirmTipo = "pessoa" | "empresa";

/** NIF PT colectivo (empresa/organismo). */
export function isNifColetivoPt(vatNumber: string): boolean {
  const d = vatNumber.replace(/\D/g, "");
  return d.length === 9 && "56789".includes(d[0]!);
}

/**
 * Regras de confirmação:
 * - pessoa: Portugal NIF (checksum) obrigatório;
 * - empresa: Portugal NIF + confirmação NIF.PT.
 */
export function evaluateNifConfirmation(
  result: ViesVerificacaoResult,
  tipo: NifConfirmTipo,
): { ok: true } | { ok: false; mensagem: string } {
  if (!result.formatoValido) {
    return { ok: false, mensagem: result.mensagem };
  }
  if (tipo === "pessoa") {
    return { ok: true };
  }
  if (!result.disponivel) {
    return {
      ok: false,
      mensagem:
        result.mensagem ||
        "Não foi possível confirmar o NIF de empresa. Tente novamente dentro de momentos.",
    };
  }
  if (!result.validoRegisto) {
    return {
      ok: false,
      mensagem: "NIF de empresa não confirmado no registo fiscal.",
    };
  }
  return { ok: true };
}
