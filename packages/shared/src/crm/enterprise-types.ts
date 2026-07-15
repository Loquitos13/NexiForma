/** Definições partilhadas CRM Enterprise (campos custom, automações, webhooks). */

export type CrmCustomFieldEntity = "lead" | "entidade" | "proposta";

export type CrmCustomFieldType = "text" | "number" | "date" | "select";

export type CrmCustomFieldDef = {
  id: string;
  entity: CrmCustomFieldEntity;
  key: string;
  label: string;
  type: CrmCustomFieldType;
  options?: string[];
  required?: boolean;
};

export type CrmOutboundWebhook = {
  id: string;
  url: string;
  events: CrmWebhookEvent[];
  secret?: string;
  active: boolean;
};

export type CrmWebhookEvent =
  | "lead.created"
  | "lead.updated"
  | "lead.converted"
  | "proposta.created"
  | "proposta.sent"
  | "interaccao.created";

export type CrmAutomationTrigger = "LEAD_CREATED" | "LEAD_STALE" | "PROPOSTA_SENT";

export type CrmAutomationAction = "CREATE_NOTA" | "CREATE_SUGESTAO" | "WEBHOOK";

export type CrmAutomationRule = {
  id: string;
  name: string;
  trigger: CrmAutomationTrigger;
  daysAfter?: number;
  action: CrmAutomationAction;
  active: boolean;
};

export type CrmEmailSyncConfig = {
  provider: "GMAIL" | "M365";
  enabled: boolean;
  lastSyncAt?: string | null;
  mailbox?: string;
};

export type CrmTenantConfig = {
  customFieldDefs: CrmCustomFieldDef[];
  leadWebhookSecret?: string;
  outboundWebhooks: CrmOutboundWebhook[];
  automations: CrmAutomationRule[];
  emailSync?: CrmEmailSyncConfig;
};

export const CRM_WEBHOOK_EVENTS: CrmWebhookEvent[] = [
  "lead.created",
  "lead.updated",
  "lead.converted",
  "proposta.created",
  "proposta.sent",
  "interaccao.created",
];
