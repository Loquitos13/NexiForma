import { createHash } from "node:crypto";

import {

  BadRequestException,

  Injectable,

  ServiceUnavailableException,

} from "@nestjs/common";

import { ConfigService } from "@nestjs/config";

import { AT_SERIES_SOAP_ACTION } from "./at-series-constants";

import { formatarUsernameWfa } from "./at-faturas-credentials.util";

import { postAtSoapRequest } from "./at-faturas-http.util";

import {

  isAtSandboxMock,

  loadAtPublicKeyPem,

  loadAtTlsFromConfig,

  readAtMode,

  resolveAtSeriesEndpoint,

  formatAtTlsConnectionError,

  type AtIntegrationMode,

} from "./at-integration.util";

import { buildAtSecurityHeaderFields } from "./at-faturas-security.util";

import type { AtWfaCredenciais } from "./at-faturas-integration.service";

import {

  buildAnularSerieSoapEnvelope,

  buildFinalizarSerieSoapEnvelope,

  buildRegistarSerieSoapEnvelope,

  hashAtSeriePayload,

  type AtSerieDocumentoInput,

} from "./at-series-payload.util";

import {

  buildMockSeriesSuccessResponse,

  parseAtSeriesSoapResponse,

  type AtSeriesParseResult,

} from "./at-series-response.util";



export type AtSeriesMode = AtIntegrationMode;



export type AtSeriesRegistoResult = AtSeriesParseResult & {

  mode: AtSeriesMode;

  payloadHash: string;

};



@Injectable()

export class AtSeriesIntegrationService {

  private publicKeyCache = { value: null as string | null };



  constructor(private readonly config: ConfigService) {}



  getPublicConfig() {

    const mode = this.mode();

    const mock = mode === "sandbox" && isAtSandboxMock(this.config, "AT_SERIES");

    return {

      mode,

      configured: mode !== "disabled",

      endpoint: mode === "disabled" ? null : resolveAtSeriesEndpoint(this.config, mode),

      sandboxSimulado: mock,

      sandboxReal: mode === "sandbox" && !mock,

    };

  }



  async registarSerie(

    input: AtSerieDocumentoInput,

    credenciais: AtWfaCredenciais,

  ): Promise<AtSeriesRegistoResult> {

    const mode = this.mode();

    const payloadHash = hashAtSeriePayload(input);



    if (mode === "disabled") {

      throw new ServiceUnavailableException(

        "Comunicação de séries AT desactivada - configure AT_SERIES_MODE=sandbox ou production.",

      );

    }



    if (mode === "sandbox" && isAtSandboxMock(this.config, "AT_SERIES")) {

      return this.simularSandbox(input, payloadHash, credenciais);

    }



    this.assertCredenciais(credenciais);

    return this.enviarSoap(

      buildRegistarSerieSoapEnvelope(this.buildSecurity(credenciais), input),

      payloadHash,

      mode,

    );

  }



  async finalizarSerie(

    input: {

      serie: string;

      tipoDocumento: string;

      numCertSWFatur: string;

      dataFimUtiliz: Date;

    },

    credenciais: AtWfaCredenciais,

  ): Promise<AtSeriesRegistoResult> {

    const mode = this.mode();

    const payloadHash = `${input.serie}|${input.tipoDocumento}|finalizar`;



    if (mode === "disabled") {

      throw new ServiceUnavailableException("Comunicação de séries AT desactivada.");

    }

    if (mode === "sandbox" && isAtSandboxMock(this.config, "AT_SERIES")) {

      const parsed = parseAtSeriesSoapResponse(buildMockSeriesSuccessResponse("AA000000"));

      return { ...parsed, mensagemAt: "Série finalizada (simulação local).", mode, payloadHash };

    }



    this.assertCredenciais(credenciais);

    return this.enviarSoap(

      buildFinalizarSerieSoapEnvelope(this.buildSecurity(credenciais), input),

      payloadHash,

      mode,

    );

  }



  async anularSerie(

    input: {

      serie: string;

      tipoDocumento: string;

      numCertSWFatur: string;

      motivo?: string;

    },

    credenciais: AtWfaCredenciais,

  ): Promise<AtSeriesRegistoResult> {

    const mode = this.mode();

    const payloadHash = `${input.serie}|${input.tipoDocumento}|anular`;



    if (mode === "disabled") {

      throw new ServiceUnavailableException("Comunicação de séries AT desactivada.");

    }

    if (mode === "sandbox" && isAtSandboxMock(this.config, "AT_SERIES")) {

      return {

        sucesso: true,

        codigoResposta: "0",

        mensagemAt: "Comunicação de série anulada (simulação local).",

        codigoValidacao: null,

        mode,

        payloadHash,

      };

    }



    this.assertCredenciais(credenciais);

    return this.enviarSoap(

      buildAnularSerieSoapEnvelope(this.buildSecurity(credenciais), input),

      payloadHash,

      mode,

    );

  }



