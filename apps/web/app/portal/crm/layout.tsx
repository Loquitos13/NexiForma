"use client";

import { usePathname } from "next/navigation";
import { CrmStatsProvider } from "@/lib/crm/crm-stats-context";
import { CrmSectionNav, CrmSugestoesPendentesBanner } from "@/components/crm/crm-section-nav";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/portal/crm";

  return (
    <CrmStatsProvider>
      <CrmSectionNav />
      {!isDashboard ? <CrmSugestoesPendentesBanner /> : null}
      {children}
    </CrmStatsProvider>
  );
}
