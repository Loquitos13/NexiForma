import {
  formatarMotivoIsencaoAt,
} from "@nexiforma/shared";
import {
  FATURA_TEMPLATE_CORES_DEFAULT,
  faturaHeaderBackground,
  type FaturaTemplateCores,
} from "./fatura-template-cores.util";

export type FaturaDocumentoLinha = {
  descricao: string;
  quantidade: number;
  precoUnitCentavos: number;
  descontoPercent: number;
  taxaIva: number;
  valorIvaCentavos: number;
  codigoIsencaoIva: string | null;
};

export type FaturaDocumentoExemplar = "ORIGINAL" | "DUPLICADO";

export type FaturaDocumentoInput = {
  tipoSerie: string;
  tipoDocumentoLabel: string;
  numeroDocumento: string;
  codigoAtcud: string;
  dataEmissao: Date;
  dataVencimento: Date | null;
  /** ORIGINAL (cliente) | DUPLICADO (arquivo interno / tenant) */
  exemplar?: FaturaDocumentoExemplar;
  emitente: {
    nomeEmpresa: string;
    moradaFiscal: string | null;
    nifEmitente: string;
    iban: string | null;
    bicSwift: string | null;
    emailGestor: string | null;
    capitalSocial: string | null;
    consRegCom: string | null;
  };
  destinatario: {
    nome: string;
    nif: string;
    morada: string | null;
    email: string | null;
  };
  moradaCarga: string;
  moradaDescarga: string;
  linhas: FaturaDocumentoLinha[];
  notas: string | null;
  valorCentavos: number;
  ivaCentavos: number;
  retencaoCentavos: number;
  hashIntegridade: string | null;
  softwareCertificado: string | null;
  qrDataUrl: string;
  /** data-URI ou URL https do logo do tenant */
  logoSrc?: string | null;
  cores?: FaturaTemplateCores;
  /** Metadados internos para nome de ficheiro */
  serieCodigo: string;
  numero: number;
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtEuro(cents: number): string {
  return (cents / 100).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtQuantidade(q: number): string {
  return q.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtData(iso: Date): string {
  return iso.toISOString().slice(0, 10);
}

function linhaBase(l: FaturaDocumentoLinha): number {
  const bruto = Math.round(l.quantidade * l.precoUnitCentavos);
  const desc = Math.min(100, Math.max(0, l.descontoPercent ?? 0));
  if (desc <= 0) return bruto;
  return Math.round(bruto * (1 - desc / 100));
}

function linhaTotal(l: FaturaDocumentoLinha): number {
  return linhaBase(l) + l.valorIvaCentavos;
}

/** HTML imprimível alinhado ao layout do portal (FaturaInlineEditor). */
export function buildFaturaDocumentoHtml(input: FaturaDocumentoInput): string {
  const totalLiquido = input.valorCentavos + input.ivaCentavos - input.retencaoCentavos;
  const hashFooter = input.hashIntegridade?.trim().slice(0, 4) ?? "----";
  const vencimento = input.dataVencimento
    ? input.dataVencimento.toLocaleDateString("pt-PT")
    : "-";
  const exemplar = input.exemplar === "DUPLICADO" ? "DUPLICADO" : "ORIGINAL";
  const cores = input.cores ?? FATURA_TEMPLATE_CORES_DEFAULT;
  const headerBg = faturaHeaderBackground(cores);

  const isencoesUsadas = new Map<string, number>();
  let refCounter = 0;
  const refPorLinha = new Map<number, number>();
  input.linhas.forEach((l, idx) => {
    if (l.taxaIva <= 0 && l.codigoIsencaoIva) {
      const key = l.codigoIsencaoIva.toUpperCase();
      if (!isencoesUsadas.has(key)) {
        refCounter += 1;
        isencoesUsadas.set(key, refCounter);
      }
      refPorLinha.set(idx, isencoesUsadas.get(key)!);
    }
  });

  const resumoIva = new Map<number, { base: number; iva: number }>();
  for (const l of input.linhas) {
    const prev = resumoIva.get(l.taxaIva) ?? { base: 0, iva: 0 };
    resumoIva.set(l.taxaIva, {
      base: prev.base + linhaBase(l),
      iva: prev.iva + l.valorIvaCentavos,
    });
  }

  const linhasHtml = input.linhas
    .map((l, idx) => {
      const ref = refPorLinha.get(idx);
      const ivaCell = ref
        ? `${l.taxaIva.toFixed(2)} <sup style="color:#7c3aed">(${ref})</sup>`
        : l.taxaIva.toFixed(2);
      const descCell = (l.descontoPercent ?? 0).toFixed(2).replace(".", ",");

      return `<tr>
        <td>
          <div class="line-desc">${escapeHtml(l.descricao)}</div>
        </td>
        <td class="num">${fmtQuantidade(l.quantidade)}</td>
        <td class="num">${fmtEuro(l.precoUnitCentavos)}</td>
        <td class="num ${l.descontoPercent > 0 ? "" : "muted"}">${descCell}</td>
        <td class="num">${ivaCell}</td>
        <td class="num bold">${fmtEuro(linhaTotal(l))}</td>
      </tr>`;
    })
    .join("");

  const isencoesHtml =
    isencoesUsadas.size > 0
      ? `<div class="iva-box">
      <p class="section-label">Condições de Enquadramento de IVA</p>
      <ul class="iva-list">${[...isencoesUsadas.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(
          ([code, ref]) =>
            `<li><span class="iva-ref">(${ref})</span> ${escapeHtml(formatarMotivoIsencaoAt(code))}</li>`,
        )
        .join("")}</ul>
    </div>`
      : "";

  const resumoIvaHtml = [...resumoIva.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([taxa, vals]) =>
        `<div class="summary-row">
          <span>IVA ${taxa.toFixed(2).replace(".", ",")}% (Incidência: ${fmtEuro(vals.base)})</span>
          <span>${fmtEuro(vals.iva)} €</span>
        </div>`,
    )
    .join("");

  const emitenteExtras = [
    input.emitente.capitalSocial
      ? `<p><span class="muted">Capital social </span>${escapeHtml(input.emitente.capitalSocial)}</p>`
      : "",
    input.emitente.consRegCom
      ? `<p><span class="muted">Conservatória do Registo Comercial </span>${escapeHtml(input.emitente.consRegCom)}</p>`
      : "",
    input.emitente.iban
      ? `<p class="mono">IBAN ${escapeHtml(input.emitente.iban)}</p>`
      : "",
    input.emitente.bicSwift
      ? `<p class="mono">BIC/SWIFT ${escapeHtml(input.emitente.bicSwift)}</p>`
      : "",
    input.emitente.emailGestor
      ? `<p>${escapeHtml(input.emitente.emailGestor)}</p>`
      : "",
  ].join("");

  const logoHtml =
    input.logoSrc &&
    (input.logoSrc.startsWith("data:") ||
      input.logoSrc.startsWith("http://") ||
      input.logoSrc.startsWith("https://"))
      ? `<img class="tenant-logo" src="${input.logoSrc}" alt="Logo"/>`
      : `<div class="tenant-logo-placeholder"></div>`;

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(input.tipoDocumentoLabel)} Nº ${escapeHtml(input.numeroDocumento)}</title>
  <style>
    @page { size: A4; margin: 10mm 12mm; }
    @media print { .no-print { display: none !important; } }
    * { box-sizing: border-box; border-radius: 0 !important; }
    html, body {
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #171717;
      background: #fff;
      font-size: 10.5pt;
      line-height: 1.35;
    }
    .doc {
      width: 100%;
      display: block;
    }
    .header {
      background: ${headerBg};
      color: #fff;
      padding: 16px 18px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .header-main { min-width: 0; flex: 1; }
    .tenant-logo {
      max-height: 52px;
      max-width: 180px;
      object-fit: contain;
      background: transparent !important;
      display: block;
      margin-bottom: 8px;
    }
    .tenant-logo-placeholder { display: none; }
    .header-qr {
      width: 112px;
      height: 112px;
      background: #fff;
      padding: 4px;
      flex-shrink: 0;
    }
    .header-kicker {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      opacity: 0.92;
      margin: 0;
    }
    .header-num {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 4px 0 0;
      letter-spacing: -0.01em;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-bottom: 1px solid #e5e5e5;
    }
    .meta-cell {
      padding: 10px 12px;
      border-right: 1px solid #e5e5e5;
    }
    .meta-cell:last-child { border-right: none; }
    .meta-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${cores.accent};
      margin: 0;
    }
    .meta-value {
      font-size: 10.5pt;
      font-weight: 500;
      margin: 4px 0 0;
      word-break: break-word;
    }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 12px 14px;
    }
    .parties.moradas-transporte {
      padding-top: 0;
      padding-bottom: 8px;
    }
    .party {
      background: ${cores.surface};
      border: 1px solid ${cores.border};
      padding: 12px 14px;
    }
    .party-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${cores.accent};
      margin: 0 0 6px;
    }
    .party p { margin: 3px 0; font-size: 10pt; }
    .party .name { font-weight: 600; font-size: 11pt; }
    .muted { color: #6b7280; }
    .mono { font-family: ui-monospace, monospace; font-size: 9pt; }
    .articles {
      padding: 0 14px 8px;
    }
    .section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${cores.headerFrom};
      margin: 0 0 6px;
    }
    table.lines {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid ${cores.border};
      font-size: 10pt;
    }
    table.lines thead tr {
      background: ${cores.accent};
      color: #fff;
      text-align: left;
    }
    table.lines th {
      padding: 8px 8px;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
    }
    table.lines td {
      padding: 8px 8px;
      border-top: 1px solid ${cores.surface};
      vertical-align: top;
    }
    td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    td.bold { font-weight: 600; }
    .line-desc { font-weight: 500; }
    .iva-box {
      margin: 0 14px 8px;
      padding: 8px 12px;
      background: ${cores.surface};
      border: 1px solid ${cores.border};
    }
    .iva-list { margin: 0; padding-left: 0; list-style: none; font-size: 9pt; line-height: 1.35; }
    .iva-list li { margin: 2px 0; }
    .iva-ref { font-weight: 600; color: ${cores.accent}; }
    .footer-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      border-top: 1px solid ${cores.border};
      padding: 12px 14px;
      align-items: start;
    }
    .summary {
      background: #fafafa;
      border: 1px solid ${cores.border};
      padding: 12px 14px;
      margin-left: auto;
      max-width: 340px;
      width: 100%;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      font-size: 10.5pt;
      margin-bottom: 6px;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      border-top: 1px solid ${cores.border};
      padding-top: 8px;
      margin-top: 4px;
      font-weight: 700;
      color: ${cores.headerFrom};
    }
    .summary-total .amount { font-size: 1.25rem; }
    .legal-footer {
      border-top: 1px solid ${cores.border};
      background: ${cores.surface};
      padding: 8px 14px;
      text-align: center;
      font-size: 9px;
      color: #6b7280;
    }
    .no-print { margin: 8px; }
    .no-print button {
      background: ${cores.accent};
      color: #fff;
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="no-print"><button type="button" onclick="window.print()">Imprimir</button></div>
  <article class="doc">
    <header class="header">
      <div class="header-top">
        <div class="header-main">
          ${logoHtml}
          <p class="header-kicker">${escapeHtml(input.tipoDocumentoLabel)} ${exemplar}</p>
          <h1 class="header-num">Nº ${escapeHtml(input.numeroDocumento)}</h1>
        </div>
        <img class="header-qr" src="${input.qrDataUrl}" alt="QR Code AT"/>
      </div>
    </header>

    <div class="meta-grid">
      <div class="meta-cell">
        <p class="meta-label">Data de Emissão</p>
        <p class="meta-value">${escapeHtml(fmtData(input.dataEmissao))}</p>
      </div>
      <div class="meta-cell">
        <p class="meta-label">Data de Vencimento</p>
        <p class="meta-value">${escapeHtml(vencimento)}</p>
      </div>
      <div class="meta-cell">
        <p class="meta-label">Moeda</p>
        <p class="meta-value">€ (Euro)</p>
      </div>
      <div class="meta-cell">
        <p class="meta-label">ATCUD</p>
        <p class="meta-value">${escapeHtml(input.codigoAtcud)}</p>
      </div>
    </div>

    <div class="parties">
        <div class="party">
          <p class="party-label">De</p>
          <p class="name">${escapeHtml(input.emitente.nomeEmpresa)}</p>
          ${input.emitente.moradaFiscal ? `<p class="muted">${escapeHtml(input.emitente.moradaFiscal).replace(/\n/g, "<br/>")}</p>` : ""}
          <p><span class="muted">NIF </span>${escapeHtml(input.emitente.nifEmitente)}</p>
          ${emitenteExtras}
        </div>
        <div class="party">
          <p class="party-label">Para</p>
          <p class="name">${escapeHtml(input.destinatario.nome)}</p>
          ${input.destinatario.morada ? `<p class="muted">${escapeHtml(input.destinatario.morada).replace(/\n/g, "<br/>")}</p>` : ""}
          <p><span class="muted">NIF </span>${escapeHtml(input.destinatario.nif)}</p>
          ${input.destinatario.email ? `<p>${escapeHtml(input.destinatario.email)}</p>` : ""}
        </div>
      </div>

      <div class="parties moradas-transporte">
        <div class="party">
          <p class="party-label">Morada de carga</p>
          <p class="muted">${escapeHtml(input.moradaCarga).replace(/\n/g, "<br/>")}</p>
        </div>
        <div class="party">
          <p class="party-label">Morada de descarga</p>
          <p class="muted">${escapeHtml(input.moradaDescarga).replace(/\n/g, "<br/>")}</p>
        </div>
      </div>

      <div class="articles">
        <p class="section-label">Lista de Artigos</p>
        <table class="lines">
          <thead>
            <tr>
              <th>Descrição do artigo</th>
              <th style="width:56px;text-align:right">Quant.</th>
              <th style="width:72px;text-align:right">Preço</th>
              <th style="width:56px;text-align:right">Desc.</th>
              <th style="width:64px;text-align:right">IVA (%)</th>
              <th style="width:80px;text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${linhasHtml}</tbody>
        </table>
      </div>

      ${isencoesHtml}

      <div class="footer-grid">
        ${input.notas ? `<p class="muted"><strong>Notas:</strong> ${escapeHtml(input.notas)}</p>` : "<div></div>"}
        <div class="summary">
          <p class="section-label">Resumo</p>
          <div class="summary-row">
            <span class="muted">Subtotal da Fatura</span>
            <span>${fmtEuro(input.valorCentavos)} €</span>
          </div>
          ${resumoIvaHtml}
          <div class="summary-total">
            <span>Total da Fatura</span>
            <span class="amount">${fmtEuro(totalLiquido)} €</span>
          </div>
        </div>
      </div>

    <footer class="legal-footer">
      ${escapeHtml(hashFooter)} - Processado por Programa Certificado n.º ${escapeHtml(input.softwareCertificado?.trim() || "-")}/AT
    </footer>
  </article>
</body>
</html>`;
}

export function faturaDocumentoFilename(
  tipoSerie: string,
  serieCodigo: string,
  numero: number,
  exemplar: FaturaDocumentoExemplar = "ORIGINAL",
): string {
  const base = `fatura-${tipoSerie.toLowerCase()}-${serieCodigo}-${numero}`;
  return exemplar === "DUPLICADO" ? `${base}-duplicado` : base;
}
