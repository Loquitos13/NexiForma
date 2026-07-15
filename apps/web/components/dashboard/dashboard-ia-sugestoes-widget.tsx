"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Sparkles, UserRound } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";

type Sugestao = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  score: number | string;
  entidadeCliente?: { id: string; nome: string } | null;
};

export function DashboardIaSugestoesWidget({ compact }: { compact?: boolean }) {
  const [items, setItems] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bffFetch("/api/v1/crm/sugestoes-ia?estado=PENDENTE&limit=6", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      setItems((await res.json()) as Sugestao[]);
    } catch {
      setError("Não foi possível carregar sugestões IA.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-xs text-slate-500">A carregar sugestões IA…</p>;
  }

  if (error) {
    return <p className="text-xs text-red-400/90">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center text-center">
        <Sparkles className="mx-auto h-5 w-5 text-violet-400/60" />
        <p className="mt-2 text-xs text-slate-500">Sem sugestões pendentes.</p>
        <Link href="/portal/crm/sugestoes-ia" className="mt-1 text-[10px] text-blue-400 hover:underline">
          Ver inbox IA
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1.5 overflow-auto">
      {items.slice(0, compact ? 2 : 4).map((s) => (
        <Link
          key={s.id}
          href={
            s.entidadeCliente?.id
              ? `/portal/clientes/${s.entidadeCliente.id}?tab=sugestoes-ia`
              : "/portal/crm/sugestoes-ia"
          }
          className="group block rounded-md border border-violet-500/15 bg-violet-950/20 px-2.5 py-2 transition-colors hover:border-violet-400/30 hover:bg-violet-950/35"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 text-[11px] font-medium text-slate-200 group-hover:text-violet-100">
              {s.titulo}
            </p>
            <Sparkles className="h-3 w-3 shrink-0 text-violet-400/70" />
          </div>
          {s.entidadeCliente?.nome ? (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-emerald-400/90">
              <UserRound className="h-2.5 w-2.5" />
              Cliente: {s.entidadeCliente.nome}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-slate-500">Cliente não associado</p>
          )}
          <p className={cn("mt-1 text-[10px] leading-snug text-slate-400", compact ? "line-clamp-1" : "line-clamp-2")}>
            {s.descricao}
          </p>
        </Link>
      ))}
      <Link
        href="/portal/crm/sugestoes-ia"
        className="mt-auto inline-flex items-center gap-1 self-end text-[10px] text-blue-400 hover:text-blue-300"
      >
        Todas as sugestões <ArrowRight className="h-2.5 w-2.5" />
      </Link>
    </div>
  );
}
