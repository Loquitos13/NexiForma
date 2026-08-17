"use client";

import { TemplateEditorPanel } from "@/components/settings/template-editor-panel";

export function ConfiguracoesCrmPanel() {
  return (
    <TemplateEditorPanel
      modulo="crm"
      title="Templates CRM"
      description="Propostas e contratos com variáveis do cliente, proposta e comercial. Também pode importar DOCX numa fase posterior."
    />
  );
}
