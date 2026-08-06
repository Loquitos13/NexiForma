import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { escapeHtml } from "./cronograma-export.util";
import {
  buildVngColumns,
  buildVngFaixas,
  buildVngLegenda,
  buildVngMonthSpans,
  cronogramaTituloFuncionamento,
  formatHorarioFaixa,
  groupFaixasForRender,
  toLocalDateKey,
  VNG_FAIXA_CORES,
  VNG_PRAZO_COR,
  VNG_PRAZO_TEXTO,
  type VngModuloRef,
  type VngPrazoInput,
  type VngSessaoInput,
} from "./cronograma-vng-export.util";

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
            prazosModuloLms: {
              include: {
                moduloUnidade: {
                  select: { id: true, codigo: true, titulo: true, ordem: true },
                },
              },
            },
          },
        },
        sessoes: {
          orderBy: [{ data: "asc" }, { numeroSessao: "asc" }],
          include: {
            formador: { select: { id: true, nomeCompleto: true } },
            moduloUnidade: {
              select: { id: true, codigo: true, titulo: true, ordem: true },
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
    const cfg = meta.cronograma ?? {};

    const modulosDb = await this.prisma.moduloUnidade.findMany({
      where: { tenantId, cursoId: curso.id },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      select: { id: true, codigo: true, titulo: true, ordem: true },
    });
    const modulosCurso: VngModuloRef[] = modulosDb.map((m) => ({
      id: m.id,
      codigo: m.codigo,
      titulo: m.titulo,
      ordem: m.ordem,
    }));

    const sessoesInput: VngSessaoInput[] = cronograma.sessoes.map((s) => ({
      data: s.data,
      horaInicio: s.horaInicio,
      horaFim: s.horaFim,
      modalidade: s.modalidade,
      titulo: s.titulo,
      numeroSessao: s.numeroSessao,
      modulo: s.moduloUnidade
        ? {
            id: s.moduloUnidade.id,
            codigo: s.moduloUnidade.codigo,
            titulo: s.moduloUnidade.titulo,
            ordem: s.moduloUnidade.ordem,
          }
        : null,
    }));

    const prazosInput: VngPrazoInput[] = acao.prazosModuloLms.map((p) => ({
      data: p.prazoConclusao,
      modulo: {
        id: p.moduloUnidade.id,
        codigo: p.moduloUnidade.codigo,
        titulo: p.moduloUnidade.titulo,
        ordem: p.moduloUnidade.ordem,
      },
    }));

    const inicioKey = toLocalDateKey(acao.dataInicio);
    const fimKey = toLocalDateKey(acao.dataFim);
    let rangeInicio = inicioKey;
    let rangeFim = fimKey;
    for (const s of sessoesInput) {
      const k = toLocalDateKey(s.data);
      if (compareKey(k, rangeInicio) < 0) rangeInicio = k;
      if (compareKey(k, rangeFim) > 0) rangeFim = k;
    }
    for (const p of prazosInput) {
      const k = toLocalDateKey(p.data);
      if (compareKey(k, rangeInicio) < 0) rangeInicio = k;
      if (compareKey(k, rangeFim) > 0) rangeFim = k;
    }

    const columns = buildVngColumns(rangeInicio, rangeFim);
    const monthSpans = buildVngMonthSpans(columns);
    const faixas = buildVngFaixas(sessoesInput, modulosCurso, prazosInput);
    const faixasRender = groupFaixasForRender(faixas);
    const legenda = buildVngLegenda(sessoesInput, modulosCurso, faixas);

    const logoSrc = await this.resolverLogoSrc(meta);
    const local = cfg.local?.trim() || "A definir";
    const tituloCronograma = cronogramaTituloFuncionamento(cfg.funcionamento);
    const filename = `cronograma-${acao.codigoInterno}-v${cronograma.versao}.html`;

    const monthHeaderCells = monthSpans
      .map(
        (m) =>
          `<th class="mes" colspan="${m.colSpan}">${escapeHtml(m.label)}</th>`,
      )
      .join("");
    const dayHeaderCells = columns
      .map((c) => `<th class="dia">${c.day}</th>`)
      .join("");
    const weekdayHeaderCells = columns
      .map((c) => `<th class="dow">${escapeHtml(c.weekday)}</th>`)
      .join("");

    const bodyRows = faixasRender
      .map(({ faixa, showGrupo, grupoRowSpan }) => {
        const bg = VNG_FAIXA_CORES[faixa.tipo];
        const horario = formatHorarioFaixa(faixa);
        const grupoTd = showGrupo
          ? `<td class="grupo" rowspan="${grupoRowSpan}">${escapeHtml(faixa.grupoLabel)}</td>`
          : "";
        const horarioTd =
          faixa.tipo === "auto"
            ? `<td class="horario auto-h"></td>`
            : `<td class="horario">${escapeHtml(horario)}</td>`;
        const cells = columns
          .map((c) => {
            const cell = faixa.cells[c.dateKey];
            if (!cell) return `<td class="empty"></td>`;
            if (cell.isPrazo) {
              return `<td class="cel prazo" style="background:${VNG_PRAZO_COR};color:${VNG_PRAZO_TEXTO}"><span>${escapeHtml(cell.label)}</span></td>`;
            }
            return `<td class="cel ${faixa.tipo}" style="background:${bg}"><span>${escapeHtml(cell.label)}</span></td>`;
          })
          .join("");
        return `<tr>${grupoTd}${horarioTd}${cells}</tr>`;
      })
      .join("");

    const legendaTipos = `
      <div class="leg-tipos">
        <span class="swatch" style="background:${VNG_FAIXA_CORES.presencial}"></span>
        Aulas presenciais em sala referentes a cada módulo
        <span class="swatch" style="background:${VNG_FAIXA_CORES.sincrona}"></span>
        Sessões em vídeo-conferência (síncronas)
        <span class="swatch" style="background:${VNG_FAIXA_CORES.auto}"></span>
        Sessões em e-learning / auto-aprendizagem
        <span class="swatch" style="background:${VNG_PRAZO_COR}"></span>
        Data limite para conclusão das tarefas do(s) módulo(s)
      </div>`;

    const legendaCodigos = legenda
      .map(
        (item) =>
          `<div class="leg-item"><strong>${escapeHtml(item.codigo)}</strong> ${escapeHtml(item.titulo)}</div>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Cronograma – ${escapeHtml(acao.titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 6mm; }
    @media print {
      .no-print { display: none !important; }
      html, body { width: 100%; height: auto; overflow: hidden; }
      body { padding: 0; }
      .sheet { width: 100%; max-height: none; overflow: visible; }
      table.grelha { page-break-inside: avoid; }
      .legenda { page-break-inside: avoid; }
    }
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8pt;
      color: #111;
      margin: 0;
      padding: 4mm;
    }
    .sheet { width: 100%; max-width: 100%; overflow: hidden; }
    .no-print { margin-bottom: 6px; }
    .no-print button {
      background: #2563eb; color: #fff; border: none;
      padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 10pt;
    }
    .top {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 8px; margin-bottom: 4px; border-bottom: 2px solid #1a5276; padding-bottom: 4px;
    }
    .top .entidade { flex: 1; font-size: 7.5pt; line-height: 1.3; }
    .top .entidade strong { font-size: 9pt; display: block; margin-bottom: 1px; }
    .top .logo img { max-height: 36px; max-width: 110px; object-fit: contain; }
    h1 {
      font-size: 11pt; margin: 0 0 1px; color: #1a5276; font-weight: bold;
    }
    h2 {
      font-size: 8.5pt; margin: 0 0 4px; font-weight: bold; text-transform: uppercase;
    }
    .meta {
      display: grid; grid-template-columns: 1.2fr 1fr; gap: 2px 12px;
      margin-bottom: 6px; font-size: 7.5pt;
    }
    .meta .lbl { font-weight: bold; }
    .grelha-wrap { width: 100%; max-width: 100%; overflow: hidden; }
    table.grelha {
      border-collapse: collapse;
      width: 100%;
      max-width: 100%;
      table-layout: fixed;
    }
    table.grelha th, table.grelha td {
      border: 1px solid #444; padding: 2px 1px; text-align: center;
      vertical-align: middle; font-size: 6.5pt;
      overflow: hidden;
    }
    table.grelha th.mes {
      background: #1a5276; color: #fff; font-size: 7.5pt; font-weight: bold; padding: 3px 1px;
    }
    table.grelha th.dia {
      background: #e8eef4; font-weight: bold; font-size: 7pt;
    }
    table.grelha th.dow {
      background: #f5f5f5; font-size: 6pt; color: #444; font-weight: normal;
    }
    table.grelha col.col-grupo { width: 9%; }
    table.grelha col.col-horario { width: 10%; }
    table.grelha td.grupo {
      text-align: left; font-weight: bold; font-size: 6.5pt;
      background: #f0f4f8; padding: 3px 2px;
      word-break: break-word; hyphens: auto;
    }
    table.grelha td.horario {
      text-align: left; font-size: 6.5pt;
      background: #fafafa; padding: 3px 2px;
      word-break: break-word; white-space: normal;
    }
    table.grelha td.auto-h { background: #fffef5; }
    table.grelha td.cel {
      font-weight: bold; font-size: 6.5pt; line-height: 1.1;
    }
    table.grelha td.cel span {
      display: block; padding: 1px 0; word-break: break-word;
      overflow-wrap: anywhere;
    }
    table.grelha td.cel.prazo { font-weight: bold; }
    table.grelha td.empty { background: #fff; }
    .legenda { margin-top: 6px; font-size: 7pt; }
    .legenda h3 { font-size: 8pt; margin: 0 0 4px; }
    .leg-tipos { margin-bottom: 4px; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
    .swatch {
      display: inline-block; width: 11px; height: 11px; border: 1px solid #666;
      margin-right: 3px; vertical-align: middle;
    }
    .leg-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1px 10px;
    }
    .leg-item { padding: 1px 0; }
    .leg-item strong {
      display: inline-block; min-width: 52px; margin-right: 4px;
      padding: 1px 3px; background: #eef3f8; border: 1px solid #99a;
      font-size: 6.5pt;
    }
    .empty-msg { color: #666; font-size: 8pt; padding: 8px 0; }
  </style>
</head>
<body>
  <div class="no-print"><button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>
  <div class="sheet">
  <div class="top">
    <div class="entidade">
      <strong>${escapeHtml(tenant.legalName)}</strong>
      ${tenant.nif ? `NIF ${escapeHtml(tenant.nif)}` : ""}
    </div>
    ${logoSrc ? `<div class="logo"><img src="${logoSrc}" alt="Logo"/></div>` : ""}
  </div>

  <h1>${escapeHtml(tituloCronograma)}</h1>
  <h2>${escapeHtml(curso.designacao || acao.titulo)}</h2>

  <div class="meta">
    <div><span class="lbl">Local de realização:</span> ${escapeHtml(local)}</div>
    <div><span class="lbl">Data de início:</span> ${formatDatePt(inicioKey)}</div>
    <div><span class="lbl">Acção:</span> ${escapeHtml(acao.codigoInterno)} – ${escapeHtml(acao.titulo)}</div>
    <div><span class="lbl">Data de fim:</span> ${formatDatePt(fimKey)}</div>
  </div>

  ${
    columns.length === 0 || faixas.length === 0
      ? `<p class="empty-msg">Sem sessões no período para construir a grelha.</p>`
      : `<div class="grelha-wrap"><table class="grelha">
    <colgroup>
      <col class="col-grupo"/>
      <col class="col-horario"/>
      ${columns.map(() => "<col/>").join("")}
    </colgroup>
    <thead>
      <tr>
        <th class="grupo" rowspan="3" colspan="2">Horário</th>
        ${monthHeaderCells}
      </tr>
      <tr>${dayHeaderCells}</tr>
      <tr>${weekdayHeaderCells}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table></div>`
  }

  <div class="legenda">
    <h3>Legenda</h3>
    ${legendaTipos}
    <div class="leg-grid">${legendaCodigos || "<div>Sem códigos de sessão.</div>"}</div>
  </div>
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

function compareKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function formatDatePt(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${d}/${m}/${y}`;
}
