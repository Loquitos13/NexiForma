"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { CRM_SUGESTOES_UPDATED } from "@/lib/crm/sugestoes-events";

type CrmStats = {
  sugestoesIaPendentes: number;
};

type CrmStatsContextValue = {
  stats: CrmStats;
  refresh: () => Promise<void>;
};

const defaultStats: CrmStats = { sugestoesIaPendentes: 0 };

const CrmStatsContext = createContext<CrmStatsContextValue>({
  stats: defaultStats,
  refresh: async () => {},
});

export function CrmStatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<CrmStats>(defaultStats);

  const refresh = useCallback(async () => {
    const res = await bffFetch("/api/v1/crm/estatisticas", { headers: { accept: "application/json" } });
    if (!res.ok) return;
    const data = (await res.json()) as { sugestoesIaPendentes?: number };
    setStats({ sugestoesIaPendentes: data.sugestoesIaPendentes ?? 0 });
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(CRM_SUGESTOES_UPDATED, onUpdate);
    const t = setInterval(() => void refresh(), 60_000);
    return () => {
      clearInterval(t);
      window.removeEventListener(CRM_SUGESTOES_UPDATED, onUpdate);
    };
  }, [refresh]);

  const value = useMemo(() => ({ stats, refresh }), [stats, refresh]);

  return <CrmStatsContext.Provider value={value}>{children}</CrmStatsContext.Provider>;
}

export function useCrmStats() {
  return useContext(CrmStatsContext);
}
