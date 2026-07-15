import {

  BadRequestException,

  Injectable,

  Logger,

  ServiceUnavailableException,

} from "@nestjs/common";

import { ConfigService } from "@nestjs/config";

import { createHash } from "crypto";

import type { ConsultarEstadoSigoDTO, NexiformaSigoExportBody, SubmeterAcaoSigoDTO } from "@nexiforma/shared";

import type { SigoSyncEstado } from "@nexiforma/database";

import { PrismaService } from "../prisma/prisma.service";

import type { ResolvedSigoRuntime } from "./sigo-tenant-config.service";

import {

  buildSigoConsultarEstadoSoapBodyFromDto,

  buildSigoSoapEnvelope,

  buildSigoSubmitSoapBodyFromDto,

} from "./soap/sigo-soap-envelope.util";

import { fetchSigoWsdl, postSigoSoapRequest } from "./soap/sigo-soap-http.util";

import { parseSigoSoapJsonResult, parseSigoSoapResponse } from "./soap/sigo-soap-fault.util";

import { SIGO_SOAP_NAMESPACE_DEFAULT } from "./soap/sigo-soap-constants";

import { mapConsultarEstadoDto, mapExportToSubmeterAcaoDto } from "./soap/sigo-dto.mapper";

import {

  createSigoSoapClient,

  invokeSigoSoapMethod,

  soapResponseToXml,

} from "./soap/sigo-soap-client.util";



export type SigoSoapSubmitInput = {

  tenantId: string;

  submissaoId: string;

  referenceId: string;

  pkg: NexiformaSigoExportBody;

};



@Injectable()

export class SigoSoapService {

  private readonly logger = new Logger(SigoSoapService.name);



  constructor(

    private readonly config: ConfigService,

    private readonly prisma: PrismaService,

  ) {}



  async testConnection(runtime: ResolvedSigoRuntime): Promise<{ ok: boolean; message: string }> {

    if (runtime.mode !== "soap") {

      return { ok: false, message: "Modo SOAP não activo." };

    }

    const timeoutMs = Math.min(this.timeoutMs(), 15000);



    if (runtime.wsdlUrl && runtime.soapUsername && runtime.soapPassword) {

      try {

        await createSigoSoapClient({

          wsdlUrl: runtime.wsdlUrl,

          endpoint: runtime.soapEndpoint,

          username: runtime.soapUsername,

          password: runtime.soapPassword,

          timeoutMs,

        });

        return { ok: true, message: "Cliente SOAP criado a partir do WSDL (TLS 1.2+, WS-Security)." };

      } catch (e) {

        this.logger.warn(`WSDL via módulo soap falhou: ${e instanceof Error ? e.message : String(e)}`);

      }

    }



    if (runtime.wsdlUrl) {

      try {

        const res = await fetchSigoWsdl(runtime.wsdlUrl, { timeoutMs });

        const ok = res.statusCode >= 200 && res.statusCode < 300 && /definitions|wsdl/i.test(res.body);

        return {

          ok,

          message: ok

            ? "WSDL SIGO obtido com sucesso (TLS 1.2+)."

            : `WSDL respondeu HTTP ${res.statusCode}.`,

        };

      } catch (e) {

        return { ok: false, message: e instanceof Error ? e.message : String(e) };

      }

    }



    if (!runtime.soapEndpoint || !runtime.soapUsername || !runtime.soapPassword) {

      return { ok: false, message: "Endpoint SOAP, utilizador e password em falta." };

    }



    const dto = mapConsultarEstadoDto("health-check");

    const body = buildSigoSoapEnvelope(

      { username: runtime.soapUsername, password: runtime.soapPassword },

      buildSigoConsultarEstadoSoapBodyFromDto(dto, this.namespace()),

    );



    try {

      const res = await postSigoSoapRequest(runtime.soapEndpoint, this.consultarAction(), body, {

        timeoutMs,

      });

      const parsed = parseSigoSoapResponse(res.body);

      return {

        ok: res.statusCode < 500,

        message: parsed.mensagem ?? `SIGO SOAP HTTP ${res.statusCode}.`,

      };

    } catch (e) {

      return { ok: false, message: e instanceof Error ? e.message : String(e) };

    }

  }



