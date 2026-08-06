import {
  emailButton,
  emailMuted,
  emailParagraph,
  escapeHtml,
} from "../mail/email-layout.util";

export type FaturaEmailResumo = {
  ref: string;
  nomeEmpresa: string;
  nifEmitente: string;
  clienteNome: string;
  clienteNif: string;
  dataEmissao: string;
  dataVencimento: string;
  atcud: string;
  totalSemIva: string;
  totalIva: string;
  totalComIva: string;
  iban: string | null;
  emailGestor: string | null;
  filename: string;
  portalUrl: string;
};

export type FaturaEmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

function resumoBoxHtml(p: FaturaEmailResumo): string {
  return (
    `<div style="background:#f5f3ff;padding:16px;border-left:4px solid #7c3aed;border-radius:0 8px 8px 0;margin:20px 0;">` +
    `<p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#5b21b6;">${p.ref}</p>` +
    `<table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">` +
    `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;">Cliente</td><td style="padding:4px 0;"><strong>${p.clienteNome}</strong> · NIF ${p.clienteNif}</td></tr>` +
    `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;">Emitente</td><td style="padding:4px 0;">${p.nomeEmpresa} · NIF ${p.nifEmitente}</td></tr>` +
    `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;">Data de emissão</td><td style="padding:4px 0;">${p.dataEmissao}</td></tr>` +
    `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;">Vencimento</td><td style="padding:4px 0;">${p.dataVencimento}</td></tr>` +
    `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;">ATCUD</td><td style="padding:4px 0;font-family:monospace;">${p.atcud}</td></tr>` +
    `<tr><td style="padding:8px 8px 4px 0;color:#6b7280;border-top:1px solid #ddd6fe;">Total c/ IVA</td>` +
    `<td style="padding:8px 0 4px;font-size:16px;font-weight:700;color:#6d28d9;border-top:1px solid #ddd6fe;">${p.totalComIva}</td></tr>` +
    `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;">Base / IVA</td><td style="padding:4px 0;">${p.totalSemIva} · ${p.totalIva}</td></tr>` +
    `</table></div>`
  );
}

function resumoBoxText(p: FaturaEmailResumo): string {
  return (
    `Documento: ${p.ref}\n` +
    `Cliente: ${p.clienteNome} (NIF ${p.clienteNif})\n` +
    `Emitente: ${p.nomeEmpresa} (NIF ${p.nifEmitente})\n` +
    `Emissão: ${p.dataEmissao}\n` +
    `Vencimento: ${p.dataVencimento}\n` +
    `ATCUD: ${p.atcud}\n` +
    `Total c/ IVA: ${p.totalComIva} (s/ IVA: ${p.totalSemIva} · IVA: ${p.totalIva})\n`
  );
}

/** Cópia interna após emissão (gestor / quem emitiu). */
export function buildFaturaEmitidaInternaEmail(p: FaturaEmailResumo): FaturaEmailTemplate {
  return {
    subject: `Fatura emitida ${p.ref} – ${p.nomeEmpresa}`,
    text:
      `Fatura emitida no NexiForma\n\n` +
      `A fatura ${p.ref} foi emitida com sucesso para ${p.clienteNome}.\n\n` +
      resumoBoxText(p) +
      `\nEm anexo encontra o PDF do documento fiscal (${p.filename}).\n` +
      `Pode consultar, comunicar à AT ou reenviar ao cliente a partir do portal:\n${p.portalUrl}\n\n` +
      `Este email é uma cópia interna automática - não reencaminhe o PDF ao cliente sem validar os dados.\n\n` +
      `–\nNexiForma\n`,
    html:
      emailParagraph(
        `Foi registada a emissão de uma nova fatura no <strong>NexiForma</strong>.`,
      ) +
      emailParagraph(
        `A fatura <strong>${escapeHtml(p.ref)}</strong> foi emitida para ` +
          `<strong>${escapeHtml(p.clienteNome)}</strong> em nome de ` +
          `<strong>${escapeHtml(p.nomeEmpresa)}</strong>.`,
      ) +
      resumoBoxHtml(p) +
      emailParagraph(
        `O documento fiscal completo segue em anexo (<strong>${escapeHtml(p.filename)}</strong>), pronto para arquivo ou reenvio.`,
      ) +
      emailButton("Abrir fatura no portal", p.portalUrl, "primary") +
      emailMuted(
        "Cópia interna automática. Valide os dados antes de partilhar o PDF com o cliente.",
      ),
  };
}

/** Envio manual ao cliente. */
export function buildFaturaEnviadaClienteEmail(p: FaturaEmailResumo): FaturaEmailTemplate {
  const pagamentoText = p.iban
    ? `\nDados para pagamento:\nIBAN: ${p.iban}\n`
    : "";
  const pagamentoHtml = p.iban
    ? `<div style="background:#fafafa;padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;">` +
      `<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;">Dados para pagamento</p>` +
      `<p style="margin:0;font-family:monospace;font-size:14px;">IBAN ${p.iban}</p>` +
      (p.dataVencimento !== "-"
        ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Data de vencimento: <strong>${p.dataVencimento}</strong></p>`
        : "") +
      `</div>`
    : "";

  const contactoHtml = p.emailGestor
    ? `<p style="font-size:14px;color:#4b5563;">Para esclarecimentos, responda a este email ou contacte <a href="mailto:${p.emailGestor}">${p.emailGestor}</a>.</p>`
    : `<p style="font-size:14px;color:#4b5563;">Para esclarecimentos, responda a este email.</p>`;

  return {
    subject: `Fatura ${p.ref} – ${p.nomeEmpresa}`,
    text:
      `Exmo(a). Sr(a).,\n\n` +
      `Vimos por este meio enviar a fatura ${p.ref}, emitida por ${p.nomeEmpresa} (NIF ${p.nifEmitente}), ` +
      `referente a prestação de serviços / fornecimento acordado.\n\n` +
      resumoBoxText(p) +
      pagamentoText +
      `\nEncontra em anexo o documento fiscal em PDF (${p.filename}).\n\n` +
      `Com os melhores cumprimentos,\n${p.nomeEmpresa}\n` +
      (p.emailGestor ? `\n${p.emailGestor}\n` : ""),
    html:
      emailParagraph(
        `Exmo(a). Sr(a). <strong>${escapeHtml(p.clienteNome)}</strong>,`,
      ) +
      emailParagraph(
        `Vimos por este meio enviar a fatura <strong>${escapeHtml(p.ref)}</strong>, emitida por ` +
          `<strong>${escapeHtml(p.nomeEmpresa)}</strong> (NIF ${escapeHtml(p.nifEmitente)}), ` +
          `referente à prestação de serviços acordada consigo.`,
      ) +
      resumoBoxHtml(p) +
      pagamentoHtml +
      emailParagraph(
        `O documento fiscal completo segue em anexo (<strong>${escapeHtml(p.filename)}</strong>).`,
      ) +
      contactoHtml +
      emailParagraph(
        `Com os melhores cumprimentos,<br/><strong>${escapeHtml(p.nomeEmpresa)}</strong>`,
      ) +
      (p.emailGestor
        ? emailMuted(`<a href="mailto:${escapeHtml(p.emailGestor)}">${escapeHtml(p.emailGestor)}</a>`)
        : ""),
  };
}

export function fmtEuroCentavos(cents: number): string {
  return (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

export function fmtDataFaturaEmail(date: Date | null | undefined): string {
  if (!date) return "-";
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
