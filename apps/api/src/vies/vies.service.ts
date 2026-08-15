import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { safeFetch } from "../common/safe-fetch.util";
import { requireTenantId } from "../common/tenant-scope";
import type { RequestUser } from "../auth/types/access-token-payload";
import { isValidNifPt } from "../dossie-pedagogico/sigo-validation.util";
import { PrismaService } from "../prisma/prisma.service";
import { SigoNifValidationService } from "../sigo/sigo-nif-validation.service";
import { ExternalServiceEventService } from "../common/external-service-event.service";
import {
  buildViesResult,
  evaluateNifConfirmation,
  mapNifPtResponse,
  nifPtUrl,
  parseVatInput,
  type NifConfirmTipo,
  type NifPtApiResponse,
  type ViesVerificacaoResult,
} from "./vies.util";

export type ValidarNifUiCodigo =
  | "CLIENTE_EXISTENTE"
  | "RATE_LIMIT"
  | "NAO_CONFIRMADO"
  | "FORMATO_INVALIDO"
  | "INDISPONIVEL";

export type ValidarNifUiResposta = {
  valido: boolean;
  mensagem?: string;
  codigo?: ValidarNifUiCodigo;
  clienteExistente?: { id: string; nome: string; nif: string };
};

function mensagemDeExcecao(err: unknown): string {
  if (err instanceof BadRequestException) {
    const resposta = err.getResponse();
    if (typeof resposta === "string") return resposta;
    if (typeof resposta === "object" && resposta && "message" in resposta) {
      const msg = (resposta as { message?: string | string[] }).message;
      if (Array.isArray(msg)) return msg.join(", ");
      if (typeof msg === "string" && msg.trim()) return msg;
    }
  }
  return "Não foi possível confirmar o NIF.";
}

function codigoDeMensagem(mensagem: string): ValidarNifUiCodigo {
  if (/limite de consultas|limit per minute|buy credits|rate.?limit|quota/i.test(mensagem)) {
    return "RATE_LIMIT";
  }
  if (/indisponível|indisponivel|tente novamente|API key|MISSING_API_KEY/i.test(mensagem)) {
    return "INDISPONIVEL";
  }
  return "NAO_CONFIRMADO";
}

@Injectable()
export class ViesService {
  private readonly logger = new Logger(ViesService.name);
  /** Evita consultas duplicadas ao NIF.PT (ex.: validação no formulário + submit). */
  private readonly nifPtCache = new Map<string, { expiresAt: number; result: ViesVerificacaoResult }>();
  private readonly nifPtCacheTtlMs = Number(process.env.NIF_PT_CACHE_TTL_MS ?? 600_000);

  constructor(
    private readonly sigoNif: SigoNifValidationService,
    private readonly prisma: PrismaService,
    private readonly externalEvents: ExternalServiceEventService,
  ) {}

  /** Validação para feedback na UI (com mensagens úteis, sem expor API key). */
  async validarParaUi(
    user: RequestUser,
    rawVat: string,
    tipo: NifConfirmTipo,
  ): Promise<ValidarNifUiResposta> {
    const parsed = parseVatInput(rawVat, "PT");
    const vatNumber = parsed?.vatNumber ?? rawVat.replace(/\D/g, "");
    if (!parsed || !isValidNifPt(vatNumber)) {
      return {
        valido: false,
        codigo: "FORMATO_INVALIDO",
        mensagem: "NIF inválido (formato ou dígito de controlo).",
      };
    }

    if (tipo === "empresa") {
      try {
        const tenantId = requireTenantId(user);
        const dup = await this.prisma.entidadeCliente.findFirst({
          where: { tenantId, nif: vatNumber },
          select: { id: true, nome: true, nif: true },
        });
        if (dup) {
          return {
            valido: false,
            codigo: "CLIENTE_EXISTENTE",
            mensagem: `Já existe um cliente registado com este NIF: ${dup.nome}.`,
            clienteExistente: dup,
          };
        }
      } catch {
        // Sem tenant (ex. super-admin) - segue para NIF.PT.
      }
    }

    try {
      await this.assertConfirmado(rawVat, tipo, "PT");
      return { valido: true };
    } catch (err) {
      const mensagem = mensagemDeExcecao(err);
      return {
        valido: false,
        mensagem,
        codigo: codigoDeMensagem(mensagem),
      };
    }
  }

