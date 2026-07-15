import type { SubmeterAcaoSigoDTO, ConsultarEstadoSigoDTO } from "@nexiforma/shared";
import { SIGO_SOAP_ENVELOPE_NS, SIGO_SOAP_NAMESPACE_DEFAULT } from "./sigo-soap-constants";
import { buildSigoWsseSecurityHeader, type SigoWsseCredentials } from "./sigo-wsse.util";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function el(ns: string, tag: string, value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  return `<${ns}:${tag}>${escapeXml(String(value))}</${ns}:${tag}>`;
}

/** XML manual (fallback quando o módulo soap falha com XSD complexo). */
export function buildSigoSubmitSoapBodyFromDto(dto: SubmeterAcaoSigoDTO, namespace: string): string {
  const ns = "sig";
  const formandosXml = dto.Formandos.map(
    (f) => `<${ns}:Formando>
        ${el(ns, "TipoDocumento", f.TipoDocumento)}
        ${el(ns, "NumeroDocumento", f.NumeroDocumento)}
        ${el(ns, "NIF", f.NIF)}
        ${el(ns, "DataNascimento", f.DataNascimento)}
        ${el(ns, "Nome", f.Nome)}
        ${el(ns, "Nacionalidade", f.Nacionalidade)}
        ${el(ns, "HabilitacoesLiterarias", f.HabilitacoesLiterarias)}
        ${el(ns, "MatriculaExterna", f.MatriculaExterna)}
      </${ns}:Formando>`,
  ).join("");

  return `<${ns}:SubmeterAcao xmlns:${ns}="${namespace || SIGO_SOAP_NAMESPACE_DEFAULT}">
    ${el(ns, "ReferenciaExterna", dto.ReferenciaExterna)}
    <${ns}:Entidade>
      ${el(ns, "NIF", dto.Entidade.NIF)}
      ${el(ns, "Denominacao", dto.Entidade.Denominacao)}
      ${el(ns, "CodigoEntidade", dto.Entidade.CodigoEntidade)}
    </${ns}:Entidade>
    <${ns}:Acao>
      ${el(ns, "CodigoInterno", dto.Acao.CodigoInterno)}
      ${el(ns, "Titulo", dto.Acao.Titulo)}
      ${el(ns, "DataInicio", dto.Acao.DataInicio)}
      ${el(ns, "DataFim", dto.Acao.DataFim)}
      ${el(ns, "Estado", dto.Acao.Estado)}
    </${ns}:Acao>
    <${ns}:Curso>
      ${el(ns, "CodigoUFCD", dto.Curso.CodigoUFCD)}
      ${el(ns, "Designacao", dto.Curso.Designacao)}
      ${el(ns, "CargaHoras", dto.Curso.CargaHoras)}
      ${el(ns, "Modalidade", dto.Curso.Modalidade)}
    </${ns}:Curso>
    <${ns}:Formandos>${formandosXml}</${ns}:Formandos>
  </${ns}:SubmeterAcao>`;
}

export function buildSigoConsultarEstadoSoapBodyFromDto(
  dto: ConsultarEstadoSigoDTO,
  namespace: string,
): string {
  const ns = "sig";
  return `<${ns}:ConsultarEstado xmlns:${ns}="${namespace || SIGO_SOAP_NAMESPACE_DEFAULT}">
    ${el(ns, "ReferenciaExterna", dto.ReferenciaExterna)}
  </${ns}:ConsultarEstado>`;
}

export function buildSigoSoapEnvelope(creds: SigoWsseCredentials, bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SIGO_SOAP_ENVELOPE_NS}">
  <soap:Header>
    ${buildSigoWsseSecurityHeader(creds)}
  </soap:Header>
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;
}
