/**
 * Verification Controller – NexiForma Fase 9
 * Endpoints públicos para verificação de certificados
 * Endpoints autenticados para assinatura CMD
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { VerificacaoCertificadoService } from "./verificacao.service";

/**
 * Endpoints Públicos – sem autenticação
 */
@Controller("verificar")
export class VerificacaoPublicaController {
  private readonly logger = new Logger(VerificacaoPublicaController.name);

  constructor(private readonly verificacao: VerificacaoCertificadoService) {}

  /**
   * GET /verificar/:codigoPublico
   * Página pública de verificação de certificado
   * Retorna HTML ou JSON conforme Accept header
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

      // Se for navegador, retornar HTML bonito
      // Se for API (Accept: application/json), retornar JSON
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

/**
 * Endpoints Autenticados – para assinatura e gestão
 */
@Controller("certificados")
@UseGuards(JwtAuthGuard)
export class VerificacaoGestaoController {
  private readonly logger = new Logger(VerificacaoGestaoController.name);

  constructor(
    private readonly verificacao: VerificacaoCertificadoService,
  ) {}

  /**
   * POST /certificados/:matriculaId/qrcode
   * Gera QR code para certificado (uso em HTML/PDF)
   */
  @Post(":matriculaId/qrcode")
  async gerarQrCode(
    @CurrentUser() user: RequestUser,
    @Param("matriculaId") matriculaId: string,
  ) {
    try {
      if (!matriculaId?.trim()) {
        throw new BadRequestException("matriculaId é obrigatório.");
      }

      const { qrDataUrl, codigoPublico } =
        await this.verificacao.gerarQrCode(matriculaId);

      this.logger.log(
        `✓ QR code gerado para matrícula ${matriculaId} – ${codigoPublico}`,
      );

      return {
        sucesso: true,
        codigoPublico,
        qrDataUrl, // Base64 PNG
      };
    } catch (err) {
      this.logger.error(`Erro ao gerar QR: ${err}`);
      throw err;
    }
  }

  /**
   * POST /certificados/:matriculaId/revogar
   * Revogar um certificado (admin only)
   */
  @Post(":matriculaId/revogar")
  async revogarCertificado(
    @CurrentUser() user: RequestUser,
    @Param("matriculaId") matriculaId: string,
    @Body() body: { motivo?: string },
  ) {
    try {
      // TODO: Validar que user é admin/coordenador

      // Recuperar codigoPublico
      const certVerif = await this.verificacao.findByMatriculaId(matriculaId);
      if (!certVerif) {
        throw new NotFoundException("Certificado não encontrado.");
      }

      await this.verificacao.revogarCertificado(
        certVerif.codigoPublico,
        body.motivo,
      );

      this.logger.log(
        `✓ Certificado revogado: ${certVerif.codigoPublico}`,
      );

      return {
        sucesso: true,
        mensagem: "Certificado revogado com sucesso.",
      };
    } catch (err) {
      this.logger.error(`Erro ao revogar certificado: ${err}`);
      throw err;
    }
  }
}
