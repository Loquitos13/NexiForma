"use client";

import { ModuleLogosPanel } from "@/components/settings/module-logos-panel";
import { TemplateEditorPanel } from "@/components/settings/template-editor-panel";

export function ConfiguracoesCrmPanel() {
  return (
    <div className="space-y-6">
      <ModuleLogosPanel modulo="crm" title="Logótipos CRM" />
      <TemplateEditorPanel
      modulo="crm"
      title="Templates CRM"
      description="Propostas e contratos com variáveis do cliente, proposta e comercial. Também pode importar DOCX numa fase posterior."
      />
    </div>
  );
}
