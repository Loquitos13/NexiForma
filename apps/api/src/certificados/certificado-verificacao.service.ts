import { createHash, randomBytes } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

export type VerificacaoEmitResult = {
  token: string;
  codigoPublico: string;
  verifyUrl: string;
  emitidoEm: Date;
  reutilizado: boolean;
};

export type VerificacaoPublica = {
  valido: boolean;
  codigoPublico: string;
  emitidoEm: string;
  revogadoEm?: string | null;
  motivo?: string;
  formando?: { nome: string; nif: string };
  entidade?: { legalName: string; nif: string | null };
  acao?: { codigoInterno: string; titulo: string; dataInicio: string; dataFim: string };
  curso?: { designacao: string; codigoUfcd: string | null; cargaHoras: number };
  taxaPresenca?: number | null;
  elegivelCertificado?: boolean;
  hashConteudo?: string;
};

@Injectable()
export class CertificadoVerificacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async emitir(user: RequestUser, matriculaId: string): Promise<VerificacaoEmitResult> {
    const tenantId = requireTenantId(user);
    const matricula = await this.loadMatriculaContext(tenantId, matriculaId);
    const hashConteudo = this.hashConteudo(matricula);
    const codigoPublico = this.codigoPublicoFromMatricula(matriculaId);

    const existente = await this.prisma.certificadoVerificacao.findUnique({
      where: { matriculaId },
    });

    const { token, tokenHash } = this.newToken();
    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const reutilizado = existente?.hashConteudo === hashConteudo && !existente.revogadoEm;

    if (existente) {
      await this.prisma.certificadoVerificacao.update({
        where: { id: existente.id },
        data: {
          codigoPublico,
          tokenHash,
          hashConteudo,
          emitidoPorUserId: user.sub,
          emitidoEm: new Date(),
          revogadoEm: null,
        },
      });
    } else {
      await this.prisma.certificadoVerificacao.create({
        data: {
          tenantId,
          matriculaId,
          codigoPublico,
          tokenHash,
          hashConteudo,
          emitidoPorUserId: user.sub,
        },
      });
    }

