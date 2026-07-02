export type TenantWebsiteSyncConfig = {
  enabled?: boolean;
  webhookUrl?: string;
  /** Segredo partilhado para HMAC (X-NexiForma-Signature). */
  webhookSecret?: string;
  lastSyncAt?: string;
  lastSyncStatus?: "ok" | "error";
  lastSyncError?: string;
};

export type WebsiteSyncEvent =
  | "catalog.full_sync"
  | "formacao.created"
  | "formacao.updated"
  | "formacao.published"
  | "formacao.unpublished"
  | "acao.created"
  | "acao.updated"
  | "acao.published";

export type WebsiteSyncPayload = {
  event: WebsiteSyncEvent;
  tenantId: string;
  timestamp: string;
  /** Catálogo completo ou item parcial */
  catalog?: unknown;
  formacao?: unknown;
  acao?: unknown;
};

export const CATALOG_PAGE_DEFAULT = 20;
export const CATALOG_PAGE_MAX = 100;
