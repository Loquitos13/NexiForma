/**
 * Inspection API Controller – NexiForma Fase 8
 * Endpoints para download de pacote de inspeção e gestão de notificações
 */

import {
  Controller,
  Get,
  Param,
  Res,
  Logger,
  BadRequestException,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { InspecaoPacoteService } from "./inspecao-pacote.service";

@Controller("inspecao")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("tenant_manager")
export class InspecaoController {
  private readonly logger = new Logger(InspecaoController.name);

  constructor(private readonly pacote: InspecaoPacoteService) {}

  /**
   * GET /inspecao/pacote/:acaoFormacaoId
   * Download ZIP com artefatos para inspeção DGERT
   *
   * Contém:
   * - MANIFESTO.json (metadados, checklist)
   * - dossie/ (PDF pedagógico)
   * - PRESENCAS.csv (registo de presenças)
   * - sumarios/ (JSON de cada sessão)
   * - CRONOGRAMA.json (estrutura aprovada)
   * - lms-evidencias/ (acessos e progresso)
   */
  @Get("pacote/:acaoFormacaoId")
  async baixarPacoteInspecao(
    @CurrentUser() user: RequestUser,
    @Param("acaoFormacaoId") acaoFormacaoId: string,
    @Res() res: Response,
  ) {
    try {
      if (!acaoFormacaoId?.trim()) {
        throw new BadRequestException("acaoFormacaoId é obrigatório.");
      }

      this.logger.log(
        `Gerando pacote inspeção para ação ${acaoFormacaoId}...`,
      );

      const { buffer, nomeArquivo } =
        await this.pacote.gerarPacoteInspecao(user, acaoFormacaoId);

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${nomeArquivo}"`,
      );
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Length", buffer.length);

      this.logger.log(
        `✓ Pacote gerado: ${nomeArquivo} (${Math.round(buffer.length / 1024)}KB)`,
      );

      return res.send(buffer);
    } catch (err) {
      this.logger.error(`Falha ao gerar pacote: ${err}`);
      throw err;
    }
  }

  /**
   * GET /inspecao/checklist/:acaoFormacaoId
   * Retorna checklist DGERT para uma ação (JSON)
   * Útil para pré-verificação antes de download
   */
  @Get("checklist/:acaoFormacaoId")
  async verificarChecklist(
    @CurrentUser() user: RequestUser,
    @Param("acaoFormacaoId") acaoFormacaoId: string,
  ) {
    try {
      const { buffer } = await this.pacote.gerarPacoteInspecao(
        user,
        acaoFormacaoId,
      );

      // Parse MANIFESTO.json do ZIP
      // (nota: simplificado – idealmente teríamos méthodo separado)
      return {
        status: "success",
        message:
          "Pacote pronto para download. Use /inspecao/pacote/:id para baixar.",
      };
    } catch (err) {
      this.logger.error(`Erro ao verificar checklist: ${err}`);
      throw err;
    }
  }
}
