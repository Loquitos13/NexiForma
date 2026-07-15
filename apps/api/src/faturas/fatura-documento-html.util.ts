import {
  formatarMotivoIsencaoAt,
} from "@nexiforma/shared";

export type FaturaDocumentoLinha = {
  descricao: string;
  quantidade: number;
  precoUnitCentavos: number;
  descontoPercent: number;
  taxaIva: number;
  valorIvaCentavos: number;
  codigoIsencaoIva: string | null;
};

export type FaturaDocumentoInput = {
  tipoSerie: string;
  tipoDocumentoLabel: string;
  numeroDocumento: string;
  codigoAtcud: string;
  dataEmissao: Date;
  dataVencimento: Date | null;
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

/** HTML imprimível alinhado ao layout roxo do portal (FaturaInlineEditor). */
export function buildFaturaDocumentoHtml(input: FaturaDocumentoInput): string {
  const totalLiquido = input.valorCentavos + input.ivaCentavos - input.retencaoCentavos;
  const hashFooter = input.hashIntegridade?.trim().slice(0, 4) ?? "----";
  const vencimento = input.dataVencimento
    ? input.dataVencimento.toLocaleDateString("pt-PT")
    : "-";

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

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(input.tipoDocumentoLabel)} Nº ${escapeHtml(input.numeroDocumento)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    @media print { .no-print { display: none !important; } }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #171717;
      margin: 0;
      padding: 16px;
      background: #fff;
      font-size: 11pt;
      line-height: 1.45;
    }
    .doc {
      max-width: 820px;
      margin: 0 auto;
      border: 1px solid #ddd6fe;
      border-radius: 16px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #6d28d9 0%, #9333ea 45%, #6366f1 100%);
      color: #fff;
      padding: 24px 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .header-kicker {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      opacity: 0.9;
      margin: 0;
    }
    .header-num {
      font-size: 2rem;
      font-weight: 700;
      margin: 4px 0 0;
    }
    .header-atcud {
      font-family: ui-monospace, monospace;
      font-size: 0.875rem;
      opacity: 0.85;
      margin: 4px 0 0;
    }
    .header-qr {
      width: 88px;
      height: 88px;
      border-radius: 8px;
      background: #fff;
      padding: 4px;
      flex-shrink: 0;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-bottom: 1px solid #e5e5e5;
    }
    .meta-cell {
      padding: 12px 16px;
      border-right: 1px solid #e5e5e5;
    }
    .meta-cell:last-child { border-right: none; }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #7c3aed;
      margin: 0;
    }
    .meta-value {
      font-size: 0.875rem;
      font-weight: 500;
      margin: 2px 0 0;
    }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 20px 24px;
    }
    .party {
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 12px;
      padding: 16px;
    }
    .party-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #7c3aed;
      margin: 0 0 8px;
    }
    .party p { margin: 4px 0; font-size: 0.875rem; }
    .party .name { font-weight: 600; }
    .muted { color: #6b7280; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.75rem; }
    .articles { padding: 0 24px 16px; }
    .section-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6d28d9;
      margin: 0 0 8px;
    }
    table.lines {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #ede9fe;
      border-radius: 12px;
      overflow: hidden;
      font-size: 0.875rem;
    }
    table.lines thead tr {
      background: #7c3aed;
      color: #fff;
      text-align: left;
    }
    table.lines th {
      padding: 10px 8px;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
    }
    table.lines td {
      padding: 10px 8px;
      border-top: 1px solid #f5f3ff;
      vertical-align: top;
    }
    td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    td.bold { font-weight: 600; }
    .line-desc { font-weight: 500; }
    .line-motivo { font-size: 0.75rem; color: #7c3aed; margin-top: 4px; font-weight: 500; }
    .iva-box {
      margin: 0 24px 16px;
      padding: 12px 16px;
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 12px;
    }
    .iva-list { margin: 0; padding-left: 0; list-style: none; font-size: 0.875rem; }
    .iva-list li { margin: 4px 0; }
    .iva-ref { font-weight: 600; color: #7c3aed; }
    .footer-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      border-top: 1px solid #ede9fe;
      padding: 20px 24px;
    }
    .summary {
      background: #fafafa;
      border: 1px solid #ddd6fe;
      border-radius: 12px;
      padding: 16px;
      margin-left: auto;
      max-width: 360px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      font-size: 0.875rem;
      margin-bottom: 8px;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-top: 1px solid #ddd6fe;
      padding-top: 12px;
      margin-top: 8px;
      font-weight: 700;
      color: #6d28d9;
    }
    .summary-total .amount { font-size: 1.25rem; }
    .legal-footer {
      border-top: 1px solid #ede9fe;
      background: rgba(245, 243, 255, 0.4);
      padding: 10px 24px;
      text-align: center;
      font-size: 10px;
      color: #6b7280;
    }
    .no-print { margin-bottom: 12px; }
    .no-print button {
      background: #7c3aed;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="no-print"><button type="button" onclick="window.print()">Imprimir</button></div>
  <article class="doc">
    <header class="header">
      <div>
        <p class="header-kicker">${escapeHtml(input.tipoDocumentoLabel)} ORIGINAL</p>
        <h1 class="header-num">Nº ${escapeHtml(input.numeroDocumento)}</h1>
        <p class="header-atcud">${escapeHtml(input.codigoAtcud)}</p>
      </div>
      <img class="header-qr" src="${input.qrDataUrl}" alt="QR Code AT"/>
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

export function faturaDocumentoFilename(tipoSerie: string, serieCodigo: string, numero: number): string {
  return `fatura-${tipoSerie.toLowerCase()}-${serieCodigo}-${numero}`;
}
