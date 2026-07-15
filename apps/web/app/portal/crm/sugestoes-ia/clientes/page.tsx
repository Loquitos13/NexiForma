import { PageHeader } from "@/components/ui";
import { CrmClientesResumoPanel } from "@/components/crm/crm-clientes-resumo-panel";
import { CrmContextNav, SUGESTOES_NAV } from "@/components/crm/crm-context-nav";

export default function SugestoesClientesPage() {
  return (
    <>
      <CrmContextNav tabs={SUGESTOES_NAV} ariaLabel="Secções Sugestões IA" />
      <PageHeader
        title="Clientes com sugestões IA"
        description="Sugestões aceites ou rejeitadas por cliente. Clique para ver o histórico na ficha."
      />
      <CrmClientesResumoPanel
        tipo="sugestoes"
        tabDestino="sugestoes-ia"
        countLabel="sugestões"
        emptyMessage="Nenhum cliente com sugestões IA decididas."
      />
    </>
  );
}
