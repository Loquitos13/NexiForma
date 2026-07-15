export type SigoCertificadoRemoto = {
  referencia: string;
  nif: string | null;
  nome: string | null;
  matriculaId: string | null;
  numeroCertificado: string | null;
  estado: "DISPONIVEL" | "PENDENTE" | "INDISPONIVEL";
  emitidoEm: string | null;
  downloadPath: string | null;
};

export type SigoCertificadoSyncResumo = {
  submissaoId: string;
  acaoFormacaoId: string;
  referenceId: string;
  totalRemotos: number;
  associados: number;
  disponiveis: number;
  transferidos: number;
  pendentes: number;
  erros: number;
  certificados: Array<{
    id: string;
    matriculaId: string;
    formandoNome: string;
    nif: string | null;
    estado: string;
    numeroCertificado: string | null;
    emitidoEm: string | null;
    sincronizadoEm: string | null;
    temFicheiro: boolean;
  }>;
};

function normalizeNif(value: unknown): string | null {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
}

function parseEstadoCertificado(raw: string): SigoCertificadoRemoto["estado"] {
  const u = raw.toUpperCase();
  if (
    u.includes("DISP") ||
    u.includes("EMIT") ||
    u.includes("OK") ||
    u.includes("AVAILABLE") ||
    u.includes("CERTIFIC")
  ) {
    return "DISPONIVEL";
  }
  if (u.includes("PEND") || u.includes("PROCESS") || u.includes("WAIT")) {
    return "PENDENTE";
  }
  return "INDISPONIVEL";
}

function readCertificadoItem(item: Record<string, unknown>): SigoCertificadoRemoto | null {
  const referencia = String(
    item.id ?? item.referencia ?? item.referenceId ?? item.certificadoId ?? item.codigo ?? "",
  ).trim();
  if (!referencia) return null;

  const estadoRaw = String(
    item.estado ?? item.status ?? item.situacao ?? item.state ?? "PENDENTE",
  );

  const downloadPath =
    item.downloadUrl != null
      ? String(item.downloadUrl)
      : item.downloadPath != null
        ? String(item.downloadPath)
        : item.url != null
          ? String(item.url)
          : item.pdfUrl != null
            ? String(item.pdfUrl)
            : null;

  const emitidoRaw = item.emitidoEm ?? item.dataEmissao ?? item.emissao ?? item.issuedAt ?? null;

  const matriculaRaw =
    item.matriculaId ?? item.matriculaExternaId ?? item.idMatricula ?? item.externalMatriculaId ?? null;

  return {
    referencia,
    nif: normalizeNif(item.nif ?? item.nifFormando ?? item.contribuinte),
    nome: item.nome != null ? String(item.nome) : item.nomeFormando != null ? String(item.nomeFormando) : null,
    matriculaId: matriculaRaw != null ? String(matriculaRaw).trim() || null : null,
    numeroCertificado:
      item.numeroCertificado != null
        ? String(item.numeroCertificado)
        : item.numero != null
          ? String(item.numero)
          : item.numeroCertificacao != null
            ? String(item.numeroCertificacao)
            : null,
    estado: parseEstadoCertificado(estadoRaw),
    emitidoEm: emitidoRaw != null ? String(emitidoRaw) : null,
    downloadPath,
  };
}

/** Interpreta listagem genérica de certificados SIGO (contrato configurável). */
export function parseSigoCertificadosList(json: unknown): SigoCertificadoRemoto[] {
  if (!json) return [];

  if (Array.isArray(json)) {
    return json
      .map((row) => (row && typeof row === "object" ? readCertificadoItem(row as Record<string, unknown>) : null))
      .filter((row): row is SigoCertificadoRemoto => row != null);
  }

  if (typeof json !== "object") return [];

  const o = json as Record<string, unknown>;
  const listRaw = o.certificados ?? o.items ?? o.data ?? o.formandos ?? o.results;
  if (!Array.isArray(listRaw)) return [];

  return listRaw
    .map((row) => (row && typeof row === "object" ? readCertificadoItem(row as Record<string, unknown>) : null))
    .filter((row): row is SigoCertificadoRemoto => row != null);
}

export { normalizeNif as normalizeSigoNif };
