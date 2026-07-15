import { traduzirSigoSoapFault } from "@nexiforma/shared";

export type SigoSoapFault = {
  faultCode: string | null;
  faultString: string | null;
  mensagemUtilizador: string;
  detail: string | null;
};

export type SigoSoapParseResult = {
  sucesso: boolean;
  transacaoId: string | null;
  fault: SigoSoapFault | null;
  codigoResposta: string | null;
  mensagem: string | null;
  errosFormandos: Array<{ nif?: string; codigo: string; mensagem: string }>;
};

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "i");
  const m = xml.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]?.trim()) out.push(m[1].trim());
  }
  return out;
}

export function parseSigoSoapFault(xml: string): SigoSoapFault | null {
  const faultString = extractTag(xml, "faultstring") ?? extractTag(xml, "Reason");
  const faultCode = extractTag(xml, "faultcode") ?? extractTag(xml, "Code");
  if (!faultString && !faultCode) return null;
  return {
    faultCode,
    faultString,
    mensagemUtilizador: traduzirSigoSoapFault(faultCode, faultString),
    detail: extractTag(xml, "detail"),
  };
}

export function parseSigoSoapResponse(xml: string): SigoSoapParseResult {
  const trimmed = xml.trim();
  if (!trimmed) {
    return {
      sucesso: false,
      transacaoId: null,
      fault: {
        faultCode: "EMPTY",
        faultString: "Resposta vazia",
        mensagemUtilizador: "Resposta vazia do webservice SIGO.",
        detail: null,
      },
      codigoResposta: "EMPTY",
      mensagem: "Resposta vazia do webservice SIGO.",
      errosFormandos: [],
    };
  }

  const fault = parseSigoSoapFault(trimmed);
  if (fault) {
    const errosFormandos = extractErrosFormandos(trimmed, fault);
    return {
      sucesso: false,
      transacaoId: null,
      fault,
      codigoResposta: fault.faultCode,
      mensagem: fault.mensagemUtilizador,
      errosFormandos,
    };
  }

  const transacaoId =
    extractTag(trimmed, "TransacaoId") ??
    extractTag(trimmed, "transacaoId") ??
    extractTag(trimmed, "IdTransacao") ??
    extractTag(trimmed, "Referencia");

  const codigoResposta =
    extractTag(trimmed, "CodigoResposta") ??
    extractTag(trimmed, "ReturnCode") ??
    extractTag(trimmed, "codigo");

  const mensagem =
    extractTag(trimmed, "Mensagem") ??
    extractTag(trimmed, "ReturnMessage") ??
    extractTag(trimmed, "Descricao");

  const errosFormandos = extractErrosFormandos(trimmed, null);

  if (codigoResposta != null) {
    const ok = codigoResposta === "0" || codigoResposta.toUpperCase() === "OK";
    return {
      sucesso: ok && errosFormandos.length === 0,
      transacaoId,
      fault: null,
      codigoResposta,
      mensagem: mensagem ?? (ok ? "Submissão aceite pelo SIGO." : `SIGO rejeitou: ${codigoResposta}`),
      errosFormandos,
    };
  }

  if (/SubmeterAcaoResponse|RegistarMatriculaResponse|ConsultarEstadoResponse/i.test(trimmed)) {
    return {
      sucesso: errosFormandos.length === 0,
      transacaoId,
      fault: null,
      codigoResposta: "0",
      mensagem: mensagem ?? "Operação SOAP concluída.",
      errosFormandos,
    };
  }

  return {
    sucesso: false,
    transacaoId,
    fault: {
      faultCode: "PARSE",
      faultString: trimmed.slice(0, 300),
      mensagemUtilizador: "Resposta SOAP não reconhecida – verifique WSDL/namespace.",
      detail: null,
    },
    codigoResposta: "PARSE",
    mensagem: "Resposta SOAP não reconhecida.",
    errosFormandos,
  };
}

function extractErrosFormandos(
  xml: string,
  fault: SigoSoapFault | null,
): Array<{ nif?: string; codigo: string; mensagem: string }> {
  const blocos = extractAllTags(xml, "ErroFormando");
  const out: Array<{ nif?: string; codigo: string; mensagem: string }> = [];

  for (const bloco of blocos) {
    out.push({
      nif: extractTag(bloco, "NIF") ?? extractTag(bloco, "Nif") ?? undefined,
      codigo: extractTag(bloco, "Codigo") ?? "FORMANDO_ERRO",
      mensagem:
        extractTag(bloco, "Mensagem") ??
        extractTag(bloco, "Descricao") ??
        "Erro no formando.",
    });
  }

  if (!out.length && fault) {
    const nifs = extractAllTags(xml, "NIF");
    if (nifs.length === 1) {
      out.push({
        nif: nifs[0],
        codigo: fault.faultCode ?? "SOAP-FAULT",
        mensagem: fault.mensagemUtilizador,
      });
    }
  }

  return out;
}

/** Interpreta resultado JSON devolvido pelo módulo `soap` (XML→object). */
export function parseSigoSoapJsonResult(result: unknown): SigoSoapParseResult {
  if (!result || typeof result !== "object") {
    return {
      sucesso: false,
      transacaoId: null,
      fault: {
        faultCode: "EMPTY",
        faultString: "Resposta vazia",
        mensagemUtilizador: "Resposta SOAP vazia.",
        detail: null,
      },
      codigoResposta: "EMPTY",
      mensagem: "Resposta SOAP vazia.",
      errosFormandos: [],
    };
  }

  const o = result as Record<string, unknown>;
  const transacaoId =
    (typeof o.TransacaoId === "string" ? o.TransacaoId : null) ??
    (typeof o.transacaoId === "string" ? o.transacaoId : null);
  const codigoResposta =
    (typeof o.CodigoResposta === "string" ? o.CodigoResposta : null) ??
    (typeof o.ReturnCode === "string" ? o.ReturnCode : null);
  const mensagem =
    (typeof o.Mensagem === "string" ? o.Mensagem : null) ??
    (typeof o.ReturnMessage === "string" ? o.ReturnMessage : null);

  const codigo = codigoResposta ?? "0";
  const ok = codigo === "0" || codigo.toUpperCase() === "OK" || o.Sucesso === true || o.Sucesso === "true";

  return {
    sucesso: ok,
    transacaoId,
    fault: null,
    codigoResposta: codigo,
    mensagem: mensagem ?? (ok ? "Operação SOAP concluída." : `SIGO: ${codigo}`),
    errosFormandos: [],
  };
}