    return {
      token,
      codigoPublico,
      verifyUrl: `${appUrl}/verificar/${token}`,
      emitidoEm: new Date(),
      reutilizado,
    };
  }

  async verificarPublico(tokenOrCodigo: string): Promise<VerificacaoPublica> {
    const row = await this.findByTokenOrCodigo(tokenOrCodigo);
    if (!row) {
      return {
        valido: false,
        codigoPublico: "",
        emitidoEm: "",
        motivo: "Código de verificação não encontrado.",
      };
    }

    if (row.revogadoEm) {
      return {
        valido: false,
        codigoPublico: row.codigoPublico,
        emitidoEm: row.emitidoEm.toISOString(),
        revogadoEm: row.revogadoEm.toISOString(),
        motivo: "Certificado revogado.",
      };
    }

    const matricula = await this.prisma.matricula.findUnique({
      where: { id: row.matriculaId },
      include: {
        formando: { select: { nome: true, nif: true } },
        turma: {
          include: {
            acaoFormacao: {
              include: {
                curso: { select: { designacao: true, codigoUfcd: true, cargaHoras: true } },
                tenant: { select: { legalName: true, nif: true } },
              },
            },
          },
        },
      },
    });

    if (!matricula) {
      return {
        valido: false,
        codigoPublico: row.codigoPublico,
        emitidoEm: row.emitidoEm.toISOString(),
        motivo: "Registo de matrícula inválido.",
      };
    }

    const acao = matricula.turma.acaoFormacao;
    const stats = await this.presencaStats(row.tenantId, row.matriculaId, acao.id);
    const elegivel = stats.taxaPresenca !== null && stats.taxaPresenca >= 60;

    const hashAtual = this.hashConteudo({
      formando: matricula.formando,
      acao,
      curso: acao.curso,
    });

    const integridadeOk = hashAtual === row.hashConteudo;

    return {
      valido: integridadeOk && elegivel,
      codigoPublico: row.codigoPublico,
      emitidoEm: row.emitidoEm.toISOString(),
      motivo: !integridadeOk
        ? "Conteúdo alterado desde a emissão – reemitir certificado."
        : !elegivel
          ? "Formando abaixo do limiar de presença."
          : undefined,
      formando: {
        nome: matricula.formando.nome,
        nif: matricula.formando.nif,
      },
      entidade: {
        legalName: acao.tenant.legalName,
        nif: acao.tenant.nif,
      },
      acao: {
        codigoInterno: acao.codigoInterno,
        titulo: acao.titulo,
        dataInicio: acao.dataInicio.toISOString().slice(0, 10),
        dataFim: acao.dataFim.toISOString().slice(0, 10),
      },
      curso: acao.curso,
      taxaPresenca: stats.taxaPresenca,
      elegivelCertificado: elegivel,
      hashConteudo: row.hashConteudo.slice(0, 12),
    };
  }

  async revogar(user: RequestUser, matriculaId: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.certificadoVerificacao.findFirst({
      where: { matriculaId, tenantId },
    });
    if (!row) {
      throw new NotFoundException("Verificação não encontrada.");
    }
    return this.prisma.certificadoVerificacao.update({
      where: { id: row.id },
      data: { revogadoEm: new Date() },
      select: { id: true, codigoPublico: true, revogadoEm: true },
    });
  }

  tokenHashFromOpaque(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async findByTokenOrCodigo(tokenOrCodigo: string) {
    if (tokenOrCodigo.startsWith("NF-")) {
      return this.prisma.certificadoVerificacao.findUnique({
        where: { codigoPublico: tokenOrCodigo.toUpperCase() },
      });
    }
    const tokenHash = this.tokenHashFromOpaque(tokenOrCodigo);
    return this.prisma.certificadoVerificacao.findUnique({
      where: { tokenHash },
    });
  }

  private newToken() {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    return { token, tokenHash };
  }

  private codigoPublicoFromMatricula(matriculaId: string): string {
    return `NF-${createHash("sha256").update(matriculaId).digest("hex").slice(0, 8).toUpperCase()}`;
  }

  private hashConteudo(input: {
    formando: { nome: string; nif: string };
    acao: { codigoInterno: string; titulo: string; dataInicio: Date; dataFim: Date };
    curso: { designacao: string; codigoUfcd: string | null; cargaHoras: number };
  }): string {
    const payload =
      `${input.formando.nif}|${input.formando.nome}|` +
      `${input.acao.codigoInterno}|${input.acao.titulo}|` +
      `${input.acao.dataInicio.toISOString().slice(0, 10)}|${input.acao.dataFim.toISOString().slice(0, 10)}|` +
      `${input.curso.designacao}|${input.curso.codigoUfcd ?? ""}|${input.curso.cargaHoras}`;
    return createHash("sha256").update(payload).digest("hex");
  }

  private async loadMatriculaContext(tenantId: string, matriculaId: string) {
    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      include: {
        formando: { select: { nome: true, nif: true } },
        turma: {
          include: {
            acaoFormacao: {
              include: { curso: { select: { designacao: true, codigoUfcd: true, cargaHoras: true } } },
            },
          },
        },
      },
    });
    if (!matricula) {
      throw new NotFoundException("Matrícula não encontrada.");
    }
    return {
      formando: matricula.formando,
      acao: matricula.turma.acaoFormacao,
      curso: matricula.turma.acaoFormacao.curso,
    };
  }

  private async presencaStats(tenantId: string, matriculaId: string, acaoId: string) {
    const presencas = await this.prisma.presenca.findMany({
      where: {
        tenantId,
        matriculaId,
        folhaPresenca: { sessao: { cronograma: { acaoFormacaoId: acaoId } } },
      },
      select: { presente: true },
    });
    if (!presencas.length) {
      return { taxaPresenca: null as number | null };
    }
    const presentes = presencas.filter((p) => p.presente).length;
    return { taxaPresenca: Math.round((presentes / presencas.length) * 100) };
  }
}
