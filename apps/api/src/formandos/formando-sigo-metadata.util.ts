import {
  extrairSigoFormandoMetadata,
  normalizarTipoDocumentoSigo,
  type SigoFormandoMetadata,
} from "@nexiforma/shared";
import type { SigoFormandoMetadataDto } from "./dto/sigo-formando-metadata.dto";

export function mergeFormandoMetadataSigo(
  existing: unknown,
  patch?: SigoFormandoMetadataDto | null,
): Record<string, unknown> | undefined {
  if (patch === undefined) return existing as Record<string, unknown> | undefined;

  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  if (patch === null) {
    const { sigo: _removed, ...rest } = base;
    return Object.keys(rest).length ? rest : undefined;
  }

  const cur = extrairSigoFormandoMetadata(base);
  const sigo: SigoFormandoMetadata = {
    ...(cur.tipoDocIdentificacao || patch.tipoDocIdentificacao
      ? {
          tipoDocIdentificacao:
            patch.tipoDocIdentificacao !== undefined
              ? patch.tipoDocIdentificacao
              : cur.tipoDocIdentificacao,
        }
      : {}),
    ...(patch.numDocIdentificacao !== undefined || cur.numDocIdentificacao
      ? { numDocIdentificacao: patch.numDocIdentificacao ?? cur.numDocIdentificacao }
      : {}),
    ...(patch.dataNascimento !== undefined || cur.dataNascimento
      ? { dataNascimento: patch.dataNascimento ?? cur.dataNascimento }
      : {}),
    ...(patch.nacionalidade !== undefined || cur.nacionalidade
      ? {
          nacionalidade: patch.nacionalidade?.trim().toUpperCase() ?? cur.nacionalidade,
        }
      : {}),
    ...(patch.habilitacaoLiteraria !== undefined || cur.habilitacaoLiteraria
      ? { habilitacaoLiteraria: patch.habilitacaoLiteraria ?? cur.habilitacaoLiteraria }
      : {}),
  };

  const cleaned = Object.fromEntries(
    Object.entries(sigo).filter(([, v]) => v != null && String(v).trim() !== ""),
  );

  if (!Object.keys(cleaned).length) {
    const { sigo: _s, ...rest } = base;
    return Object.keys(rest).length ? rest : undefined;
  }

  return { ...base, sigo: cleaned };
}

export function formandoSigoPronto(metadata: unknown): boolean {
  const s = extrairSigoFormandoMetadata(metadata);
  return Boolean(
    normalizarTipoDocumentoSigo(s.tipoDocIdentificacao) &&
      s.numDocIdentificacao?.trim() &&
      /^\d{4}-\d{2}-\d{2}$/.test(s.dataNascimento ?? "") &&
      /^[A-Z]{2}$/i.test(s.nacionalidade ?? "") &&
      s.habilitacaoLiteraria?.trim(),
  );
}

export function mapSigoMetadataPublic(metadata: unknown): SigoFormandoMetadata {
  return extrairSigoFormandoMetadata(metadata);
}

export function extractFormandoMorada(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = (metadata as Record<string, unknown>).morada;
  return typeof m === "string" && m.trim() ? m.trim() : null;
}

/** Guarda morada fiscal/contacto em `metadata.morada` (fora do bloco SIGO). */
export function mergeFormandoMetadataMorada(
  existing: unknown,
  morada: string | null | undefined,
): Record<string, unknown> | undefined {
  if (morada === undefined) return existing as Record<string, unknown> | undefined;

  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  const trimmed = morada?.trim() ?? "";
  if (!trimmed) {
    const { morada: _removed, ...rest } = base;
    return Object.keys(rest).length ? rest : undefined;
  }
  return { ...base, morada: trimmed };
}
