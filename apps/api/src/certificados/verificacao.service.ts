/**
 * Verification Service – NexiForma Fase 9
 * QR Code + Página Pública de Verificação de Certificados
 */

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import QRCode from "qrcode";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";

export interface VerificacaoResultado {
  valido: boolean;
  certificado: {
    codigoPublico: string;
    emitidoEm: string;
    revogadoEm: string | null;
    formando: {
      nome: string;
      nif: string;
    };
    curso: {
      designacao: string;
      codigoUfcd: string;
      cargaHoras: number;
    };
    acao: {
      codigoInterno: string;
      dataInicio: string;
      dataFim: string;
    };
    entidade: {
      legalName: string;
      nif: string;
    };
  };
  hash?: string;
  validadoEm?: string;
}

@Injectable()
export class VerificacaoCertificadoService {
  private readonly logger = new Logger(VerificacaoCertificadoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Gera QR code para um certificado
   * QR aponta para: https://nexiforma.pt/verificar/{codigoPublico}
   */
  async gerarQrCode(
    matriculaId: string,
  ): Promise<{ qrDataUrl: string; codigoPublico: string }> {
    // Verificar se certificado existe
    let certVerif = await this.prisma.certificadoVerificacao.findUnique({
      where: { matriculaId },
    });

    // Se não existe, gerar novo código público
    if (!certVerif) {
      const matricula = await this.prisma.matricula.findUniqueOrThrow({
        where: { id: matriculaId },
        select: { tenantId: true },
      });

      const codigoPublico = this.gerarCodigoPublico();
      const tokenHash = crypto
        .createHash("sha256")
        .update(Math.random().toString())
        .digest("hex");

      certVerif = await this.prisma.certificadoVerificacao.create({
        data: {
          matriculaId,
          tenantId: matricula.tenantId,
          codigoPublico,
          tokenHash,
          hashConteudo: "", // Será atualizado ao emitir certificado
        },
      });
    }

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const verificacaoUrl = `${appUrl}/verificar/${certVerif.codigoPublico}`;

    // Gerar QR
    const qrDataUrl = await QRCode.toDataURL(verificacaoUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    this.logger.log(`✓ QR code gerado para ${certVerif.codigoPublico}`);

    return {
      qrDataUrl,
      codigoPublico: certVerif.codigoPublico,
    };
  }

  /**
   * Verifica certificado por código público (sem autenticação)
   * Retorna informações de certificado com hash de validação
   */
  async verificarCertificado(codigoPublico: string): Promise<VerificacaoResultado> {
    const certVerif = await this.prisma.certificadoVerificacao.findUnique({
      where: { codigoPublico },
      include: {
        matricula: {
          include: {
            formando: {
              select: { nome: true, nif: true },
            },
            turma: {
              include: {
                acaoFormacao: {
                  include: {
                    curso: true,
                    tenant: { select: { legalName: true, nif: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!certVerif) {
      throw new NotFoundException("Certificado não encontrado.");
    }

    // Verificar se foi revogado
    const revogado = certVerif.revogadoEm !== null;

    const acao = certVerif.matricula.turma.acaoFormacao;

    return {
      valido: !revogado && !!certVerif.emitidoEm,
      certificado: {
        codigoPublico: certVerif.codigoPublico,
        emitidoEm: certVerif.emitidoEm?.toISOString() ?? "N/A",
        revogadoEm: certVerif.revogadoEm?.toISOString() ?? null,
        formando: certVerif.matricula.formando,
        curso: {
          designacao: acao.curso.designacao,
          codigoUfcd: acao.curso.codigoUfcd ?? "",
          cargaHoras: acao.curso.cargaHoras,
        },
        acao: {
          codigoInterno: acao.codigoInterno,
          dataInicio: acao.dataInicio.toISOString().split("T")[0],
          dataFim: acao.dataFim.toISOString().split("T")[0],
        },
        entidade: acao.tenant,
      },
      hash: certVerif.hashConteudo || undefined,
      validadoEm: new Date().toISOString(),
    };
  }

  /**
   * Buscar certificado por matriculaId
   */
  async findByMatriculaId(matriculaId: string) {
    return this.prisma.certificadoVerificacao.findUnique({
      where: { matriculaId },
    });
  }

  /**
   * Revogar certificado (uso administrativo)
   */
  async revogarCertificado(codigoPublico: string, motivo?: string): Promise<void> {
    const certVerif = await this.prisma.certificadoVerificacao.findUnique({
      where: { codigoPublico },
    });

    if (!certVerif) {
      throw new NotFoundException("Certificado não encontrado.");
    }

    if (certVerif.revogadoEm) {
      this.logger.log(`Certificado ${codigoPublico} já estava revogado.`);
      return;
    }

    await this.prisma.certificadoVerificacao.update({
      where: { codigoPublico },
      data: {
        revogadoEm: new Date(),
      },
    });

    this.logger.log(`✓ Certificado ${codigoPublico} revogado${motivo ? `: ${motivo}` : ""}`);
  }

  /**
   * Gera código público único para certificado
   * Formato: CERT-{timestamp}-{random}
   * Exemplo: CERT-20260603-A1B2C3D4
   */
  private gerarCodigoPublico(): string {
    const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const random = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `CERT-${timestamp}-${random}`;
  }

  /**
   * Gera hash de conteúdo para validação de integridade
   */
  gerarHashConteudo(conteudo: string): string {
    return crypto.createHash("sha256").update(conteudo).digest("hex");
  }

  /**
   * Atualizar hash de conteúdo após emissão
   */
  async atualizarHashConteudo(
    codigoPublico: string,
    conteudo: string,
  ): Promise<void> {
    const hash = this.gerarHashConteudo(conteudo);
    await this.prisma.certificadoVerificacao.update({
      where: { codigoPublico },
      data: { hashConteudo: hash },
    });
  }
}
