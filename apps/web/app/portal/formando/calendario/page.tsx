import { PortalCalendarioView } from "@/components/portal/portal-calendario-view";

export default function FormandoCalendarioPage() {
  return (
    <PortalCalendarioView
      formandoMode
      title="Calendário"
      description="Sessões das suas formações, prazos LMS e lembretes pessoais - clique num dia para agendar."
    />
  );
}
