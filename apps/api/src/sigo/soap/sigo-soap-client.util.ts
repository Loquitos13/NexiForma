import https from "node:https";
import * as soap from "soap";
import { v4 as uuidv4 } from "uuid";
import type { SigoSoapOperacaoResponse } from "@nexiforma/shared";
import { formatWsSecurityCreated } from "./sigo-date.util";

const TLS_MIN = "TLSv1.2" as const;

export type SigoSoapClientConfig = {
  wsdlUrl: string;
  endpoint?: string | null;
  username: string;
  password: string;
  timeoutMs?: number;
};

export type SigoSoapClient = soap.Client & {
  lastRequest?: string;
  lastResponse?: string;
};

function httpsAgent(): https.Agent {
  return new https.Agent({
    minVersion: TLS_MIN,
    maxVersion: "TLSv1.3",
    rejectUnauthorized: true,
  });
}

function wsdlOptions(timeoutMs: number) {
  const agent = httpsAgent();
  return {
    timeout: timeoutMs,
    forever: true,
    rejectUnauthorized: true,
    agent,
    httpsAgent: agent,
    headers: { "User-Agent": "NexiForma-SIGO/1.0" },
  };
}

/** Cria cliente SOAP a partir do WSDL DGEEC com WS-Security UsernameToken. */
export async function createSigoSoapClient(config: SigoSoapClientConfig): Promise<SigoSoapClient> {
  const timeoutMs = config.timeoutMs ?? 30000;
  const client = (await soap.createClientAsync(config.wsdlUrl, {
    wsdl_options: wsdlOptions(timeoutMs),
    disableCache: true,
  })) as SigoSoapClient;

  const security = new soap.WSSecurity(config.username, config.password, {
    passwordType: "PasswordText",
    hasTimeStamp: true,
    hasNonce: true,
    mustUnderstand: true,
    actor: undefined,
  });

  client.setSecurity(security);

  if (config.endpoint?.trim()) {
    client.setEndpoint(config.endpoint.trim());
  }

  client.addSoapHeader(
    {
      MessageID: uuidv4(),
      Created: formatWsSecurityCreated(),
    },
    "",
    "nexi",
    "http://nexiforma.pt/sigo/headers",
  );

  return client;
}

export async function invokeSigoSoapMethod(
  client: SigoSoapClient,
  methodName: string,
  payload: unknown,
): Promise<[SigoSoapOperacaoResponse, string, unknown, string]> {
  const asyncName = methodName.endsWith("Async") ? methodName : `${methodName}Async`;
  const fn = (client as Record<string, unknown>)[asyncName];
  if (typeof fn !== "function") {
    throw new Error(`Método SOAP «${methodName}» não encontrado no WSDL.`);
  }
  return (fn as (arg: unknown) => Promise<[SigoSoapOperacaoResponse, string, unknown, string]>)(payload);
}

export function soapResponseToXml(lastResponse: string | undefined, result: unknown): string {
  if (typeof lastResponse === "string" && lastResponse.trim()) return lastResponse;
  if (typeof result === "string") return result;
  return JSON.stringify(result ?? {});
}
