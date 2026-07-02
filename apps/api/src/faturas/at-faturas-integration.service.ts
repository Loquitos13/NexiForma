import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AT_SOAP_ACTION_CHANGE_STATUS, AT_SOAP_ACTION_REGISTER } from "./at-faturas-constants";
import { formatarUsernameWfa } from "./at-faturas-credentials.util";
import { postAtSoapRequest } from "./at-faturas-http.util";
import {
  isAtSandboxMock,
  loadAtPublicKeyPem,
  loadAtTlsFromConfig,
  readAtMode,
  resolveAtFaturasEndpoint,
  formatAtTlsConnectionError,
  type AtIntegrationMode,
} from "./at-integration.util";
import type { AtFaturaDocumentoInput, AtInvoiceStatus } from "./at-faturas-payload.util";
import {
  buildChangeInvoiceStatusSoapEnvelope,
  buildRegisterInvoiceSoapEnvelope,
  hashAtFaturaPayload,
} from "./at-faturas-payload.util";
import {
  buildMockAtSuccessResponse,
  parseAtFaturasSoapResponse,
  type AtFaturasParseResult,
} from "./at-faturas-response.util";
import { buildAtSecurityHeaderFields } from "./at-faturas-security.util";

export type AtFaturasMode = AtIntegrationMode;

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
  private publicKeyCache = { value: null as string | null };

  constructor(private readonly config: ConfigService) {}

  getPublicConfig() {
    const mode = this.mode();
    const mock = mode === "sandbox" && isAtSandboxMock(this.config, "AT_FATURAS");
    return {
      mode,
      configured: mode === "production" || mode === "sandbox",
      endpoint: mode === "disabled" ? null : resolveAtFaturasEndpoint(this.config, mode),
      softwareCertificado: this.config.get<string>("AT_SOFTWARE_CERT_NUMBER") ?? null,
      sandboxSimulado: mock,
      sandboxReal: mode === "sandbox" && !mock,
    };
  }

  async registarDocumento(
    documento: AtFaturaDocumentoInput,
    credenciais: AtWfaCredenciais,
  ): Promise<AtFaturasRegistoResult> {
    const mode = this.mode();
    const payloadHash = hashAtFaturaPayload(documento);

    if (mode === "disabled") {
      throw new ServiceUnavailableException(
        "Comunicação AT desactivada - configure AT_FATURAS_MODE=sandbox ou production.",
      );
    }

    if (mode === "sandbox" && isAtSandboxMock(this.config, "AT_FATURAS")) {
      return this.simularSandbox(payloadHash, credenciais);
    }

    this.assertCredenciais(credenciais);
    return this.enviarRegisto(documento, credenciais, mode, payloadHash);
  }

  async alterarEstadoDocumento(
    documento: AtFaturaDocumentoInput,
    novoEstado: Exclude<AtInvoiceStatus, "N">,
    statusDate: Date,
    credenciais: AtWfaCredenciais,
  ): Promise<AtFaturasRegistoResult> {
    const mode = this.mode();
    const payloadHash = hashAtFaturaPayload({ ...documento, invoiceStatus: novoEstado });

    if (mode === "disabled") {
      throw new ServiceUnavailableException(
        "Comunicação AT desactivada - configure AT_FATURAS_MODE=sandbox ou production.",
      );
    }

    if (mode === "sandbox" && isAtSandboxMock(this.config, "AT_FATURAS")) {
      const parsed = parseAtFaturasSoapResponse(buildMockAtSuccessResponse("0"));
      return {
        ...parsed,
        mensagemAt: `Estado alterado para ${novoEstado} (simulação local).`,
        mode: "sandbox",
        payloadHash,
      };
    }

    this.assertCredenciais(credenciais);
    const endpoint = resolveAtFaturasEndpoint(this.config, mode);
    const envelope = buildChangeInvoiceStatusSoapEnvelope(
      this.buildSecurity(credenciais),
      documento,
      novoEstado,
      statusDate,
      this.buildVersionOpts(),
    );
    return this.postSoap(endpoint, AT_SOAP_ACTION_CHANGE_STATUS, envelope, mode, payloadHash);
  }

  async testarLigacao(credenciais: AtWfaCredenciais): Promise<AtFaturasRegistoResult> {
    const mode = this.mode();
    if (mode === "disabled") {
      throw new ServiceUnavailableException(
        "Integração AT desactivada - configure AT_FATURAS_MODE=sandbox ou production.",
      );
    }

    if (mode === "sandbox" && isAtSandboxMock(this.config, "AT_FATURAS")) {
      return this.simularSandbox("test-ligacao-at", credenciais, true);
    }

    this.assertCredenciais(credenciais);

    const docTeste: AtFaturaDocumentoInput = {
      nifEmitente: credenciais.nifEmitente,
      nifCliente: credenciais.nifEmitente,
      tipoDocumento: "FT",
      serie: "TEST",
      numero: 0,
      atcud: "SANDBOX-0",
      dataEmissao: new Date(),
      valorCentavos: 0,
      ivaCentavos: 0,
      moeda: "EUR",
      invoiceStatus: "N",
      linhas: [],
      softwareCertificado: this.config.get<string>("AT_SOFTWARE_CERT_NUMBER") ?? "9999",
    };

    return this.registarDocumento(docTeste, credenciais);
  }

  private async enviarRegisto(
    documento: AtFaturaDocumentoInput,
    credenciais: AtWfaCredenciais,
    mode: AtFaturasMode,
    payloadHash: string,
  ): Promise<AtFaturasRegistoResult> {
    const endpoint = resolveAtFaturasEndpoint(this.config, mode);
    const envelope = buildRegisterInvoiceSoapEnvelope(
      this.buildSecurity(credenciais),
      documento,
      this.buildVersionOpts(),
    );
    return this.postSoap(endpoint, AT_SOAP_ACTION_REGISTER, envelope, mode, payloadHash);
  }

  private async postSoap(
    endpoint: string,
    soapAction: string,
    envelope: string,
    mode: AtFaturasMode,
    payloadHash: string,
  ): Promise<AtFaturasRegistoResult> {
    const timeoutMs = Number(this.config.get<string>("AT_FATURAS_TIMEOUT_MS") ?? "30000");
    const tls = loadAtTlsFromConfig(this.config);
    if (!tls) {
      throw new ServiceUnavailableException(
        "Certificado SSL AT em falta - configure AT_FATURAS_CLIENT_CERT_PFX_PATH (TesteWebservices.pfx em sandbox).",
      );
    }

    try {
      const res = await postAtSoapRequest(endpoint, soapAction, envelope, { timeoutMs, tls });
      const parsed = parseAtFaturasSoapResponse(res.body);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return {
          sucesso: false,
          codigoResposta: parsed.codigoResposta ?? `HTTP-${res.statusCode}`,
          mensagemAt: parsed.mensagemAt ?? `Erro HTTP ${res.statusCode} na comunicação AT.`,
          mode,
          payloadHash,
        };
      }
      return { ...parsed, mode, payloadHash };
    } catch (err) {
      return {
        sucesso: false,
        codigoResposta: "NETWORK",
        mensagemAt: formatAtTlsConnectionError(this.config, endpoint, err),
        mode,
        payloadHash,
      };
    }
  }

  private buildSecurity(credenciais: AtWfaCredenciais) {
    const username = formatarUsernameWfa(credenciais.nifEmitente, credenciais.subutilizador);
    return buildAtSecurityHeaderFields(
      username,
      credenciais.password.trim(),
      loadAtPublicKeyPem(this.config, this.publicKeyCache),
    );
  }

  private simularSandbox(
    payloadHash: string,
    credenciais: AtWfaCredenciais,
    ligacao = false,
  ): AtFaturasRegistoResult {
    const failSim = this.config.get<string>("AT_FATURAS_SANDBOX_FAIL") === "1";
    const temSub = !!credenciais.subutilizador?.trim();
    const temPwd = !!credenciais.password?.trim();

    if (!temSub || !temPwd) {
      if (this.config.get<string>("AT_FATURAS_SANDBOX_REQUIRE_CREDS") === "1") {
        return {
          sucesso: false,
          codigoResposta: "SANDBOX-CREDS",
          mensagemAt:
            "Modo sandbox mock: configure subutilizador e password WFA para simular comunicação.",
          mode: "sandbox",
          payloadHash,
        };
      }
      const parsed = parseAtFaturasSoapResponse(buildMockAtSuccessResponse("0"));
      return {
        ...parsed,
        mensagemAt: ligacao
          ? "Ligação sandbox mock OK (simulação local, sem credenciais WFA)."
          : "Documento comunicado em sandbox mock (simulação local).",
        mode: "sandbox",
        payloadHash,
      };
    }

    if (!/^\d{9}$/.test(credenciais.nifEmitente.replace(/\s/g, ""))) {
      return {
        sucesso: false,
        codigoResposta: "3",
        mensagemAt: "NIF emitente inválido para teste sandbox.",
        mode: "sandbox",
        payloadHash,
      };
    }

    const codigo = failSim ? "-99" : "0";
    const parsed = parseAtFaturasSoapResponse(buildMockAtSuccessResponse(codigo));
    return {
      ...parsed,
      mensagemAt: ligacao
        ? `Ligação sandbox mock OK – credenciais WFA validadas (${formatarUsernameWfa(credenciais.nifEmitente, credenciais.subutilizador)}).`
        : parsed.mensagemAt,
      mode: "sandbox",
      payloadHash,
    };
  }

  private assertCredenciais(credenciais: AtWfaCredenciais) {
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
  }

  private mode(): AtFaturasMode {
    return readAtMode(this.config, "AT_FATURAS_MODE");
  }

  private buildVersionOpts() {
    return {
      eFaturaMDVersion: this.config.get<string>("AT_EFATURA_MD_VERSION") ?? undefined,
      auditFileVersion: this.config.get<string>("AT_AUDIT_FILE_VERSION") ?? undefined,
    };
  }
}
