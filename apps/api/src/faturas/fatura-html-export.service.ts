import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import QRCode from "qrcode";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { buildFaturaQrPayload } from "./fatura-atcud.util";
import { resolverSoftwareCertificado } from "./at-certificacao.util";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtEuro(cents: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
}

@Injectable()
export class FaturaHtmlExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async buildPrintableHtml(user: RequestUser, faturaId: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.faturaComercial.findFirst({
      where: { id: faturaId, tenantId },
      include: {
        entidadeCliente: { select: { nome: true, nif: true, email: true } },
        proposta: { select: { codigo: true, titulo: true } },
        serie: { select: { codigo: true, tipo: true } },
        linhas: { orderBy: { ordem: "asc" } },
      },
    });
    if (!row) {
      throw new NotFoundException("Fatura não encontrada.");
    }

    const config = await this.prisma.configFaturacaoTenant.findUnique({
      where: { tenantId },
    });
    const emitenteNome = config?.nomeEmpresa ?? "-";
    const emitenteMorada = config?.moradaFiscal ?? null;
    const emitenteNif = config?.nifEmitente ?? "-";
    const softwareCert = resolverSoftwareCertificado(
      config?.softwareCertificado,
      this.config.get<string>("AT_SOFTWARE_CERT_NUMBER"),
    ).numero;
    if (row.estado === "RASCUNHO") {
      throw new NotFoundException("Emita a fatura antes de gerar o documento.");
    }
    if (!row.numero || !row.codigoAtcud || !row.dataEmissao) {
      throw new NotFoundException("Fatura emitida sem numeração ou ATCUD.");
    }

    const identificacao = `${row.serie.tipo} ${row.serie.codigo}/${row.numero}`;
    const qrPayload = buildFaturaQrPayload({
      nifEmitente: emitenteNif,
      nifCliente: row.destinatarioNif,
      tipoDocumento: row.serie.tipo,
      dataEmissao: row.dataEmissao,
      identificacaoDocumento: identificacao,
      atcud: row.codigoAtcud,
      totalSemIvaCentavos: row.valorCentavos,
      totalIvaCentavos: row.ivaCentavos,
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 140, margin: 1 });

    const linhasHtml = row.linhas
      .map((l) => {
        const base = Math.round(Number(l.quantidade) * l.precoUnitCentavos);
        const totalLinha = base + l.valorIvaCentavos;
        return `<tr>
          <td>${escapeHtml(l.descricao)}</td>
          <td class="num">${Number(l.quantidade)}</td>
          <td class="num">${fmtEuro(l.precoUnitCentavos)}</td>
          <td class="num">${fmtEuro(base)}</td>
          <td class="num">${Number(l.taxaIva)}%</td>
          <td class="num">${fmtEuro(l.valorIvaCentavos)}</td>
          <td class="num">${fmtEuro(totalLinha)}</td>
        </tr>`;
      })
      .join("");

    const totalComIva = row.valorCentavos + row.ivaCentavos;
    const emitida = row.dataEmissao.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const vencimento = row.dataVencimento
      ? row.dataVencimento.toLocaleDateString("pt-PT")
      : "-";
    const filename = `fatura-${row.serie.tipo.toLowerCase()}-${row.serie.codigo}-${row.numero}.html`;

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Fatura ${escapeHtml(identificacao)}</title>
  <style>
    @media print { .no-print { display: none; } body { margin: 1.2cm; } }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 2rem; line-height: 1.45; font-size: 11pt; max-width: 900px; }
    h1 { font-size: 1.35rem; margin: 0 0 0.2rem; color: #1e3a8a; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 1rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
    .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem 1rem; }
    .box h2 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 0.5rem; }
    table.lines { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 1rem; }
    table.lines th, table.lines td { border: 1px solid #e2e8f0; padding: 0.4rem 0.5rem; text-align: left; }
    table.lines th { background: #f8fafc; }
    td.num { text-align: right; white-space: nowrap; }
    .totals { margin-top: 1rem; max-width: 320px; margin-left: auto; }
    .totals table { width: 100%; border-collapse: collapse; }
    .totals td { padding: 0.35rem 0.5rem; }
    .totals td:last-child { text-align: right; font-weight: 600; }
    .totals tr.grand td { border-top: 2px solid #1e40af; font-size: 1.1rem; color: #1e40af; }
    .qr { margin-top: 1.25rem; display: flex; align-items: flex-start; gap: 1rem; }
    .qr img { width: 120px; height: 120px; }
    .atcud { font-family: ui-monospace, monospace; font-size: 0.95rem; font-weight: 700; color: #1e40af; }
    footer { margin-top: 2rem; font-size: 0.78rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 0.75rem; }
    .no-print button { background: #2563eb; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="no-print"><button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>
  <h1>Fatura ${escapeHtml(row.serie.tipo)} ${escapeHtml(row.serie.codigo)}/${row.numero}</h1>
  <p class="meta">${escapeHtml(emitenteNome)} · NIF ${escapeHtml(emitenteNif)} · Emitida em ${escapeHtml(emitida)}</p>
  <p>ATCUD: <span class="atcud">${escapeHtml(row.codigoAtcud)}</span></p>

  <div class="grid">
    <div class="box">
      <h2>Emitente</h2>
      <p><strong>${escapeHtml(emitenteNome)}</strong></p>
      ${emitenteMorada ? `<p>${escapeHtml(emitenteMorada).replace(/\n/g, "<br/>")}</p>` : ""}
      <p>NIF ${escapeHtml(emitenteNif)}</p>
    </div>
    <div class="box">
      <h2>Cliente</h2>
      <p><strong>${escapeHtml(row.destinatarioNome)}</strong></p>
      ${row.destinatarioMorada ? `<p>${escapeHtml(row.destinatarioMorada).replace(/\n/g, "<br/>")}</p>` : ""}
      <p>NIF ${escapeHtml(row.destinatarioNif)}</p>
      ${row.entidadeCliente.email ? `<p>${escapeHtml(row.entidadeCliente.email)}</p>` : ""}
    </div>
  </div>

  <p><strong>Vencimento:</strong> ${escapeHtml(vencimento)}</p>
  ${row.proposta ? `<p><strong>Ref. proposta:</strong> ${escapeHtml(row.proposta.codigo)} – ${escapeHtml(row.proposta.titulo)}</p>` : ""}
  ${row.notas ? `<p><strong>Notas:</strong> ${escapeHtml(row.notas)}</p>` : ""}

  <table class="lines">
    <thead>
      <tr>
        <th>Descrição</th><th>Qtd.</th><th>Preço s/ IVA</th><th>Base</th><th>IVA</th><th>Valor IVA</th><th>Total c/ IVA</th>
      </tr>
    </thead>
    <tbody>${linhasHtml}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal (s/ IVA)</td><td>${fmtEuro(row.valorCentavos)}</td></tr>
      <tr><td>IVA</td><td>${fmtEuro(row.ivaCentavos)}</td></tr>
      <tr class="grand"><td>Total</td><td>${fmtEuro(totalComIva)}</td></tr>
    </table>
  </div>

  <div class="qr">
    <img src="${qrDataUrl}" alt="QR Code fatura"/>
    <div>
      <p><strong>QR Code</strong> - validação AT</p>
      ${softwareCert ? `<p class="meta" style="margin:0;">Software certificado AT n.º ${escapeHtml(softwareCert)}</p>` : ""}
      ${row.hashIntegridade ? `<p class="meta" style="margin:0;font-family:ui-monospace,monospace;font-size:0.7rem;">Hash: ${escapeHtml(row.hashIntegridade.slice(0, 16))}…</p>` : ""}
    </div>
  </div>

  <footer>${escapeHtml(identificacao)} · ATCUD ${escapeHtml(row.codigoAtcud)}${softwareCert ? ` · SW AT ${escapeHtml(softwareCert)}` : ""} · NexiForma</footer>
</body>
</html>`;

    return { html, filename };
  }
}
