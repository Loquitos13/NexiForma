import { PageHeader } from "@/components/ui";
import { CrmClientesResumoPanel } from "@/components/crm/crm-clientes-resumo-panel";
import { CrmContextNav, PROPOSTAS_NAV } from "@/components/crm/crm-context-nav";

export default function PropostasClientesPage() {
  return (
    <>
      <CrmContextNav tabs={PROPOSTAS_NAV} ariaLabel="Secções Propostas" />
      <PageHeader
        title="Clientes com propostas"
        description="Entidades com propostas comerciais registadas. Clique para ver as propostas na ficha."
      />
      <CrmClientesResumoPanel
        tipo="propostas"
        tabDestino="propostas"
        countLabel="propostas"
        emptyMessage="Nenhum cliente com propostas registadas."
      />
    </>
  );
}
