export type AvaliacaoTipoId = "continua" | "final" | "recuperacao";

export type AvaliacaoParametrosTenant = {
  version: 1;
  notaMinimaAprovacao: number;
  escalaMaxima: number;
  tiposPermitidos: AvaliacaoTipoId[];
  exigirObservacoesAbaixoMinima: boolean;
};

export const AVALIACAO_TIPO_OPTIONS: Array<{ id: AvaliacaoTipoId; label: string }> = [
  { id: "continua", label: "Contínua" },
  { id: "final", label: "Final" },
  { id: "recuperacao", label: "Recuperação" },
];

export const DEFAULT_AVALIACAO_PARAMETROS: AvaliacaoParametrosTenant = {
  version: 1,
  notaMinimaAprovacao: 50,
  escalaMaxima: 100,
  tiposPermitidos: ["continua", "final", "recuperacao"],
  exigirObservacoesAbaixoMinima: false,
};

const VALID_TIPOS = new Set<string>(AVALIACAO_TIPO_OPTIONS.map((t) => t.id));

export function normalizeAvaliacaoTipo(raw: string | undefined | null): AvaliacaoTipoId | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "continua" || t === "contínua") return "continua";
  if (t === "final") return "final";
  if (t === "recuperacao" || t === "recuperação") return "recuperacao";
  return VALID_TIPOS.has(t) ? (t as AvaliacaoTipoId) : null;
}

export function parseTenantAvaliacaoParametros(metadata: unknown): AvaliacaoParametrosTenant {
  const root = (metadata ?? {}) as { avaliacaoParametros?: Partial<AvaliacaoParametrosTenant> };
  const raw = root.avaliacaoParametros ?? {};
  const escalaMaxima =
    typeof raw.escalaMaxima === "number" && raw.escalaMaxima >= 1 && raw.escalaMaxima <= 100
      ? Math.round(raw.escalaMaxima)
      : DEFAULT_AVALIACAO_PARAMETROS.escalaMaxima;
  const notaMinimaAprovacao =
    typeof raw.notaMinimaAprovacao === "number" &&
    raw.notaMinimaAprovacao >= 0 &&
    raw.notaMinimaAprovacao <= escalaMaxima
      ? Math.round(raw.notaMinimaAprovacao)
      : DEFAULT_AVALIACAO_PARAMETROS.notaMinimaAprovacao;
  const tiposPermitidos = Array.isArray(raw.tiposPermitidos)
    ? raw.tiposPermitidos
        .map((x) => normalizeAvaliacaoTipo(String(x)))
        .filter((x): x is AvaliacaoTipoId => x != null)
    : [...DEFAULT_AVALIACAO_PARAMETROS.tiposPermitidos];
  return {
    version: 1,
    notaMinimaAprovacao,
    escalaMaxima,
    tiposPermitidos: tiposPermitidos.length ? tiposPermitidos : [...DEFAULT_AVALIACAO_PARAMETROS.tiposPermitidos],
    exigirObservacoesAbaixoMinima: raw.exigirObservacoesAbaixoMinima === true,
  };
}

export function mergeTenantAvaliacaoParametros(
  metadata: unknown,
  patch: Partial<AvaliacaoParametrosTenant>,
): Record<string, unknown> {
  const base = (metadata ?? {}) as Record<string, unknown>;
  const current = parseTenantAvaliacaoParametros(metadata);
  const merged = parseTenantAvaliacaoParametros({
    ...base,
    avaliacaoParametros: { ...current, ...patch, version: 1 },
  });
  return { ...base, avaliacaoParametros: merged };
}
