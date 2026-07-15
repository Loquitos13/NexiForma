export {
  parseSigoCertificadosList,
  normalizeSigoNif,
  type SigoCertificadoRemoto,
  type SigoCertificadoSyncResumo,
} from "./certificates";

export {
  SIGO_EXPORT_SCHEMA,
  DGEEC_SUBMISSAO_SCHEMA,
  mapNexiformaToDgeecPayload,
  buildSigoSubmitHttpBody,
  type NexiformaSigoExportBody,
  type DgeecSigoSubmissaoPayload,
  type SigoSubmitPayloadFormat,
} from "./dgeec-payload";

export {
  SIGO_TIPOS_DOCUMENTO,
  SIGO_TIPO_DOC_ALIASES,
  normalizarTipoDocumentoSigo,
  type SigoTipoDocumento,
  type FormandoSigoDTO,
  type AcaoSigoDTO,
  type CursoSigoDTO,
  type EntidadeSigoDTO,
  type SubmeterAcaoSigoDTO,
  type ConsultarEstadoSigoDTO,
  type SigoSoapOperacaoResponse,
  type SigoAuthTokenResponse,
} from "./dtos";

export {
  SIGO_PORTAIS_URL,
  SIGO_ESTADOS_ACAO,
  SIGO_TIPOS_DOC_IDENTIFICACAO,
  SIGO_HABILITACOES_CNQ,
  SIGO_SOAP_FAULT_MESSAGES,
  mapAcaoEstadoToSigo,
  traduzirSigoSoapFault,
  type SigoRegiaoPortal,
  type SigoEstadoAcao,
  type SigoFormandoMetadata,
  type SigoProtocolo,
} from "./soap";

export { extrairSigoFormandoMetadata } from "./formando-meta";

export {
  SIGO_PERFIS_PADRAO,
  SIGO_ACOES_ACESSO,
  SIGO_ACAO_LABELS,
  normalizarPerfisAcesso,
  podeExecutarAcaoSigo,
  avaliarProntidaoSigoTenant,
  labelSigoRole,
  type SigoAcaoAcesso,
  type SigoPerfisAcesso,
  type SigoConfigPublica,
} from "./access-profiles";
