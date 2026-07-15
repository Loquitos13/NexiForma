import { PageHeader } from "@/components/ui";
import { CrmClientesResumoPanel } from "@/components/crm/crm-clientes-resumo-panel";
import { CrmContextNav, LEADS_NAV } from "@/components/crm/crm-context-nav";

export default function LeadsClientesPage() {
  return (
    <>
      <CrmContextNav tabs={LEADS_NAV} ariaLabel="Secções Leads" />
      <PageHeader
        title="Clientes com leads"
        description="Clientes com oportunidades comerciais associadas. Clique para ver os leads na ficha."
      />
      <CrmClientesResumoPanel
        tipo="leads"
        tabDestino="leads"
        countLabel="leads"
        emptyMessage="Nenhum cliente com leads associados."
      />
    </>
  );
}
