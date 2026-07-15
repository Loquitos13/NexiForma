export const CRM_SUGESTOES_UPDATED = "crm-sugestoes-updated";

export function notifyCrmSugestoesUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CRM_SUGESTOES_UPDATED));
  }
}
