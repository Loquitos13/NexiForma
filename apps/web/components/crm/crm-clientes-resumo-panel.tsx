"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { CrmClienteHistoricoPanel } from "@/components/crm/crm-cliente-historico-panel";
import { CrmClienteResumoCard, type CrmClienteResumoData } from "@/components/crm/crm-cliente-resumo-card";
import { parseApiError } from "@/lib/ui/backoffice";
import { withPortalFrom } from "@/lib/ui/portal-back-nav";
import { Alert } from "@/components/ui";

type Props = {
  tipo: "leads" | "notas" | "sugestoes" | "propostas";
  tabDestino: "leads" | "notas-comerciais" | "sugestoes-ia" | "propostas";
  countLabel: string;
  emptyMessage: string;
};

export function CrmClientesResumoPanel({ tipo, tabDestino, countLabel, emptyMessage }: Props) {
  const pathname = usePathname();
  const [items, setItems] = useState<CrmClienteResumoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!navigatingId) return;
    const t = window.setTimeout(() => setNavigatingId(null), 15000);
    return () => clearTimeout(t);
  }, [navigatingId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/clientes-resumo?tipo=${tipo}`, {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setItems((await res.json()) as CrmClienteResumoData[]);
  }, [tipo]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.nif.includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    );
  }, [items, search]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          placeholder="Pesquisar por nome, NIF ou email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-slate-600/60 bg-slate-900/80 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/60"
        />
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {loading ? (
        <p className="text-sm text-slate-500">A carregar clientes…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum cliente corresponde à pesquisa.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => {
            const isExpanded = expandedIds.has(c.id);
            const href = withPortalFrom(
              `/portal/clientes/${c.id}?tab=${tabDestino}`,
              pathname,
            );

            return (
              <CrmClienteResumoCard
                key={c.id}
                cliente={c}
                countLabel={countLabel}
                expanded={isExpanded}
                onToggle={() => toggleExpanded(c.id)}
                isNavigating={navigatingId === c.id}
                fichaHref={href}
                onNavigate={() => setNavigatingId(c.id)}
              >
                <CrmClienteHistoricoPanel
                  tipo={tipo}
                  entidadeId={c.id}
                  fromPath={pathname}
                  itemLabel={countLabel}
                />
              </CrmClienteResumoCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
