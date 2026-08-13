import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { safeFetch } from "../common/safe-fetch.util";
import { isValidNifPt } from "../dossie-pedagogico/sigo-validation.util";
import { SigoNifValidationService } from "../sigo/sigo-nif-validation.service";
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

@Injectable()
export class ViesService {
  private readonly logger = new Logger(ViesService.name);
  /** Evita consultas duplicadas ao NIF.PT (ex.: validação no formulário + submit). */
  private readonly nifPtCache = new Map<string, { expiresAt: number; result: ViesVerificacaoResult }>();
  private readonly nifPtCacheTtlMs = Number(process.env.NIF_PT_CACHE_TTL_MS ?? 600_000);

  constructor(private readonly sigoNif: SigoNifValidationService) {}

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