  async submitAcao(

    runtime: ResolvedSigoRuntime,

    input: SigoSoapSubmitInput,

  ): Promise<{ referenceId: string; transacaoId: string | null }> {

    if (runtime.mode !== "soap") {

      throw new ServiceUnavailableException("Modo SOAP SIGO não activo.");

    }

    if (!runtime.soapUsername || !runtime.soapPassword) {

      throw new ServiceUnavailableException("Credenciais WS-Security SOAP em falta.");

    }



    const dto = mapExportToSubmeterAcaoDto(

      input.pkg,

      input.referenceId,

      runtime.codigoEntidade,

    );

    const requestHash = createHash("sha256").update(JSON.stringify(dto)).digest("hex");

    await this.criarSyncPendentes(input.tenantId, input.submissaoId, input.pkg, requestHash);



    const parsed = await this.executarOperacaoSoap(runtime, this.submitAction(), dto);

    await this.actualizarSyncFormandos(input.tenantId, input.submissaoId, input.pkg, parsed, requestHash);



    if (!parsed.sucesso) {

      throw new BadRequestException(

        parsed.mensagem ?? parsed.fault?.mensagemUtilizador ?? "SIGO rejeitou a submissão SOAP.",

      );

    }



    return { referenceId: input.referenceId, transacaoId: parsed.transacaoId };

  }



  async consultarEstado(runtime: ResolvedSigoRuntime, referenceId: string) {

    if (runtime.mode !== "soap" || !runtime.soapUsername || !runtime.soapPassword) {

      throw new ServiceUnavailableException("Credenciais SOAP SIGO em falta.");

    }

    const dto = mapConsultarEstadoDto(referenceId);

    return this.executarOperacaoSoap(runtime, this.consultarAction(), dto);

  }



  private async executarOperacaoSoap(

    runtime: ResolvedSigoRuntime,

    methodName: string,

    payload: SubmeterAcaoSigoDTO | ConsultarEstadoSigoDTO,

  ) {

    const creds = { username: runtime.soapUsername!, password: runtime.soapPassword! };



    if (runtime.wsdlUrl && !this.forceRawXml()) {

      try {

        const client = await createSigoSoapClient({

          wsdlUrl: runtime.wsdlUrl,

          endpoint: runtime.soapEndpoint,

          username: creds.username,

          password: creds.password,

          timeoutMs: this.timeoutMs(),

        });

        const [result] = await invokeSigoSoapMethod(client, methodName, payload);

        const xml = soapResponseToXml(client.lastResponse, result);

        if (xml.trim().startsWith("<")) {

          return parseSigoSoapResponse(xml);

        }

        return parseSigoSoapJsonResult(result);

      } catch (e) {

        this.logger.warn(

          `SOAP via módulo soap falhou (${methodName}), fallback XML manual: ${e instanceof Error ? e.message : String(e)}`,

        );

      }

    }



    const endpoint = runtime.soapEndpoint;

    if (!endpoint) {

      throw new ServiceUnavailableException("Endpoint SOAP SIGO não configurado.");

    }



    const bodyXml =

      methodName === this.submitAction()

        ? buildSigoSubmitSoapBodyFromDto(payload as SubmeterAcaoSigoDTO, this.namespace())

        : buildSigoConsultarEstadoSoapBodyFromDto(payload as ConsultarEstadoSigoDTO, this.namespace());



    const envelope = buildSigoSoapEnvelope(creds, bodyXml);

    const res = await postSigoSoapRequest(endpoint, methodName, envelope, {

      timeoutMs: this.timeoutMs(),

    });

    return parseSigoSoapResponse(res.body);

  }



