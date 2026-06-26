import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  isEstadoPresenca,
  labelEstadoPresencaOuPorAssinalar,
  type EstadoPresenca,
} from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { requireTenantId } from "../common/tenant-scope";
import { escapeHtml } from "../cronogramas/cronograma-export.util";

type TenantMeta = {
  branding?: { logoUrl?: string; logoStorageKey?: string };
};

const ESTADO_CSS: Record<EstadoPresenca, string> = {
  PRESENTE: "#d1fae5",
  FALTA_JUSTIFICADA: "#fef3c7",
  FALTA_INJUSTIFICADA: "#fee2e2",
};

@Injectable()
export class FolhaPresencaHtmlExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly formadorScope: FormadorScopeService,
  ) {}

  async buildPrintableHtml(user: RequestUser, folhaId: string) {
    const tenantId = requireTenantId(user);

    const folha = await this.prisma.folhaPresenca.findFirst({
      where: { id: folhaId, tenantId },
      include: {
        turma: { select: { codigo: true, nome: true } },
        sessao: {
          select: {
            id: true,
            numeroSessao: true,
            data: true,
            horaInicio: true,
            horaFim: true,
            modalidade: true,
            iniciadaEm: true,
            terminadaEm: true,
            formadorPresente: true,
            formador: { select: { nomeCompleto: true } },
            cronograma: {
              select: {
                acaoFormacao: {
                  select: {
                    codigoInterno: true,
                    titulo: true,
                    curso: { select: { designacao: true, cargaHoras: true } },
                  },
                },
              },
            },
          },
        },
        presencas: {
          orderBy: { createdAt: "asc" },
          select: {
            estado: true,
            motivoJustificacao: true,
            minutosEfetivos: true,
            origem: true,
            matricula: {
              select: {
                formando: { select: { nome: true, nif: true } },
              },
            },
          },
        },
      },
    });

    if (!folha) {
      throw new NotFoundException("Folha de presença não encontrada.");
    }

    await this.formadorScope.assertCanAccessSessao(user, folha.sessao.id);

    if (!folha.validadaFormadorEm) {
      throw new BadRequestException(
        "A folha tem de ser validada pelo formador antes da exportação.",
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, nif: true, metadata: true },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const meta = (tenant.metadata ?? {}) as TenantMeta;
    const acao = folha.sessao.cronograma.acaoFormacao;
    const sessaoData = new Date(folha.sessao.data).toLocaleDateString("pt-PT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const turmaLabel = folha.turma
      ? `${folha.turma.codigo} – ${folha.turma.nome}`
      : "-";
    const validadaEm = folha.validadaFormadorEm.toLocaleString("pt-PT");
    const fechadaEm = folha.fechadaEm?.toLocaleString("pt-PT") ?? validadaEm;
    const aprovadaEm = folha.aprovadaGestorEm?.toLocaleString("pt-PT") ?? null;
    const inicioReal = folha.sessao.iniciadaEm?.toLocaleString("pt-PT") ?? "-";
    const fimReal = folha.sessao.terminadaEm?.toLocaleString("pt-PT") ?? "-";
    const formadorPresente =
      folha.sessao.formadorPresente === true
        ? "Presente"
        : folha.sessao.formadorPresente === false
          ? "Ausente"
          : "-";

    const rows = folha.presencas
      .map((p, idx) => {
        const estadoLabel = labelEstadoPresencaOuPorAssinalar(p.estado);
        const estado: EstadoPresenca | null = isEstadoPresenca(p.estado) ? p.estado : null;
        const bg = estado ? ESTADO_CSS[estado] : "#f1f5f9";
        return `<tr>
          <td class="c-num">${idx + 1}</td>
          <td class="c-nome">${escapeHtml(p.matricula.formando.nome)}</td>
          <td class="c-nif">${escapeHtml(p.matricula.formando.nif)}</td>
          <td class="c-est" style="background:${bg}">${escapeHtml(estadoLabel)}</td>
          <td class="c-mot">${escapeHtml(p.motivoJustificacao ?? "-")}</td>
          <td class="c-min">${p.minutosEfetivos != null ? p.minutosEfetivos : "-"}</td>
        </tr>`;
      })
      .join("");

    const presentes = folha.presencas.filter(
      (p) => isEstadoPresenca(p.estado) && p.estado === "PRESENTE",
    ).length;
    const total = folha.presencas.length;

    const logoSrc = await this.resolverLogoSrc(meta);
    const codigoTurma = folha.turma?.codigo ?? "turma";
    const filename = `presencas-sessao-${folha.sessao.numeroSessao}-${codigoTurma}.html`;

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Presenças – Sessão ${folha.sessao.numeroSessao}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    @media print { .no-print { display: none; } }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 10mm; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #333; padding: 4px 6px; vertical-align: middle; }
    .hdr { margin-bottom: 8px; }
    .hdr td { border: 1px solid #333; padding: 8px; vertical-align: middle; }
    .hdr .logo { width: 22%; text-align: center; }
    .hdr .logo img { max-height: 52px; max-width: 160px; object-fit: contain; }
    .hdr .titulo { width: 56%; font-size: 13pt; font-weight: bold; text-align: center; }
    .hdr .dgert { width: 22%; text-align: center; font-size: 7pt; font-weight: bold; color: #1a5276; }
    .meta td { text-align: left; font-size: 8pt; padding: 4px 6px; }
    .meta .lbl { font-weight: bold; white-space: nowrap; }
    .pres th { background: #f0f0f0; font-size: 8pt; text-align: center; }
    .pres .c-num { width: 5%; text-align: center; }
    .pres .c-nif { width: 12%; text-align: center; font-variant-numeric: tabular-nums; }
    .pres .c-est { width: 16%; text-align: center; font-weight: bold; }
    .pres .c-min { width: 8%; text-align: center; }
    .pres .c-mot { text-align: left; font-size: 8pt; }
    .pres .c-nome { text-align: left; }
    .sum { margin-top: 8px; font-size: 8pt; }
    .foot { margin-top: 10px; font-size: 7.5pt; color: #444; }
    .no-print { margin-bottom: 8px; }
    .no-print button { background: #2563eb; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="no-print"><button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>

  <table class="hdr">
    <tr>
      <td class="logo">${logoSrc ? `<img src="${logoSrc}" alt="Logo"/>` : `<strong>${escapeHtml(tenant.legalName)}</strong>`}</td>
      <td class="titulo">FOLHA DE PRESENÇAS</td>
      <td class="dgert">REGISTO DE ASSIDUIDADE</td>
    </tr>
  </table>

  <table class="meta">
    <tr>
      <td><span class="lbl">Entidade:</span> ${escapeHtml(tenant.legalName)}</td>
      <td><span class="lbl">Acção:</span> ${escapeHtml(acao.titulo)}</td>
      <td><span class="lbl">Curso:</span> ${escapeHtml(acao.curso.designacao)}</td>
    </tr>
    <tr>
      <td><span class="lbl">Turma:</span> ${escapeHtml(turmaLabel)}</td>
      <td><span class="lbl">Sessão n.º:</span> ${folha.sessao.numeroSessao}</td>
      <td><span class="lbl">Data:</span> ${escapeHtml(sessaoData)}</td>
    </tr>
    <tr>
      <td><span class="lbl">Horário planeado:</span> ${escapeHtml(folha.sessao.horaInicio)} – ${escapeHtml(folha.sessao.horaFim)}</td>
      <td><span class="lbl">Início efectivo:</span> ${escapeHtml(inicioReal)}</td>
      <td><span class="lbl">Fim efectivo:</span> ${escapeHtml(fimReal)}</td>
    </tr>
    <tr>
      <td><span class="lbl">Modalidade:</span> ${escapeHtml(folha.sessao.modalidade)}</td>
      <td><span class="lbl">Formador:</span> ${escapeHtml(folha.sessao.formador?.nomeCompleto ?? "-")}</td>
      <td><span class="lbl">Formador na sessão:</span> ${escapeHtml(formadorPresente)}</td>
    </tr>
    <tr>
      <td colspan="3">
        <span class="lbl">Validada pelo formador:</span> ${escapeHtml(validadaEm)}
        &nbsp;·&nbsp; <span class="lbl">Folha fechada:</span> ${escapeHtml(fechadaEm)}
        ${aprovadaEm ? ` &nbsp;·&nbsp; <span class="lbl">Aprovada pelo gestor:</span> ${escapeHtml(aprovadaEm)}` : ""}
      </td>
    </tr>
  </table>

  <table class="pres" style="margin-top:8px">
    <thead>
      <tr>
        <th>N.º</th>
        <th>Formando</th>
        <th>NIF</th>
        <th>Assiduidade</th>
        <th>Motivo (falta justificada)</th>
        <th>Min. efectivos</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="6" style="text-align:center;padding:8px">Sem formandos na turma.</td></tr>`}
    </tbody>
  </table>

  <p class="sum"><strong>Resumo:</strong> ${presentes} presente(s) de ${total} formando(s) na turma.</p>
  <p class="foot">Documento gerado em ${escapeHtml(new Date().toLocaleString("pt-PT"))} · NexiForma</p>
</body>
</html>`;

    return { html, filename };
  }

  private async resolverLogoSrc(meta: TenantMeta): Promise<string | null> {
    const key = meta.branding?.logoStorageKey;
    if (key) {
      const obj = await this.storage.getObject(key);
      if (obj) {
        const b64 = obj.body.toString("base64");
        return `data:${obj.contentType};base64,${b64}`;
      }
    }
    const url = meta.branding?.logoUrl?.trim();
    if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:"))) {
      return url;
    }
    return null;
  }
}
