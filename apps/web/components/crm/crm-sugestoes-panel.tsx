"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { CRM_SUGESTOES_UPDATED, notifyCrmSugestoesUpdated } from "@/lib/crm/sugestoes-events";
import { parseApiError } from "@/lib/ui/backoffice";
import { withPortalFrom } from "@/lib/ui/portal-back-nav";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { inferirAcaoPlaneada } from "@nexiforma/shared";
import { fmtDate } from "@/lib/crm/shared";

type SugestaoResumo = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  estado: string;
  createdAt: string;
  entidadeCliente: { id: string; nome: string } | null;
  leadComercial: { id: string; codigo: string; empresaNome: string } | null;
  interaccao: { resumoIa: string | null } | null;
  metadata?: unknown;
};

type PanelContext = "leads" | "clientes";

function filtrarPorContexto(items: SugestaoResumo[], ctx: PanelContext) {
  if (ctx === "leads") {
    return items.filter(
      (s) =>
        s.leadComercial != null ||
        s.tipo === "NOVO_LEAD" ||
        s.tipo === "FOLLOW_UP",
    );
  }
  return items.filter(
    (s) =>
      s.entidadeCliente != null ||
      s.tipo === "UPSELL" ||
      s.tipo === "CROSS_SELL" ||
      s.tipo === "RENOVACAO" ||
      s.tipo === "FOLLOW_UP" ||
      s.tipo === "OUTRO",
  );
}

type Props = {
  context: PanelContext;
  maxItems?: number;
};

export function CrmSugestoesPanel({ context, maxItems = 5 }: Props) {
  const pathname = usePathname();
  const [items, setItems] = useState<SugestaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch("/api/v1/crm/sugestoes-ia?estado=PENDENTE&limit=50", {
      headers: { accept: "application/json" },
    });
    if (res.ok) setItems((await res.json()) as SugestaoResumo[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtradas = useMemo(() => filtrarPorContexto(items, context), [items, context]);
  const visiveis = filtradas.slice(0, maxItems);

  async function aceitar(id: string) {
    setBusy(true);
    setError(null);
    const res = await bffFetch(`/api/v1/crm/sugestoes-ia/${id}/aceitar`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
    else {
      notifyCrmSugestoesUpdated();
      void load();
    }
  }

  if (loading || visiveis.length === 0) return null;

  const titulo =
    context === "leads" ? "Sugestões IA - Leads" : "Sugestões IA - Clientes";

  return (
    <Card className="mb-4 border-2 border-violet-500/35 bg-gradient-to-br from-violet-950/30 to-slate-900/50">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base text-violet-100">
            <Sparkles className="h-4 w-4 text-violet-400" />
            {titulo}
            <Badge variant="purple">{filtradas.length}</Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {visiveis.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-violet-500/25 bg-slate-950/50 px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-50">{s.titulo}</p>
                  <Badge variant="default" className="text-[10px]">
                    {s.tipo.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-xs text-slate-300">{s.descricao}</p>
                {inferirAcaoPlaneada(s.metadata, s.titulo, s.tipo) ? (
                  <p className="text-[11px] text-violet-300/90">
                    Será executado: {inferirAcaoPlaneada(s.metadata, s.titulo, s.tipo)}
                  </p>
                ) : null}
                {s.interaccao?.resumoIa ? (
                  <p className="mt-1.5 border-l border-violet-500/30 pl-2 text-[11px] text-slate-500 line-clamp-2">
                    {s.interaccao.resumoIa}
                  </p>
                ) : null}
                <p className="mt-1.5 text-[10px] text-slate-500">
                  {s.entidadeCliente ? (
                    <Link
                      href={withPortalFrom(`/portal/clientes/${s.entidadeCliente.id}`, pathname)}
                      className="font-medium text-violet-300 hover:underline"
                    >
                      {s.entidadeCliente.nome} →
                    </Link>
                  ) : s.leadComercial ? (
                    <span>{s.leadComercial.empresaNome}</span>
                  ) : (
                    "-"
                  )}{" "}
                  · {fmtDate(s.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" disabled={busy} onClick={() => void aceitar(s.id)}>
                  <Check className="h-3.5 w-3.5" />
                  Executar
                </Button>
                {s.entidadeCliente ? (
                  <Link
                    href={withPortalFrom(`/portal/clientes/${s.entidadeCliente.id}`, pathname)}
                    className="inline-flex h-8 items-center rounded-lg border border-slate-600 px-2.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Ficha
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {filtradas.length > maxItems ? (
          <p className="text-xs text-slate-500">
            +{filtradas.length - maxItems} mais - abre a ficha do cliente para ver tudo.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Badge numérico para item «Sugestões IA» na sidebar. */
export function CrmSugestoesNavBadge({ enabled = true }: { enabled?: boolean }) {
  const pathname = usePathname();
  const [pendentes, setPendentes] = useState(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const res = await bffFetch("/api/v1/crm/estatisticas", { headers: { accept: "application/json" } });
    if (!res.ok) return;
    const data = (await res.json()) as { sugestoesIaPendentes?: number };
    setPendentes(data.sugestoesIaPendentes ?? 0);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setPendentes(0);
      return;
    }
    void load();
    const onUpdate = () => void load();
    window.addEventListener(CRM_SUGESTOES_UPDATED, onUpdate);
    return () => window.removeEventListener(CRM_SUGESTOES_UPDATED, onUpdate);
  }, [enabled, load, pathname]);

  if (pendentes <= 0) return null;

  return (
    <span className="ml-auto rounded-md bg-purple-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-purple-200">
      {pendentes}
    </span>
  );
}

export function ContextSugestoesBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-violet-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200 ring-1 ring-violet-500/30">
      <Sparkles className="h-2.5 w-2.5" />
      {count} IA
    </span>
  );
}
