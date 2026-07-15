import type { SigoFormandoMetadata } from "./soap";

/** Extrai metadados SIGO de `FormandoProfile.metadata`. */
export function extrairSigoFormandoMetadata(metadata: unknown): SigoFormandoMetadata {
  if (!metadata || typeof metadata !== "object") return {};
  const root = metadata as Record<string, unknown>;
  const sigo = root.sigo;
  if (!sigo || typeof sigo !== "object") return {};
  const s = sigo as Record<string, unknown>;
  return {
    tipoDocIdentificacao:
      typeof s.tipoDocIdentificacao === "string" ? s.tipoDocIdentificacao : undefined,
    numDocIdentificacao:
      typeof s.numDocIdentificacao === "string" ? s.numDocIdentificacao : undefined,
    codPaisDocIdentificacao:
      typeof s.codPaisDocIdentificacao === "string" ? s.codPaisDocIdentificacao : undefined,
    dataNascimento: typeof s.dataNascimento === "string" ? s.dataNascimento : undefined,
    nacionalidade: typeof s.nacionalidade === "string" ? s.nacionalidade : undefined,
    habilitacaoLiteraria:
      typeof s.habilitacaoLiteraria === "string" ? s.habilitacaoLiteraria : undefined,
  };
}
