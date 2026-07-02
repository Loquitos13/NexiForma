import type { ErroPlataformaContext } from "./platform-alertas.service";

export type ErroServidorContext = ErroPlataformaContext & {
  httpMethod?: string;
  httpPath?: string;
  statusCode?: number;
  userEmail?: string;
  userId?: string;
  tenantSlug?: string;
  payload?: string;
  stack?: string;
};

const DEDUP_MS = 120_000;
const recentAlerts = new Map<string, number>();

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildErroServidorDetalhe(input: ErroServidorContext): string {
  const lines: string[] = [];
  if (input.httpMethod && input.httpPath) {
    lines.push(`${input.httpMethod} ${input.httpPath} → HTTP ${input.statusCode ?? 500}`);
  }
  if (input.userEmail) {
    lines.push(`Utilizador: ${input.userEmail}${input.userId ? ` (${input.userId})` : ""}`);
  }
  if (input.tenantSlug || input.tenantId) {
    lines.push(`Tenant: ${input.tenantSlug ?? input.tenantId}`);
  }
  lines.push("");
  lines.push(`Mensagem: ${input.resumo}`);
  if (input.payload) {
    lines.push("");
    lines.push("Payload (sanitizado):");
    lines.push(input.payload);
  }
  if (input.stack) {
    lines.push("");
    lines.push("Stack:");
    lines.push(input.stack.slice(0, 4000));
  } else if (input.detalhe) {
    lines.push("");
    lines.push(String(input.detalhe).slice(0, 4000));
  }
  return lines.join("\n");
}

export function buildErroServidorHtml(input: ErroServidorContext): string {
  const detalhe = escapeHtml(buildErroServidorDetalhe(input));
  return (
    `<p><strong>Erro de servidor NexiForma</strong></p>` +
    `<ul>` +
    `<li><strong>Módulo:</strong> ${escapeHtml(input.modulo)}</li>` +
    `<li><strong>Tenant:</strong> ${escapeHtml(input.tenantNome ?? input.tenantSlug ?? input.tenantId ?? "-")}</li>` +
    (input.httpMethod
      ? `<li><strong>Pedido:</strong> ${escapeHtml(input.httpMethod)} ${escapeHtml(input.httpPath ?? "")}</li>`
      : "") +
    (input.statusCode ? `<li><strong>HTTP:</strong> ${input.statusCode}</li>` : "") +
    `</ul>` +
    `<pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;overflow:auto;font-size:12px;white-space:pre-wrap;">${detalhe}</pre>`
  );
}

export function shouldDedupAlert(fingerprint: string): boolean {
  const now = Date.now();
  const prev = recentAlerts.get(fingerprint);
  if (prev != null && now - prev < DEDUP_MS) return true;
  recentAlerts.set(fingerprint, now);
  if (recentAlerts.size > 500) {
    for (const [k, t] of recentAlerts) {
      if (now - t > DEDUP_MS) recentAlerts.delete(k);
    }
  }
  return false;
}

export function alertFingerprint(input: ErroServidorContext): string {
  return `${input.modulo}|${input.httpMethod ?? ""}|${input.httpPath ?? ""}|${input.resumo}`.slice(
    0,
    400,
  );
}