  private async criarSyncPendentes(

    tenantId: string,

    submissaoId: string,

    pkg: NexiformaSigoExportBody,

    requestHash: string,

  ) {

    for (const f of pkg.formandos) {

      const matriculaId = f.matriculaId;

      if (!matriculaId) continue;



      const dup = await this.prisma.sigoSincronizacaoFormando.findFirst({

        where: { tenantId, matriculaId, operacao: "SUBMETER", estado: "SUCESSO" },

      });

      if (dup) {

        await this.prisma.sigoSincronizacaoFormando.upsert({

          where: {

            tenantId_submissaoId_matriculaId_operacao: {

              tenantId,

              submissaoId,

              matriculaId,

              operacao: "SUBMETER",

            },

          },

          create: {

            tenantId,

            submissaoId,

            matriculaId,

            operacao: "SUBMETER",

            estado: "DUPLICADO",

            soapFaultCode: "FORMANDO_JA_SINCRONIZADO",

            soapFaultString: `Formando já sincronizado (submissão ${dup.submissaoId}).`,

            requestHash,

          },

          update: {

            estado: "DUPLICADO",

            soapFaultCode: "FORMANDO_JA_SINCRONIZADO",

            soapFaultString: `Formando já sincronizado (submissão ${dup.submissaoId}).`,

            requestHash,

          },

        });

        continue;

      }



      await this.prisma.sigoSincronizacaoFormando.upsert({

        where: {

          tenantId_submissaoId_matriculaId_operacao: {

            tenantId,

            submissaoId,

            matriculaId,

            operacao: "SUBMETER",

          },

        },

        create: {

          tenantId,

          submissaoId,

          matriculaId,

          operacao: "SUBMETER",

          estado: "PENDENTE",

          requestHash,

        },

        update: { estado: "PENDENTE", requestHash },

      });

    }

  }



  private async actualizarSyncFormandos(

    tenantId: string,

    submissaoId: string,

    pkg: NexiformaSigoExportBody,

    parsed: ReturnType<typeof parseSigoSoapResponse>,

    requestHash: string,

  ) {

    const errosPorNif = new Map(

      parsed.errosFormandos.filter((e) => e.nif).map((e) => [e.nif!, e]),

    );



    for (const f of pkg.formandos) {

      const matriculaId = f.matriculaId;

      if (!matriculaId) continue;



      const existente = await this.prisma.sigoSincronizacaoFormando.findUnique({

        where: {

          tenantId_submissaoId_matriculaId_operacao: {

            tenantId,

            submissaoId,

            matriculaId,

            operacao: "SUBMETER",

          },

        },

      });

      if (existente?.estado === "DUPLICADO") continue;



      const erro = errosPorNif.get(f.nif);

      let estado: SigoSyncEstado = parsed.sucesso ? "SUCESSO" : "ERRO";

      if (erro?.codigo.includes("DUPLIC") || erro?.mensagem.toLowerCase().includes("inscrit")) {

        estado = "DUPLICADO";

      }



      await this.prisma.sigoSincronizacaoFormando.update({

        where: {

          tenantId_submissaoId_matriculaId_operacao: {

            tenantId,

            submissaoId,

            matriculaId,

            operacao: "SUBMETER",

          },

        },

        data: {

          estado,

          transacaoId: parsed.transacaoId,

          soapFaultCode: erro?.codigo ?? parsed.fault?.faultCode ?? null,

          soapFaultString: erro?.mensagem ?? parsed.fault?.faultString ?? parsed.mensagem,

          requestHash,

          responseResumo: parsed.mensagem?.slice(0, 2000) ?? null,

        },

      });

    }

  }



  private forceRawXml() {

    return (this.config.get<string>("SIGO_SOAP_FORCE_RAW_XML") ?? "").toLowerCase() === "true";

  }



  private namespace() {

    return this.config.get<string>("SIGO_SOAP_NAMESPACE")?.trim() || SIGO_SOAP_NAMESPACE_DEFAULT;

  }



  private submitAction() {

    return this.config.get<string>("SIGO_SOAP_ACTION_SUBMIT")?.trim() || "SubmeterAcao";

  }



  private consultarAction() {

    return this.config.get<string>("SIGO_SOAP_ACTION_CONSULTAR")?.trim() || "ConsultarEstado";

  }



  private timeoutMs() {

    return Number(this.config.get<string>("SIGO_API_TIMEOUT_MS") ?? "30000");

  }

}


