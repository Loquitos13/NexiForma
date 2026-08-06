import {
  buildCrmLeadWebhookBffUrl,
  buildCrmLeadWebhookUrl,
} from "@nexiforma/shared";

export function resolveCrmLeadWebhookUrls(tenantSlug: string): {
  directUrl: string | null;
  bffUrl: string | null;
  missingEnv: boolean;
} {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  const appOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_PUBLIC_URL?.trim() || null;

  return {
    directUrl: apiBase ? buildCrmLeadWebhookUrl(apiBase, tenantSlug) : null,
    bffUrl: appOrigin ? buildCrmLeadWebhookBffUrl(appOrigin, tenantSlug) : null,
    missingEnv: !apiBase,
  };
}
