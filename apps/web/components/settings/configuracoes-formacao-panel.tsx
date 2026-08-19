"use client";

import { DocumentosPoliticaSettings } from "@/components/settings/documentos-politica-settings";
import { ModuleLogosPanel } from "@/components/settings/module-logos-panel";
import { TemplateEditorPanel } from "@/components/settings/template-editor-panel";
import { TenantSignaturePanel } from "@/components/settings/tenant-signature-panel";

export function ConfiguracoesFormacaoPanel() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0">
          <DocumentosPoliticaSettings variant="tenant" />
        </div>
        <div className="min-w-0 grid gap-6 lg:grid-cols-2 lg:items-start">
          <TenantSignaturePanel />
          <ModuleLogosPanel modulo="formacao" title="Logótipos de formação" />
        </div>
      </div>
      <TemplateEditorPanel
        modulo="formacao"
        title="Templates de formação"
        description="Escreva declarações, contratos, relatórios e inquéritos com campos dinâmicos. Ex.: {{formando.nome_completo}}, {{acao.carga_horas}}, {{acao.conteudos_modulos}}."
      />
    </div>
  );
}
