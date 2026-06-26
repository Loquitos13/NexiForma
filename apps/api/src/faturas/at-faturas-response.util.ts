import { AT_RETURN_CODE_MESSAGES } from "./at-faturas-constants";

export type AtFaturasParseResult = {
  sucesso: boolean;
  codigoResposta: string | null;
  mensagemAt: string | null;
};

/** Interpreta resposta SOAP/XML do webservice AT (RegisterInvoiceResponse). */
export function parseAtFaturasSoapResponse(xml: string): AtFaturasParseResult {
  const trimmed = xml.trim();
  if (!trimmed) {
    return { sucesso: false, codigoResposta: "EMPTY", mensagemAt: "Resposta vazia do webservice AT." };
  }

  const fault = extractTag(trimmed, "faultstring") ?? extractTag(trimmed, "Fault");
  if (fault) {
    const code = extractTag(trimmed, "faultcode") ?? "SOAP-FAULT";
    return { sucesso: false, codigoResposta: code, mensagemAt: fault };
  }

  const returnCode =
    extractTag(trimmed, "ReturnCode") ??
    extractTag(trimmed, "CodigoResposta") ??
    extractTag(trimmed, "codigoResposta") ??
    extractTag(trimmed, "Codigo");

  const returnMessage =
    extractTag(trimmed, "ReturnMessage") ??
    extractTag(trimmed, "Mensagem") ??
    extractTag(trimmed, "mensagem") ??
    extractTag(trimmed, "Descricao");

  if (returnCode != null) {
    const code = returnCode.trim();
    const ok = code === "0" || code.toUpperCase() === "OK";
    const fallback = AT_RETURN_CODE_MESSAGES[code];
    return {
      sucesso: ok,
      codigoResposta: code,
      mensagemAt: returnMessage ?? fallback ?? (ok ? "Documento registado." : `Código AT: ${code}`),
    };
  }

  const sucessoExplicit = extractTag(trimmed, "Sucesso") ?? extractTag(trimmed, "sucesso");
  if (sucessoExplicit) {
    const ok = sucessoExplicit.toLowerCase() === "true" || sucessoExplicit === "1";
    return {
      sucesso: ok,
      codigoResposta: ok ? "0" : "ERRO",
      mensagemAt: returnMessage ?? (ok ? "Documento registado." : "Registo rejeitado."),
    };
  }

  if (/RegisterInvoiceResponse|DocumentoRegistado|RegistarDocumentoComercialResponse/i.test(trimmed)) {
    return {
      sucesso: true,
      codigoResposta: "0",
      mensagemAt: returnMessage ?? "Documento registado com sucesso.",
    };
  }

  return {
    sucesso: false,
    codigoResposta: "PARSE-ERROR",
    mensagemAt: "Não foi possível interpretar a resposta do webservice AT.",
  };
}

export function buildMockAtSuccessResponse(codigo = "0"): string {
  return `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RegisterInvoiceResponse xmlns="https://servicos.portaldasfinancas.gov.pt/faturas/">
      <ReturnCode>${codigo}</ReturnCode>
      <ReturnMessage>Documento comunicado (simulação local).</ReturnMessage>
    </RegisterInvoiceResponse>
  </soap:Body>
</soap:Envelope>`;
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([^<]*)</(?:[\\w-]+:)?${tag}>`, "i");
  const m = xml.match(re);
  return m?.[1]?.trim() || null;
}
