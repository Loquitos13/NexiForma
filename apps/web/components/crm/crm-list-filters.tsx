"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { DateRangeInput, Select } from "@/components/ui";

export type CrmListFiltersValue = {
  q: string;
  comercialUserId: string;
  dataInicio: string;
  dataFim: string;
};

export const emptyCrmListFilters: CrmListFiltersValue = {
  q: "",
  comercialUserId: "",
  dataInicio: "",
  dataFim: "",
};

type ComercialOpt = { id: string; displayName: string; role: string };

type Props = {
  value: CrmListFiltersValue;
  onChange: (next: CrmListFiltersValue) => void;
  gestor?: boolean;
  searchPlaceholder?: string;
};

export function CrmListFilters({
  value,
  onChange,
  gestor = false,
  searchPlaceholder = "Pesquisar por NIF ou nome da empresa…",
}: Props) {
  const [comerciais, setComerciais] = useState<ComercialOpt[]>([]);

  useEffect(() => {
    if (!gestor) return;
    void (async () => {
      const res = await bffFetch("/api/v1/users", { headers: { accept: "application/json" } });
      if (!res.ok) return;
      const users = (await res.json()) as ComercialOpt[];
      setComerciais(
        users.filter((u) => u.role === "comercial" || u.role === "tenant_manager"),
      );
    })();
  }, [gestor]);

  function patch(partial: Partial<CrmListFiltersValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-[200px] flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-slate-200"
          placeholder={searchPlaceholder}
          value={value.q}
          onChange={(e) => patch({ q: e.target.value })}
        />
      </div>

      {gestor ? (
        <>
          <Select
            label="Comercial / autor"
            className="min-w-[180px]"
            value={value.comercialUserId}
            onChange={(e) => patch({ comercialUserId: e.target.value })}
          >
            <option value="">Todos</option>
            {comerciais.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </Select>
          <DateRangeInput
            label="Período"
            className="min-w-[220px]"
            dataInicio={value.dataInicio}
            dataFim={value.dataFim}
            onChange={(dataInicio, dataFim) => patch({ dataInicio, dataFim })}
          />
        </>
      ) : null}
    </div>
  );
}

/** Serializa filtros para query string da API. */
export function crmListFiltersToParams(
  filters: CrmListFiltersValue,
  gestor: boolean,
  extra?: Record<string, string | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (gestor) {
    if (filters.comercialUserId) params.set("comercialUserId", filters.comercialUserId);
    if (filters.dataInicio) params.set("dataInicio", filters.dataInicio);
    if (filters.dataFim) params.set("dataFim", filters.dataFim);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
    }
  }
  return params;
}