  /** Código provisório sandbox mock (prefixo AA – FAQ AT). */

  gerarCodigoValidacaoSandbox(serie: string, tipo: string): string {

    const digest = createHash("sha256").update(`${serie}:${tipo}:sandbox-at`).digest();

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "AA";

    for (let i = 0; i < 6; i++) {

      code += chars[digest[i]! % chars.length];

    }

    return code;

  }



  private async enviarSoap(

    envelope: string,

    payloadHash: string,

    mode: AtSeriesMode,

  ): Promise<AtSeriesRegistoResult> {

    const endpoint = resolveAtSeriesEndpoint(this.config, mode);

    const timeoutMs = Number(this.config.get<string>("AT_SERIES_TIMEOUT_MS") ?? "30000");

    const tls = loadAtTlsFromConfig(this.config);

    if (!tls) {

      throw new ServiceUnavailableException(

        "Certificado SSL AT em falta - configure AT_FATURAS_CLIENT_CERT_PFX_PATH (TesteWebservices.pfx em sandbox).",

      );

    }



    try {

      const res = await postAtSoapRequest(endpoint, AT_SERIES_SOAP_ACTION, envelope, {

        timeoutMs,

        tls,

      });

      const parsed = parseAtSeriesSoapResponse(res.body);

      if (res.statusCode < 200 || res.statusCode >= 300) {

        return {

          ...parsed,

          sucesso: false,

          codigoResposta: parsed.codigoResposta ?? `HTTP-${res.statusCode}`,

          mensagemAt: parsed.mensagemAt ?? `Erro HTTP ${res.statusCode} na comunicação de séries AT.`,

          mode,

          payloadHash,

        };

      }

      return { ...parsed, mode, payloadHash };

    } catch (err) {

      return {

        sucesso: false,

        codigoResposta: "NETWORK",

        mensagemAt: formatAtTlsConnectionError(this.config, endpoint, err).replace(
          "webservice AT",
          "webservice de séries AT",
        ),

        codigoValidacao: null,

        mode,

        payloadHash,

      };

    }

  }



  private simularSandbox(

    input: AtSerieDocumentoInput,

    payloadHash: string,

    credenciais: AtWfaCredenciais,

  ): AtSeriesRegistoResult {

    if (this.config.get<string>("AT_SERIES_SANDBOX_FAIL") === "1") {

      return {

        sucesso: false,

        codigoResposta: "-1",

        mensagemAt: "Simulação sandbox mock: falha no registo de série.",

        codigoValidacao: null,

        mode: "sandbox",

        payloadHash,

      };

    }



    if (!/^\d{9}$/.test(credenciais.nifEmitente.replace(/\s/g, ""))) {

      return {

        sucesso: false,

        codigoResposta: "-1",

        mensagemAt: "NIF emitente inválido para teste sandbox.",

        codigoValidacao: null,

        mode: "sandbox",

        payloadHash,

      };

    }



    const codigo = this.gerarCodigoValidacaoSandbox(input.serie, input.tipoDocumento);

    const parsed = parseAtSeriesSoapResponse(buildMockSeriesSuccessResponse(codigo));

    return {

      ...parsed,

      mensagemAt: `Série ${input.serie} registada em sandbox mock (código ${codigo}).`,

      mode: "sandbox",

      payloadHash,

    };

  }



  private buildSecurity(credenciais: AtWfaCredenciais) {

    const username = formatarUsernameWfa(credenciais.nifEmitente, credenciais.subutilizador);

    return buildAtSecurityHeaderFields(

      username,

      credenciais.password.trim(),

      loadAtPublicKeyPem(this.config, this.publicKeyCache),

    );

  }



  private assertCredenciais(credenciais: AtWfaCredenciais) {

    if (!credenciais.subutilizador?.trim()) {

      throw new BadRequestException(

        "Configure subutilizador WSE/WFA em Configuração → Faturação (perfil comunicação de séries).",

      );

    }

    if (!credenciais.password?.trim()) {

      throw new BadRequestException("Configure a password do subutilizador AT.");

    }

  }



  private mode(): AtSeriesMode {

    return readAtMode(this.config, "AT_SERIES_MODE");

  }

}


