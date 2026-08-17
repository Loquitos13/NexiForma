"use client";

import { DocumentosPoliticaSettings } from "@/components/settings/documentos-politica-settings";
import { ModuleLogosPanel } from "@/components/settings/module-logos-panel";
import { TemplateEditorPanel } from "@/components/settings/template-editor-panel";

export function ConfiguracoesFormacaoPanel() {
  return (
    <div className="space-y-6">
      <DocumentosPoliticaSettings variant="tenant" />
      <ModuleLogosPanel modulo="formacao" title="Logótipos de formação" />
      <TemplateEditorPanel
        modulo="formacao"
        title="Templates de formação"
        description="Escreva declarações, contratos, relatórios e inquéritos com campos dinâmicos. Ex.: {{formando.nome_completo}}, {{acao.carga_horas}}, {{acao.conteudos_modulos}}."
      />
    </div>
  );
}
