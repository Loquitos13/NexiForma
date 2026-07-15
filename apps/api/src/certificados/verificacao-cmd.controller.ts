/**
 * Verification Controller – NexiForma Fase 9
 * Endpoints públicos para verificação de certificados
 */

import {
  Controller,
  Get,
  Logger,
  BadRequestException,
  Param,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { VerificacaoCertificadoService } from "./verificacao.service";

/**
 * Endpoints Públicos – sem autenticação
 */
@Public()
@Controller("verificar")
export class VerificacaoPublicaController {
  private readonly logger = new Logger(VerificacaoPublicaController.name);

  constructor(private readonly verificacao: VerificacaoCertificadoService) {}

  /**
   * GET /verificar/:codigoPublico
   * Página pública de verificação de certificado
   */
  @Get(":codigoPublico")
  async verificarCertificado(
    @Param("codigoPublico") codigoPublico: string,
  ) {
    try {
      if (!codigoPublico?.trim()) {
        throw new BadRequestException("Código público inválido.");
      }

      const resultado = await this.verificacao.verificarCertificado(
        codigoPublico,
      );

      return {
        sucesso: resultado.valido,
        dados: resultado.certificado,
        validadoEm: resultado.validadoEm,
      };
    } catch (err) {
      this.logger.error(`Erro na verificação: ${err}`);
      throw err;
    }
  }
}
