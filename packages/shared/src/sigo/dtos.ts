/** Códigos oficiais SIGO para tipo de documento de identificação. */
export type SigoTipoDocumento = "CC" | "PAS" | "BI";

export const SIGO_TIPOS_DOCUMENTO: readonly SigoTipoDocumento[] = ["CC", "PAS", "BI"] as const;

/** DTO estrito para registo de formando no SIGO (payload SOAP). */
export interface FormandoSigoDTO {
  TipoDocumento: SigoTipoDocumento;
  NumeroDocumento: string;
  NIF: string;
  DataNascimento: string;
  Nome: string;
  Nacionalidade: string;
  HabilitacoesLiterarias: number;
  MatriculaExterna?: string;
}

export interface AcaoSigoDTO {
  CodigoInterno: string;
  Titulo: string;
  Estado: string;
  DataInicio: string;
  DataFim: string;
}

export interface CursoSigoDTO {
  CodigoUFCD: string;
  Designacao: string;
  CargaHoras: number;
  Modalidade: string;
}

export interface EntidadeSigoDTO {
  NIF: string;
  Denominacao: string;
  CodigoEntidade?: string;
}

/** Payload completo para operação SubmeterAcao. */
export interface SubmeterAcaoSigoDTO {
  ReferenciaExterna: string;
  Entidade: EntidadeSigoDTO;
  Acao: AcaoSigoDTO;
  Curso: CursoSigoDTO;
  Formandos: FormandoSigoDTO[];
}

export interface ConsultarEstadoSigoDTO {
  ReferenciaExterna: string;
}

/** Resposta tipada (XML→JSON via módulo soap). */
export interface SigoSoapOperacaoResponse {
  TransacaoId?: string;
  CodigoResposta?: string;
  Mensagem?: string;
  Sucesso?: boolean | string;
}

export interface SigoAuthTokenResponse {
  token?: string;
  expiration?: string;
}

/** Alias legado NexiForma → código SIGO. */
export const SIGO_TIPO_DOC_ALIASES: Record<string, SigoTipoDocumento> = {
  C: "CC",
  CC: "CC",
  P: "PAS",
  PAS: "PAS",
  PASSAPORTE: "PAS",
  BI: "BI",
};

export function normalizarTipoDocumentoSigo(raw: string | undefined | null): SigoTipoDocumento | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toUpperCase();
  return SIGO_TIPO_DOC_ALIASES[key] ?? null;
}
