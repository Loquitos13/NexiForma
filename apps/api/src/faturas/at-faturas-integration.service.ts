import { readFileSync } from "node:fs";
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AT_FATURAS_ENDPOINTS, AT_SOAP_ACTION_REGISTER } from "./at-faturas-constants";
import { formatarUsernameWfa } from "./at-faturas-credentials.util";
import { loadAtTlsMaterial, postAtSoapRequest } from "./at-faturas-http.util";
import type { AtFaturaDocumentoInput } from "./at-faturas-payload.util";
import {
  buildRegisterInvoiceSoapEnvelope,
  hashAtFaturaPayload,
} from "./at-faturas-payload.util";
import {
  parseAtFaturasSoapResponse,
  type AtFaturasParseResult,
} from "./at-faturas-response.util";
import { buildAtSecurityHeaderFields } from "./at-faturas-security.util";

export type AtFaturasMode = "disabled" | "production";

export type AtWfaCredenciais = {
  nifEmitente: string;
  subutilizador: string;
  password: string;
};

export type AtFaturasRegistoResult = AtFaturasParseResult & {
  mode: AtFaturasMode;
  payloadHash: string;
};

@Injectable()
export class AtFaturasIntegrationService {
  private publicKeyPem: string | null = null;

  constructor(private readonly config: ConfigService) {}

  getPublicConfig() {
    const mode = this.mode();
    return {
      mode,
      configured: mode === "production",
      endpoint: mode === "production" ? this.resolveEndpoint() : null,
      softwareCertificado: this.config.get<string>("AT_SOFTWARE_CERT_NUMBER") ?? null,
    };
  }

  async registarDocumento(
    documento: AtFaturaDocumentoInput,
    credenciais: AtWfaCredenciais,
  ): Promise<AtFaturasRegistoResult> {
    const mode = this.mode();
    const payloadHash = hashAtFaturaPayload(documento);

    if (mode !== "production") {
      throw new ServiceUnavailableException(
        "Comunicação AT desactivada - configure AT_FATURAS_MODE=production e credenciais.",
      );
    }

    if (!credenciais.subutilizador?.trim()) {
      throw new BadRequestException(
        "Configure o subutilizador AT (WFA) em Configuração → Faturação.",
      );
    }
    if (!credenciais.password?.trim()) {
      throw new BadRequestException(
        "Configure a password WFA em Configuração → Faturação.",
      );
    }

    const endpoint = this.resolveEndpoint();
    const username = formatarUsernameWfa(credenciais.nifEmitente, credenciais.subutilizador);
    const security = buildAtSecurityHeaderFields(
      username,
      credenciais.password.trim(),
      this.loadPublicKeyPem(),
    );
    const envelope = buildRegisterInvoiceSoapEnvelope(security, documento);
    const timeoutMs = Number(this.config.get<string>("AT_FATURAS_TIMEOUT_MS") ?? "30000");
    const tls = loadAtTlsMaterial({
      pfxPath: this.config.get<string>("AT_FATURAS_CLIENT_CERT_PFX_PATH"),
      pfxPassphrase: this.config.get<string>("AT_FATURAS_CLIENT_CERT_PASSPHRASE"),
      certPath: this.config.get<string>("AT_FATURAS_CLIENT_CERT_PATH"),
      keyPath: this.config.get<string>("AT_FATURAS_CLIENT_KEY_PATH"),
      caPath: this.config.get<string>("AT_FATURAS_CA_PATH"),
    });

    if (!tls) {
      throw new ServiceUnavailableException(
        "Certificado SSL AT (mTLS) em falta - configure AT_FATURAS_CLIENT_CERT_PFX_PATH.",
      );
    }

    let responseText: string;
    try {
      const res = await postAtSoapRequest(endpoint, AT_SOAP_ACTION_REGISTER, envelope, {
        timeoutMs,
        tls,
      });
      responseText = res.body;
      if (res.statusCode < 200 || res.statusCode >= 300) {
        const parsed = parseAtFaturasSoapResponse(responseText);
        return {
          sucesso: false,
          codigoResposta: parsed.codigoResposta ?? `HTTP-${res.statusCode}`,
          mensagemAt: parsed.mensagemAt ?? `Erro HTTP ${res.statusCode} na comunicação AT.`,
          mode,
          payloadHash,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de rede";
      return {
        sucesso: false,
        codigoResposta: "NETWORK",
        mensagemAt: `Falha na ligação ao webservice AT: ${msg}`,
        mode,
        payloadHash,
      };
    }

    const parsed = parseAtFaturasSoapResponse(responseText);
    return { ...parsed, mode, payloadHash };
  }

  private resolveEndpoint(): string {
    const custom = this.config.get<string>("AT_FATURAS_ENDPOINT")?.trim();
    return custom || AT_FATURAS_ENDPOINTS.production;
  }

  private loadPublicKeyPem(): string {
    if (this.publicKeyPem) return this.publicKeyPem;
    const path = this.config.get<string>("AT_FATURAS_PUBLIC_KEY_PATH")?.trim();
    if (!path) {
      throw new ServiceUnavailableException(
        "AT_FATURAS_PUBLIC_KEY_PATH não configurado (chave pública AT para WS-Security).",
      );
    }
    this.publicKeyPem = readFileSync(path, "utf8");
    return this.publicKeyPem;
  }

  private mode(): AtFaturasMode {
    const raw = (this.config.get<string>("AT_FATURAS_MODE") ?? "disabled").toLowerCase();
    if (raw === "production") return "production";
    return "disabled";
  }
}
