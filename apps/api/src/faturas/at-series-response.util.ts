import { AT_SERIES_RETURN_MESSAGES } from "./at-series-constants";

export type AtSeriesParseResult = {
  sucesso: boolean;
  codigoResposta: string | null;
  mensagemAt: string;
  codigoValidacao: string | null;
};

function extractTag(xml: string, tags: string[]): string | null {
  for (const tag of tags) {
    const re = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)</(?:\\w+:)?${tag}>`, "i");
    const m = xml.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

export function parseAtSeriesSoapResponse(xml: string): AtSeriesParseResult {
  const codigoResposta =
    extractTag(xml, [
      "codResultOper",
      "codigo",
      "codResultado",
      "returnCode",
      "CodResultOper",
    ]) ?? null;

  const mensagemRaw =
    extractTag(xml, [
      "msgResultOper",
      "mensagem",
      "msgResultado",
      "returnMessage",
      "MsgResultOper",
    ]) ?? null;

  const codigoValidacao =
    extractTag(xml, [
      "codValidacaoSerie",
      "codigoValidacaoSerie",
      "codValidacao",
      "codigoValidacao",
      "validationCode",
    ])?.toUpperCase() ?? null;

  const sucesso = codigoResposta === "0" || (!codigoResposta && !!codigoValidacao);
  const mensagemAt =
    mensagemRaw ??
    (codigoResposta && AT_SERIES_RETURN_MESSAGES[codigoResposta]
      ? AT_SERIES_RETURN_MESSAGES[codigoResposta]
      : sucesso
        ? "Operação de série concluída."
        : "Resposta AT de série não reconhecida.");

  return {
    sucesso,
    codigoResposta,
    mensagemAt,
    codigoValidacao: codigoValidacao && /^[A-Z0-9]{8}$/.test(codigoValidacao) ? codigoValidacao : null,
  };
}

export function buildMockSeriesSuccessResponse(codigoValidacao: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <registarSerieResponse xmlns="http://at.gov.pt/">
      <infoResultOper>
        <codResultOper>0</codResultOper>
        <msgResultOper>Série registada com sucesso.</msgResultOper>
      </infoResultOper>
      <infoSerie>
        <codValidacaoSerie>${codigoValidacao}</codValidacaoSerie>
      </infoSerie>
    </registarSerieResponse>
  </soap:Body>
</soap:Envelope>`;
}
