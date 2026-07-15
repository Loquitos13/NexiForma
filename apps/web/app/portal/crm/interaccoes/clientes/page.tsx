import { PageHeader } from "@/components/ui";
import { CrmClientesResumoPanel } from "@/components/crm/crm-clientes-resumo-panel";
import { CrmContextNav, NOTAS_NAV } from "@/components/crm/crm-context-nav";

export default function NotasClientesPage() {
  return (
    <>
      <CrmContextNav tabs={NOTAS_NAV} ariaLabel="Secções Notas comerciais" />
      <PageHeader
        title="Clientes com notas"
        description="Clientes com registos comerciais. Clique para ver as notas na ficha."
      />
      <CrmClientesResumoPanel
        tipo="notas"
        tabDestino="notas-comerciais"
        countLabel="notas"
        emptyMessage="Nenhum cliente com notas comerciais registadas."
      />
    </>
  );
}
