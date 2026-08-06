const API_PREFIX = "v1";

/** Caminho público (sem prefixo global `/v1`) para webhook de leads. */
export const CRM_PUBLIC_LEAD_WEBHOOK_PATH = "public/v1/webhooks/leads";

export function buildCrmLeadWebhookUrl(apiBaseUrl: string, tenantSlug: string): string {
  const base = apiBaseUrl.replace(/\/$/, "");
  return `${base}/${API_PREFIX}/${CRM_PUBLIC_LEAD_WEBHOOK_PATH}/${encodeURIComponent(tenantSlug)}`;
}

/** URL alternativa via BFF Next.js (`/api/v1/...`). */
export function buildCrmLeadWebhookBffUrl(appOrigin: string, tenantSlug: string): string {
  const origin = appOrigin.replace(/\/$/, "");
  return `${origin}/api/${API_PREFIX}/${CRM_PUBLIC_LEAD_WEBHOOK_PATH}/${encodeURIComponent(tenantSlug)}`;
}
