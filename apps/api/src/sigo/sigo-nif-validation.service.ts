import { Injectable, Logger } from "@nestjs/common";
import { isValidNifPt } from "../dossie-pedagogico/sigo-validation.util";

export type SigoNifValidacaoResult = {
  /** Serviço SIGO de consulta de NIF respondeu. */
  disponivel: boolean;
  /** true/false se consultado; null se indisponível. */
  valido: boolean | null;
  mensagem: string;
  codigo: "OK" | "INVALID_FORMAT" | "UNAVAILABLE" | "NOT_IMPLEMENTED";
};

/**
 * Ponto de extensão para validação remota de NIF pessoal via SIGO.
 * Enquanto a AGSE/DGEEC não publicar operação SOAP (ValidarNIF / equivalente),
 * devolve NOT_IMPLEMENTED - o checksum Portugal NIF continua obrigatório a montante.
 */
@Injectable()
export class SigoNifValidationService {
  private readonly logger = new Logger(SigoNifValidationService.name);

  /** Se `SIGO_NIF_VALIDATION=required`, falha o create quando a SIGO não confirmar. */
  isRequired(): boolean {
    return (process.env.SIGO_NIF_VALIDATION ?? "").trim().toLowerCase() === "required";
  }

  async validarNifPessoal(nif: string): Promise<SigoNifValidacaoResult> {
    const digits = nif.replace(/\D/g, "");
    if (!isValidNifPt(digits)) {
      return {
        disponivel: false,
        valido: false,
        mensagem: "NIF inválido (formato Portugal NIF).",
        codigo: "INVALID_FORMAT",
      };
    }

    // TODO(AGSE): chamar operação SOAP quando o WSDL incluir consulta de contribuinte.
    this.logger.debug(
      `validarNifPessoal(${digits}): SIGO sem operação de validação de NIF - stub NOT_IMPLEMENTED`,
    );

    return {
      disponivel: false,
      valido: null,
      mensagem:
        "Validação remota SIGO de NIF pessoal ainda não disponível (aguardar WSDL/operação AGSE).",
      codigo: "NOT_IMPLEMENTED",
    };
  }
}