  /**
   * Confirma NIF antes de criar ficha.
   * - pessoa: Portugal NIF + extensão SIGO (stub até WSDL AGSE)
   * - empresa: NIF.PT
   */
  async assertConfirmado(
    rawVat: string,
    tipo: NifConfirmTipo,
    countryHint: string | null = "PT",
  ): Promise<ViesVerificacaoResult> {
    if (tipo === "pessoa") {
      const result = this.verificarPortugalNif(rawVat, countryHint);
      const ev = evaluateNifConfirmation(result, tipo);
      if (!ev.ok) throw new BadRequestException(ev.mensagem);

      const sigo = await this.sigoNif.validarNifPessoal(result.vatNumber);
      if (this.sigoNif.isRequired()) {
        if (!sigo.disponivel || sigo.valido !== true) {
          throw new BadRequestException(
            sigo.mensagem ||
              "Confirmação SIGO do NIF pessoal obrigatória e indisponível (SIGO_NIF_VALIDATION=required).",
          );
        }
      }

      if (sigo.disponivel && sigo.valido === true) {
        return buildViesResult({
          countryCode: result.countryCode,
          vatNumber: result.vatNumber,
          formatoValido: true,
          disponivel: true,
          validoRegisto: true,
          fonte: "portugal_nif",
          mensagem: "NIF pessoal confirmado (Portugal NIF + SIGO).",
        });
      }

      return result;
    }

    const result = await this.verificar(rawVat, countryHint);
    const ev = evaluateNifConfirmation(result, tipo);
    if (!ev.ok) throw new BadRequestException(ev.mensagem);
    return result;
  }

  /** Validação local Portugal NIF (particulares). */
  verificarPortugalNif(rawVat: string, countryHint?: string | null): ViesVerificacaoResult {
    const parsed = parseVatInput(rawVat, countryHint ?? "PT");
    const vatNumber = parsed?.vatNumber ?? rawVat.replace(/\D/g, "");
    const formatoValido = Boolean(parsed) && isValidNifPt(vatNumber);
    return buildViesResult({
      countryCode: "PT",
      vatNumber,
      formatoValido,
      disponivel: true,
      validoRegisto: formatoValido,
      fonte: "portugal_nif",
      mensagem: formatoValido
        ? "NIF pessoal confirmado (algoritmo Portugal NIF)."
        : "NIF inválido (formato ou dígito de controlo Portugal NIF).",
    });
  }

  /** Empresas: consulta NIF.PT (após checksum Portugal NIF). */
  async verificar(rawVat: string, countryHint?: string | null): Promise<ViesVerificacaoResult> {
    const parsed = parseVatInput(rawVat, countryHint);
    if (!parsed) {
      return buildViesResult({
        countryCode: "PT",
        vatNumber: rawVat.replace(/\D/g, "").slice(0, 9),
        formatoValido: false,
        disponivel: false,
        validoRegisto: null,
        fonte: "portugal_nif",
      });
    }

    const { vatNumber } = parsed;
    const formatoValido = isValidNifPt(vatNumber);
    if (!formatoValido) {
      return buildViesResult({
        countryCode: "PT",
        vatNumber,
        formatoValido: false,
        disponivel: false,
        validoRegisto: null,
        fonte: "portugal_nif",
      });
    }

    const apiKey = process.env.NIF_PT_API_KEY?.trim();
    if (!apiKey) {
      this.logger.warn("NIF_PT_API_KEY em falta - não é possível confirmar empresas no NIF.PT.");
      return buildViesResult({
        countryCode: "PT",
        vatNumber,
        formatoValido: true,
        disponivel: false,
        validoRegisto: null,
        userError: "MISSING_API_KEY",
        fonte: "nif_pt",
        mensagem:
          "Confirmação de NIF de empresa indisponível de momento. Tente novamente ou contacte o suporte.",
      });
    }

    const cached = this.nifPtCache.get(vatNumber);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const url = nifPtUrl(vatNumber, apiKey);
    const timeoutMs = Number(process.env.NIF_PT_TIMEOUT_MS ?? 12_000);

    try {
      const res = await safeFetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        requireHttps: true,
        signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 12_000),
      });

      if (!res.ok) {
        this.logger.warn(`NIF.PT HTTP ${res.status} para ${vatNumber}`);
        this.externalEvents.recordError({
          service: "nif_pt",
          code: `HTTP_${res.status}`,
          message: `NIF.PT indisponível (HTTP ${res.status}).`,
        });
        return buildViesResult({
          countryCode: "PT",
          vatNumber,
          formatoValido: true,
          disponivel: false,
          validoRegisto: null,
          userError: `HTTP_${res.status}`,
          fonte: "nif_pt",
        });
      }

      const body = (await res.json()) as NifPtApiResponse;
      const mapped = mapNifPtResponse(vatNumber, true, body);
      if (mapped.disponivel && mapped.validoRegisto === true) {
        this.nifPtCache.set(vatNumber, {
          expiresAt: Date.now() + this.nifPtCacheTtlMs,
          result: mapped,
        });
      }
      return mapped;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`NIF.PT indisponível: ${msg}`);
      this.externalEvents.recordError({
        service: "nif_pt",
        code: "NETWORK_ERROR",
        message: "NIF.PT indisponível (erro de rede ou timeout).",
        detail: msg.slice(0, 500),
      });
      return buildViesResult({
        countryCode: "PT",
        vatNumber,
        formatoValido: true,
        disponivel: false,
        validoRegisto: null,
        userError: "NETWORK_ERROR",
        fonte: "nif_pt",
      });
    }
  }
}
