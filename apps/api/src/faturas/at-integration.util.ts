import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { resolveProjectPath } from "../config/env-paths";
import { AT_FATURAS_ENDPOINTS } from "./at-faturas-constants";
import { AT_SERIES_ENDPOINTS } from "./at-series-constants";
import { loadAtTlsMaterial, type AtTlsConfig } from "./at-faturas-http.util";
import { inspectAtPfxClientCert } from "./at-pfx-loader.util";

export type AtIntegrationMode = "disabled" | "sandbox" | "production";

/** Modo sandbox: simulação local (sem HTTP à AT). Activar com AT_*_SANDBOX_MOCK=1. */
export function isAtSandboxMock(config: ConfigService, prefix: "AT_FATURAS" | "AT_SERIES"): boolean {
  return config.get<string>(`${prefix}_SANDBOX_MOCK`) === "1";
}

export function readAtMode(config: ConfigService, envKey: string): AtIntegrationMode {
  const raw = (config.get<string>(envKey) ?? "disabled").toLowerCase();
  if (raw === "production") return "production";
  if (raw === "sandbox") return "sandbox";
  return "disabled";
}

export function resolveAtFaturasEndpoint(config: ConfigService, mode: AtIntegrationMode): string {
  const custom = config.get<string>("AT_FATURAS_ENDPOINT")?.trim();
  if (custom) return custom;
  return mode === "sandbox" ? AT_FATURAS_ENDPOINTS.sandbox : AT_FATURAS_ENDPOINTS.production;
}

export function resolveAtSeriesEndpoint(config: ConfigService, mode: AtIntegrationMode): string {
  const custom = config.get<string>("AT_SERIES_ENDPOINT")?.trim();
  if (custom) return custom;
  return mode === "sandbox" ? AT_SERIES_ENDPOINTS.sandbox : AT_SERIES_ENDPOINTS.production;
}

export function loadAtTlsFromConfig(config: ConfigService): ReturnType<typeof loadAtTlsMaterial> {
  return loadAtTlsMaterial(buildAtTlsConfig(config));
}

export function buildAtTlsConfig(config: ConfigService): AtTlsConfig {
  return {
    pemPath: resolveProjectPath(config.get<string>("AT_FATURAS_CLIENT_CERT_PEM_PATH")),
    pfxPath: resolveProjectPath(config.get<string>("AT_FATURAS_CLIENT_CERT_PFX_PATH")),
    pfxPassphrase: config.get<string>("AT_FATURAS_CLIENT_CERT_PASSPHRASE"),
    certPath: resolveProjectPath(config.get<string>("AT_FATURAS_CLIENT_CERT_PATH")),
    keyPath: resolveProjectPath(config.get<string>("AT_FATURAS_CLIENT_KEY_PATH")),
    caPath: resolveProjectPath(config.get<string>("AT_FATURAS_CA_PATH")),
  };
}

/** Converte ChavePublicaAT.cer (DER) para PEM SPKI – WS-Security AT. */
export function cerPublicKeyToPem(cerPath: string): string {
  const der = readFileSync(cerPath);
  const cert = new X509Certificate(der);
  return cert.publicKey.export({ type: "spki", format: "pem" }) as string;
}

export function loadAtPublicKeyPem(config: ConfigService, cache: { value: string | null }): string {
  if (cache.value) return cache.value;
  const configured = config.get<string>("AT_FATURAS_PUBLIC_KEY_PATH")?.trim();
  if (!configured) {
    throw new ServiceUnavailableException(
      "AT_FATURAS_PUBLIC_KEY_PATH não configurado no servidor.",
    );
  }
  const pemPath = resolveProjectPath(configured);
  if (!pemPath) {
    throw new ServiceUnavailableException(
      "AT_FATURAS_PUBLIC_KEY_PATH não configurado no servidor.",
    );
  }
  try {
    const raw = readFileSync(pemPath, "utf8");
    if (raw.includes("BEGIN PUBLIC KEY") || raw.includes("BEGIN RSA PUBLIC KEY")) {
      cache.value = raw;
      return raw;
    }
    if (pemPath.toLowerCase().endsWith(".cer")) {
      cache.value = cerPublicKeyToPem(pemPath);
      return cache.value;
    }
    cache.value = raw;
    return raw;
  } catch {
    throw new ServiceUnavailableException(
      `Chave pública AT inacessível (${configured}). Verifique AT_FATURAS_PUBLIC_KEY_PATH.`,
    );
  }
}

const AT_CERTIFICADOS_ZIP_URL =
  "https://faturas.portaldasfinancas.gov.pt/factemipf_static/java/certificados.zip";

/** Mensagem amigável quando a ligação TLS à AT falha (certificado expirado, etc.). */
export function formatAtTlsConnectionError(
  config: ConfigService,
  endpoint: string,
  err: unknown,
): string {
  const msg = err instanceof Error ? err.message : "Erro de rede";
  const tlsCfg = buildAtTlsConfig(config);
  let hint = "";

  if (tlsCfg.pfxPath) {
    const info = inspectAtPfxClientCert(tlsCfg.pfxPath, tlsCfg.pfxPassphrase ?? "");
    if (info?.expired) {
      const expiry = info.notAfter.toISOString().slice(0, 10);
      hint =
        ` O certificado de cliente «${info.subject}» expirou em ${expiry}. ` +
        `Descarregue novamente certificados.zip da AT (${AT_CERTIFICADOS_ZIP_URL}), ` +
        `substitua TesteWebservices.pfx e ChavePublicaAT.cer em ./certs/ e reinicie a API.`;
    }
  }

  if (!hint && /decryption failed|bad record mac|certificate|ssl/i.test(msg)) {
    hint =
      ` Verifique TesteWebservices.pfx e a password (TESTEwebservice). ` +
      `Se o zip for antigo, descarregue certificados.zip actualizado da AT.`;
  }

  return `Falha na ligação ao webservice AT (${endpoint}): ${msg}.${hint}`;
}
