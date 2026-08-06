import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { RgpdPedido } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { StorageService } from "../storage/storage.service";
import { DocumentAccessAuditService } from "../audit/document-access-audit.service";
import { FATURACAO_HISTORICO_IMUTAVEL_MSG } from "../faturas/faturacao-historico.util";
import {
  parseRgpdExportFormat,
  serializeRgpdExport,
  type RgpdExportFormat,
} from "./rgpd-export-format.util";

@Injectable()
export class RgpdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documentAudit: DocumentAccessAuditService,
  ) {}

  list(user: RequestUser): Promise<RgpdPedido[]> {
    const tenantId = requireTenantId(user);
    return this.prisma.rgpdPedido.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Gera a exportação RGPD do utilizador autenticado (json | csv | txt).
   */
  async exportSelfFile(
    user: RequestUser,
    formatRaw?: string,
  ): Promise<{ body: Buffer; contentType: string; filename: string; pedidoId: string }> {
    const format: RgpdExportFormat = parseRgpdExportFormat(formatRaw);
    const tenantId = requireTenantId(user);
    const formando = await this.prisma.formandoProfile.findFirst({
      where: { tenantId, userId: user.sub },
      select: { id: true },
    });

    const subjectType = formando ? "formando" : "utilizador";
    const subjectId = formando?.id ?? user.sub;

    const pedido = await this.prisma.rgpdPedido.create({
      data: {
        tenantId,
        subjectId,
        subjectType,
        tipo: "EXPORT",
      },
    });

    const processed = await this.processExport(pedido.id, tenantId, subjectId, subjectType);
    const resultado = processed.resultado as { storageKey?: string } | null;
    const key = resultado?.storageKey;
    if (!key) throw new NotFoundException("Exportação não disponível.");

    const obj = await this.storage.getObject(key);
    if (!obj) throw new NotFoundException("Ficheiro de exportação não encontrado no armazenamento.");

    let payload: unknown;
    try {
      payload = JSON.parse(obj.body.toString("utf8"));
    } catch {
      throw new BadRequestException("Exportação corrompida.");
    }

    const file = serializeRgpdExport(payload, format);

    await this.documentAudit.logDownload({
      user,
      tenantId,
      action: "rgpd.export.download",
      resourceType: "RgpdPedido",
      resourceId: processed.id,
      channel: "stream",
      payload: { subjectType, format },
    });

    return {
      body: file.body,
      contentType: file.contentType,
      filename: `rgpd-export-${subjectType}-${processed.id.slice(0, 8)}.${file.extension}`,
      pedidoId: processed.id,
    };
  }

  async processExport(
    pedidoId: string,
    tenantId: string,
    subjectId: string,
    subjectType: string,
  ): Promise<RgpdPedido> {
    const payload = await this.buildSubjectExport(tenantId, subjectId, subjectType);
    const key = `rgpd/${tenantId}/${pedidoId}.json`;
    await this.storage.putObject(key, Buffer.from(JSON.stringify(payload, null, 2)), "application/json");

    return this.prisma.rgpdPedido.update({
      where: { id: pedidoId },
      data: {
        estado: "PROCESSADO",
        processedAt: new Date(),
        resultado: { storageKey: key, registos: Object.keys(payload).length },
      },
    });
  }

  async processDelete(
    pedidoId: string,
    tenantId: string,
    subjectId: string,
    subjectType: string,
  ): Promise<RgpdPedido> {
    // RGPD nunca apaga histórico de faturação - apenas anonimiza dados pessoais.
    let anonymized = 0;
    if (subjectType === "formando") {
      const profile = await this.prisma.formandoProfile.findFirst({
        where: { id: subjectId, tenantId },
      });
      if (profile) {
        await this.prisma.formandoProfile.update({
          where: { id: subjectId },
          data: {
            nome: "Anónimo RGPD",
            email: null,
            telefone: null,
            nif: `RGPD-${subjectId.slice(0, 8)}`,
          },
        });
        anonymized = 1;
      }
    } else if (subjectType === "utilizador") {
      const account = await this.prisma.user.findFirst({
        where: { id: subjectId, tenantId },
      });
      if (account) {
        await this.prisma.user.update({
          where: { id: subjectId },
          data: {
            displayName: "Anónimo RGPD",
            email: `rgpd-${subjectId.slice(0, 8)}@anon.invalid`,
            active: false,
            mfaSecret: null,
            mfaEnabled: false,
          },
        });
        anonymized = 1;
      }
    } else if (subjectType === "entidade_cliente") {
      const faturas = await this.prisma.faturaComercial.count({
        where: { tenantId, entidadeClienteId: subjectId },
      });
      if (faturas > 0) {
        return this.prisma.rgpdPedido.update({
          where: { id: pedidoId },
          data: {
            estado: "REJEITADO",
            processedAt: new Date(),
            resultado: {
              anonymized: 0,
              subjectType,
              motivo: FATURACAO_HISTORICO_IMUTAVEL_MSG,
            },
          },
        });
      }
      const entidade = await this.prisma.entidadeCliente.findFirst({
        where: { id: subjectId, tenantId },
      });
      if (entidade) {
        await this.prisma.entidadeCliente.update({
          where: { id: subjectId },
          data: {
            nome: "Anónimo RGPD",
            email: null,
            telefone: null,
            moradaFiscal: null,
            nif: `RGPD${subjectId.replace(/\D/g, "").slice(0, 5)}X`.padEnd(9, "0").slice(0, 9),
          },
        });
        anonymized = 1;
      }
    }

    return this.prisma.rgpdPedido.update({
      where: { id: pedidoId },
      data: {
        estado: anonymized > 0 ? "PROCESSADO" : "REJEITADO",
        processedAt: new Date(),
        resultado: { anonymized, subjectType },
      },
    });
  }

  /**
   * Exportação RGPD = apenas dados pessoais do titular (art. 15).
   * Exclui dados operacionais (matrículas, leads, propostas, faturas, notificações, etc.).
   */
  private async buildSubjectExport(tenantId: string, subjectId: string, subjectType: string) {
    const exportedAt = new Date().toISOString();
    const ambito =
      "Exportação limitada a dados pessoais identificativos e de contacto do titular. " +
      "Não inclui histórico operacional, pedagógico, comercial nem documentos de faturação " +
      "(retenção legal própria).";

    if (subjectType === "formando") {
      const formando = await this.prisma.formandoProfile.findFirst({
        where: { id: subjectId, tenantId },
        select: {
          id: true,
          nome: true,
          nif: true,
          email: true,
          emailPresenca: true,
          telefone: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              role: true,
              emailVerifiedAt: true,
              createdAt: true,
              rgpdConsent: {
                select: {
                  userAccepted: true,
                  termsVersion: true,
                  userDecidedAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      });
      if (!formando) throw new NotFoundException("Sujeito de dados não encontrado.");
      return {
        tipo: "dados_pessoais",
        sujeito: "formando",
        exportedAt,
        ambito,
        dadosPessoais: {
          identificacao: {
            id: formando.id,
            nome: formando.nome,
            nif: formando.nif,
          },
          contactos: {
            email: formando.email,
            emailPresenca: formando.emailPresenca,
            telefone: formando.telefone,
          },
          contaAssociada: formando.user
            ? {
                id: formando.user.id,
                email: formando.user.email,
                nomeApresentacao: formando.user.displayName,
                perfil: formando.user.role,
                emailVerificadoEm: formando.user.emailVerifiedAt,
                criadaEm: formando.user.createdAt,
                consentimentoRgpd: formando.user.rgpdConsent,
              }
            : null,
          perfilCriadoEm: formando.createdAt,
        },
      };
    }

    if (subjectType === "utilizador") {
      const account = await this.prisma.user.findFirst({
        where: { id: subjectId, tenantId },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          active: true,
          mfaEnabled: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
          rgpdConsent: {
            select: {
              userAccepted: true,
              termsVersion: true,
              userDecidedAt: true,
              updatedAt: true,
            },
          },
          formandoProfile: {
            select: {
              id: true,
              nome: true,
              email: true,
              emailPresenca: true,
              telefone: true,
              nif: true,
            },
          },
          formadorProfile: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              nif: true,
            },
          },
        },
      });
      if (!account) throw new NotFoundException("Sujeito de dados não encontrado.");
      return {
        tipo: "dados_pessoais",
        sujeito: "utilizador",
        exportedAt,
        ambito,
        dadosPessoais: {
          identificacao: {
            id: account.id,
            nomeApresentacao: account.displayName,
            email: account.email,
            perfil: account.role,
            activa: account.active,
            mfaActivo: account.mfaEnabled,
            emailVerificadoEm: account.emailVerifiedAt,
            criadaEm: account.createdAt,
            actualizadaEm: account.updatedAt,
          },
          consentimentoRgpd: account.rgpdConsent,
          perfilFormando: account.formandoProfile
            ? {
                id: account.formandoProfile.id,
                nome: account.formandoProfile.nome,
                nif: account.formandoProfile.nif,
                email: account.formandoProfile.email,
                emailPresenca: account.formandoProfile.emailPresenca,
                telefone: account.formandoProfile.telefone,
              }
            : null,
          perfilFormador: account.formadorProfile
            ? {
                id: account.formadorProfile.id,
                nomeCompleto: account.formadorProfile.nomeCompleto,
                nif: account.formadorProfile.nif,
                email: account.formadorProfile.email,
              }
            : null,
        },
      };
    }

    if (subjectType === "entidade_cliente") {
      const entidade = await this.prisma.entidadeCliente.findFirst({
        where: { id: subjectId, tenantId },
        select: {
          id: true,
          nif: true,
          nome: true,
          moradaFiscal: true,
          email: true,
          telefone: true,
          createdAt: true,
        },
      });
      if (!entidade) throw new NotFoundException("Sujeito de dados não encontrado.");
      return {
        tipo: "dados_pessoais",
        sujeito: "entidade_cliente",
        exportedAt,
        ambito,
        dadosPessoais: {
          identificacao: {
            id: entidade.id,
            nome: entidade.nome,
            nif: entidade.nif,
          },
          contactos: {
            email: entidade.email,
            telefone: entidade.telefone,
            moradaFiscal: entidade.moradaFiscal,
          },
          registadaEm: entidade.createdAt,
        },
      };
    }

    throw new BadRequestException(
      `Tipo de sujeito RGPD não suportado: ${subjectType}. Use formando, utilizador ou entidade_cliente.`,
    );
  }
}
