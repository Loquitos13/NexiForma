import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import {
  atribuirCoresFormadores,
  codigoModuloFallback,
  construirGrelhaMes,
  escapeHtml,
  horasEntre,
  iterarMeses,
  mesLabelPt,
  toDateKey,
} from "./cronograma-export.util";

type TenantMeta = {
  branding?: { logoUrl?: string; logoStorageKey?: string };
  cronograma?: {
    local?: string;
    horarioInicio?: string;
    horarioFim?: string;
    horarioSabadoInicio?: string;
    horarioSabadoFim?: string;
    funcionamento?: "laboral" | "pos_laboral" | "misto";
    metodologias?: string[];
  };
};

@Injectable()
export class CronogramaHtmlExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async buildPrintableHtml(user: RequestUser, cronogramaId: string) {
    const tenantId = requireTenantId(user);

    const cronograma = await this.prisma.cronograma.findFirst({
      where: { id: cronogramaId, tenantId },
      include: {
        acaoFormacao: {
          include: {
            curso: true,
            turmas: { take: 1, orderBy: { codigo: "asc" } },
          },
        },
        sessoes: {
          orderBy: [{ data: "asc" }, { numeroSessao: "asc" }],
          include: {
            formador: { select: { id: true, nomeCompleto: true } },
            moduloUnidade: {
              select: { id: true, codigo: true, titulo: true, formadorId: true },
            },
          },
        },
      },
    });

    if (!cronograma) {
      throw new NotFoundException("Cronograma não encontrado.");
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, nif: true, metadata: true },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const meta = (tenant.metadata ?? {}) as TenantMeta;
    const acao = cronograma.acaoFormacao;
    const curso = acao.curso;

    const modulos = await this.prisma.moduloUnidade.findMany({
      where: { tenantId, cursoId: curso.id },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      include: { formador: { select: { id: true, nomeCompleto: true } } },
    });

    const formadorIds = new Set<string>();
    for (const m of modulos) {
      if (m.formadorId) formadorIds.add(m.formadorId);
    }
    for (const s of cronograma.sessoes) {
      if (s.formadorId) formadorIds.add(s.formadorId);
      if (s.moduloUnidade?.formadorId) formadorIds.add(s.moduloUnidade.formadorId);
    }
    const cores = atribuirCoresFormadores([...formadorIds]);

    const horasPorModulo = new Map<string, number>();
    for (const s of cronograma.sessoes) {
      if (!s.moduloUnidadeId) continue;
      const h = horasEntre(s.horaInicio, s.horaFim);
      horasPorModulo.set(s.moduloUnidadeId, (horasPorModulo.get(s.moduloUnidadeId) ?? 0) + h);
    }

    const modulosRows = modulos
      .map((m) => {
        const codigo = m.codigo?.trim() || codigoModuloFallback(m.titulo);
        const horas = m.cargaHoras ?? horasPorModulo.get(m.id) ?? 0;
        const fid = m.formadorId ?? "";
        const bg = fid ? cores.get(fid) ?? "#e2e8f0" : "#f1f5f9";
        const formadorNome = m.formador?.nomeCompleto ?? "-";
        return `<tr>
          <td class="c-cod">${escapeHtml(codigo)}</td>
          <td>${escapeHtml(m.titulo)}</td>
          <td class="c-num">${horas ? Math.round(horas * 10) / 10 : "-"}</td>
          <td class="c-form" style="background:${bg}">${escapeHtml(formadorNome)}</td>
        </tr>`;
      })
      .join("");

    const sessoesPorDia = new Map<string, Array<{ label: string; bg: string }>>();
    for (const s of cronograma.sessoes) {
      const key = toDateKey(s.data);
      const codigo =
        s.moduloUnidade?.codigo?.trim() ||
        (s.moduloUnidade?.titulo ? codigoModuloFallback(s.moduloUnidade.titulo) : `S${s.numeroSessao}`);
      const horas = Math.round(horasEntre(s.horaInicio, s.horaFim) * 10) / 10;
      const fid = s.formadorId ?? s.moduloUnidade?.formadorId ?? "";
      const bg = fid ? cores.get(fid) ?? "#b8d4f0" : "#b8d4f0";
      const horasTxt = Number.isInteger(horas)
        ? `${horas}h`
        : `${horas.toFixed(1).replace(".", ",").replace(/,0$/, "")}h`;
      const label = `${codigo} (${horasTxt})`;
      const arr = sessoesPorDia.get(key) ?? [];
      arr.push({ label, bg });
      sessoesPorDia.set(key, arr);
    }

    const meses = iterarMeses(toDateKey(acao.dataInicio), toDateKey(acao.dataFim));
    const grelhasHtml = meses
      .map(({ year, month }) => {
        const cells = construirGrelhaMes(year, month, sessoesPorDia);
        const headerDays = Array.from({ length: 31 }, (_, i) => `<th>${i + 1}</th>`).join("");
        const bodyCells = cells
          .map((c) => {
            if (c.tipo === "invalido") return `<td class="inv"></td>`;
            if (c.tipo === "fds") return `<td class="fds">${c.fds}</td>`;
            if (c.tipo === "sessao") {
              return `<td class="ses" style="background:${c.bg}"><span>${escapeHtml(c.label ?? "")}</span></td>`;
            }
            return `<td></td>`;
          })
          .join("");
        return `<table class="cal">
          <caption>${escapeHtml(mesLabelPt(year, month))}</caption>
          <thead><tr>${headerDays}</tr></thead>
          <tbody><tr>${bodyCells}</tr></tbody>
        </table>`;
      })
      .join("");

