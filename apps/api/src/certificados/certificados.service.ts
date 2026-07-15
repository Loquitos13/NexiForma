import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import QRCode from "qrcode";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { CertificadoVerificacaoService } from "./certificado-verificacao.service";
import { NotificacoesExtendedService } from "../notificacoes/notificacoes-extended.service";
import { SigoAccessService } from "../sigo/sigo-access.service";
import { resolverEmailNotificacaoFormando } from "@nexiforma/shared";

const PRESENCA_MINIMA_DEFAULT = 60;

@Injectable()
export class CertificadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificacao: CertificadoVerificacaoService,
    private readonly notificacoes: NotificacoesExtendedService,
    private readonly sigoAccess: SigoAccessService,
  ) {}

  async listByAcao(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      include: {
        curso: { select: { designacao: true, codigoUfcd: true, cargaHoras: true } },
        turmas: {
          include: {
            matriculas: {
              where: { estado: { in: ["ATIVA", "CONCLUSAO"] } },
              include: { formando: { select: { id: true, nome: true, nif: true, email: true, user: { select: { email: true } } } } },
            },
          },
        },
      },
    });
    if (!acao) {
      throw new NotFoundException("Acção não encontrada.");
    }

    const rows = acao.turmas.flatMap((t) =>
      t.matriculas.map((m) => ({
        matriculaId: m.id,
        formando: m.formando,
        turmaCodigo: t.codigo,
        estado: m.estado,
      })),
    );

    const enriched = await Promise.all(
      rows.map(async (r) => {
        const stats = await this.presencaStats(tenantId, r.matriculaId, acaoId);
        const elegivel =
          stats.taxaPresenca !== null && stats.taxaPresenca >= PRESENCA_MINIMA_DEFAULT;
        const verif = await this.prisma.certificadoVerificacao.findUnique({
          where: { matriculaId: r.matriculaId },
          select: { codigoPublico: true, emitidoEm: true, revogadoEm: true },
        });
        const sigo = await this.prisma.sigoCertificadoFormando.findFirst({
          where: { tenantId, matriculaId: r.matriculaId, estado: "DISPONIVEL" },
          orderBy: { sincronizadoEm: "desc" },
          select: {
            id: true,
            numeroCertificado: true,
            emitidoEm: true,
            storageKey: true,
            sigoReferencia: true,
          },
        });
        return {
          ...r,
          taxaPresenca: stats.taxaPresenca,
          elegivelCertificado: elegivel,
          limiarPresenca: PRESENCA_MINIMA_DEFAULT,
          codigoVerificacao: verif?.revogadoEm ? null : verif?.codigoPublico ?? null,
          certificadoSigo: sigo
            ? {
                id: sigo.id,
                numeroCertificado: sigo.numeroCertificado,
                emitidoEm: sigo.emitidoEm,
                temFicheiro: Boolean(sigo.storageKey),
                referencia: sigo.sigoReferencia,
              }
            : null,
        };
      }),
    );

    return {
      acao: {
        id: acao.id,
        codigoInterno: acao.codigoInterno,
        titulo: acao.titulo,
        curso: acao.curso,
      },
      formandos: enriched,
    };
  }

  async buildCertificadoHtml(user: RequestUser, matriculaId: string) {
    const tenantId = requireTenantId(user);
    if (user.role !== "formando") {
      await this.sigoAccess.assertAcao(user, tenantId, "emitirCertificadoLocal");
    }
    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      include: {
        formando: {
          select: {
            id: true,
            nome: true,
            nif: true,
            userId: true,
            email: true,
            telefone: true,
            user: { select: { email: true } },
          },
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
    });
    if (!matricula) {
      throw new NotFoundException("Matrícula não encontrada.");
    }
    if (user.role === "formando" && matricula.formando.userId !== user.sub) {
      throw new ForbiddenException("Só podes ver o teu certificado.");
    }

    const acao = matricula.turma.acaoFormacao;
    const stats = await this.presencaStats(tenantId, matriculaId, acao.id);
    const elegivel =
      stats.taxaPresenca !== null && stats.taxaPresenca >= PRESENCA_MINIMA_DEFAULT;

    const verif = await this.verificacao.emitir(user, matriculaId);

    if (!verif.reutilizado) {
      const formandoEmail = resolverEmailNotificacaoFormando({
        emailContacto: matricula.formando.email,
        emailConta: matricula.formando.user?.email,
      });
      if (formandoEmail) {
        void this.notificacoes
          .notificarCertificadoDisponivel(formandoEmail, matricula.formando.nome, {
            nomeCurso: acao.titulo,
            codigoFormacao: acao.codigoInterno,
            telefone: matricula.formando.telefone ?? undefined,
          })
          .catch(() => undefined);
      }
    }

    const qrDataUrl = await QRCode.toDataURL(verif.verifyUrl, {
      width: 120,
      margin: 1,
      color: { dark: "#1e40af", light: "#ffffff" },
    });

    const emitidoEm = new Date().toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Certificado – ${escapeHtml(matricula.formando.nome)}</title>
  <style>
    @page { size: A4 landscape; margin: 18mm; }
    body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; margin: 0; }
    .cert { border: 3px double #1e40af; padding: 2.5rem 3rem; min-height: 420px; position: relative; }
    .cert-header { text-align: center; margin-bottom: 1.5rem; }
    .cert-header h1 { font-size: 1.75rem; color: #1e3a8a; margin: 0 0 0.25rem; letter-spacing: 0.04em; }
    .cert-header p { margin: 0; color: #64748b; font-size: 0.95rem; }
    .cert-body { text-align: center; line-height: 1.7; font-size: 1.05rem; }
    .nome { font-size: 1.65rem; font-weight: 700; color: #1e293b; margin: 1rem 0; }
    .curso { font-size: 1.15rem; color: #334155; }
    .meta { margin-top: 2rem; display: flex; justify-content: space-between; font-size: 0.88rem; color: #64748b; }
    .selo { position: absolute; bottom: 2rem; right: 2.5rem; width: 90px; height: 90px; border: 2px solid #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; text-align: center; color: #2563eb; font-weight: 700; padding: 0.5rem; }
    .qr { position: absolute; bottom: 2rem; left: 2.5rem; text-align: center; font-size: 0.72rem; color: #64748b; }
    .qr img { display: block; width: 96px; height: 96px; margin: 0 auto 0.25rem; }
    .aviso { background: #fef3c7; border: 1px solid #f59e0b; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.9rem; color: #92400e; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <p class="no-print" style="font-family: sans-serif; font-size: 0.85rem; color: #64748b;">
    Imprime ou guarda como PDF (Ctrl+P). ${elegivel ? "" : "⚠ Formando abaixo do limiar de presença – certificado provisório."}
  </p>
  ${elegivel ? "" : `<div class="aviso no-print">Presença ${stats.taxaPresenca ?? 0}% – mínimo recomendado ${PRESENCA_MINIMA_DEFAULT}% para certificação DGERT.</div>`}
  <div class="cert">
    <div class="cert-header">
      <h1>CERTIFICADO DE FORMAÇÃO</h1>
      <p>${escapeHtml(acao.tenant.legalName)}${acao.tenant.nif ? ` · NIF ${escapeHtml(acao.tenant.nif)}` : ""}</p>
    </div>
    <div class="cert-body">
      <p>Certifica-se que</p>
      <p class="nome">${escapeHtml(matricula.formando.nome)}</p>
      <p>NIF ${escapeHtml(matricula.formando.nif)}</p>
      <p>concluiu com aproveitamento a acção de formação</p>
      <p class="curso"><strong>${escapeHtml(acao.titulo)}</strong></p>
      <p>integrada no curso <em>${escapeHtml(acao.curso.designacao)}</em>${acao.curso.codigoUfcd ? ` (UFCD ${escapeHtml(acao.curso.codigoUfcd)})` : ""} – ${acao.curso.cargaHoras} horas.</p>
      <p style="font-size: 0.92rem; color: #64748b;">
        Período: ${acao.dataInicio.toISOString().slice(0, 10)} a ${acao.dataFim.toISOString().slice(0, 10)}
        · Taxa de presença: ${stats.taxaPresenca ?? "–"}%
      </p>
    </div>
    <div class="meta">
      <span>Emitido em ${emitidoEm}</span>
      <span>Ref. ${escapeHtml(acao.codigoInterno)} · ${escapeHtml(verif.codigoPublico)}</span>
    </div>
    <div class="qr">
      <img src="${qrDataUrl}" alt="QR verificação"/>
      Verificar autenticidade
    </div>
    <div class="selo">NexiForma<br/>Formação<br/>Certificada</div>
  </div>
</body>
</html>`;

    return {
      filename: `certificado-${matricula.formando.nome.replace(/\s+/g, "-").toLowerCase()}.html`,
      html,
      elegivel,
      taxaPresenca: stats.taxaPresenca,
      verificacao: {
        codigoPublico: verif.codigoPublico,
        verifyUrl: verif.verifyUrl,
      },
    };
  }

  private async presencaStats(tenantId: string, matriculaId: string, acaoId: string) {
    const presencas = await this.prisma.presenca.findMany({
      where: {
        tenantId,
        matriculaId,
        folhaPresenca: {
          sessao: {
            cronograma: { acaoFormacaoId: acaoId },
          },
        },
      },
      select: { presente: true },
    });
    if (!presencas.length) {
      return { taxaPresenca: null as number | null, total: 0, presentes: 0 };
    }
    const presentes = presencas.filter((p) => p.presente).length;
    return {
      taxaPresenca: Math.round((presentes / presencas.length) * 100),
      total: presencas.length,
      presentes,
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
