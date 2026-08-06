"use client";

import { Suspense } from "react";
import { PortalCalendarioView } from "@/components/portal/portal-calendario-view";

export default function CalendarioPage() {
  return (
    <Suspense>
      <PortalCalendarioView
        description="Sessões de formação, reuniões CRM, lembretes e prazos LMS - clique num evento para ver detalhes ou em «+ Agendar»."
      />
    </Suspense>
  );
}