    const logoSrc = await this.resolverLogoSrc(meta);
    const cfg = meta.cronograma ?? {};
    const funcionamento = cfg.funcionamento ?? "pos_laboral";
    const metodologias = cfg.metodologias ?? ["formacao_acao"];
    const turma = acao.turmas[0];
    const codigoAcao = turma?.codigo ?? acao.codigoInterno;

    const horarioInicio = cfg.horarioInicio ?? cronograma.sessoes[0]?.horaInicio ?? "-";
    const horarioFim = cfg.horarioFim ?? cronograma.sessoes[0]?.horaFim ?? "-";
    const sabInicio = cfg.horarioSabadoInicio?.trim();
    const sabFim = cfg.horarioSabadoFim?.trim();
    const horarioSabadoHtml =
      sabInicio && sabFim
        ? ` · Sábados ${escapeHtml(sabInicio)} – ${escapeHtml(sabFim)}`
        : "";

    const filename = `cronograma-${acao.codigoInterno}-v${cronograma.versao}.html`;

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Cronograma – ${escapeHtml(acao.titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    @media print { .no-print { display: none; } }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #111; margin: 0; padding: 8mm; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #333; padding: 2px 3px; vertical-align: middle; text-align: center; }
    .hdr { margin-bottom: 6px; }
    .hdr td { border: 1px solid #333; padding: 6px; vertical-align: middle; }
    .hdr .logo { width: 22%; text-align: center; }
    .hdr .logo img { max-height: 52px; max-width: 160px; object-fit: contain; }
    .hdr .titulo { width: 56%; font-size: 13pt; font-weight: bold; text-align: center; }
    .hdr .dgert { width: 22%; text-align: center; font-size: 7pt; font-weight: bold; color: #1a5276; }
    .meta td { text-align: left; font-size: 7.5pt; padding: 3px 5px; }
    .meta .lbl { font-weight: bold; white-space: nowrap; }
    .mods th { background: #f0f0f0; font-size: 7pt; }
    .mods .c-cod { width: 8%; font-weight: bold; }
    .mods .c-num { width: 8%; }
    .mods .c-form { text-align: left; font-size: 7pt; }
    .chk { display: inline-flex; align-items: center; gap: 3px; margin-right: 10px; font-size: 7pt; }
    .chk input { margin: 0; }
    .cals { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
    .cal { font-size: 6pt; }
    .cal caption { font-weight: bold; text-align: left; padding: 2px 0; font-size: 7pt; }
    .cal th { background: #eee; padding: 1px; min-width: 14px; }
    .cal td { height: 22px; min-width: 14px; padding: 0; font-size: 5.5pt; font-weight: bold; }
    .cal td.inv { background: #111; }
    .cal td.fds { background: #d9d9d9; color: #555; }
    .cal td.ses span { display: block; line-height: 1.1; padding: 1px; }
    .no-print { margin-bottom: 8px; }
    .no-print button { background: #2563eb; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="no-print"><button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>

  <table class="hdr">
    <tr>
      <td class="logo">${logoSrc ? `<img src="${logoSrc}" alt="Logo"/>` : `<strong>${escapeHtml(tenant.legalName)}</strong>`}</td>
      <td class="titulo">CRONOGRAMA DA ACÇÃO DE FORMAÇÃO</td>
      <td class="dgert">ENTIDADE CERTIFICADA<br/>DGERT</td>
    </tr>
  </table>

  <table class="meta">
    <tr>
      <td><span class="lbl">Entidade:</span> ${escapeHtml(tenant.legalName)}</td>
      <td><span class="lbl">Acção:</span> ${escapeHtml(curso.designacao)}</td>
      <td><span class="lbl">Nº:</span> ${escapeHtml(codigoAcao)}</td>
    </tr>
    <tr>
      <td><span class="lbl">Local:</span> ${escapeHtml(cfg.local ?? "A definir")}</td>
      <td><span class="lbl">Duração:</span> ${curso.cargaHoras} horas</td>
      <td>
        <span class="lbl">Horário:</span>
        Início ${escapeHtml(horarioInicio)}
        Fim ${escapeHtml(horarioFim)}${horarioSabadoHtml}
      </td>
    </tr>
    <tr>
      <td colspan="3">
        <span class="lbl">Funcionamento:</span>
        <label class="chk"><input type="checkbox" ${funcionamento === "laboral" ? "checked" : ""} disabled/> Laboral</label>
        <label class="chk"><input type="checkbox" ${funcionamento === "pos_laboral" ? "checked" : ""} disabled/> Pós-Laboral</label>
        <label class="chk"><input type="checkbox" ${funcionamento === "misto" ? "checked" : ""} disabled/> Misto</label>
        &nbsp;&nbsp;
        <span class="lbl">Metodologias:</span>
        <label class="chk"><input type="checkbox" ${metodologias.includes("elearning") ? "checked" : ""} disabled/> Formação à distância</label>
        <label class="chk"><input type="checkbox" ${metodologias.includes("formacao_acao") ? "checked" : ""} disabled/> Formação-Acção</label>
        <label class="chk"><input type="checkbox" ${metodologias.includes("outras") ? "checked" : ""} disabled/> Outras</label>
      </td>
    </tr>
  </table>

  <table class="mods" style="margin-top:6px">
    <thead>
      <tr><th>Código</th><th>Módulos</th><th>Nr Horas</th><th>Formador</th></tr>
    </thead>
    <tbody>
      ${modulosRows || `<tr><td colspan="4" style="text-align:left;padding:6px">Sem módulos definidos no curso.</td></tr>`}
    </tbody>
  </table>

  <div class="cals">${grelhasHtml || "<p>Sem período de formação definido.</p>"}</div>
  <p style="margin-top:8px;font-size:6.5pt;color:#555">Legenda calendário: código da sessão ou módulo (ex.: S1 = sessão 1) e duração em horas. Células «S»/«D» = fim de semana sem formação.</p>
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
