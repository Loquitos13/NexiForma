"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parsePaginatedList } from "@/lib/crm/paginated-list";
import { parseApiError } from "@/lib/ui/backoffice";
import { withPortalFrom } from "@/lib/ui/portal-back-nav";
import { LeadEstadoBadge } from "@/components/crm/lead-estado-badge";
import { ListPaginationControls } from "@/components/crm/list-pagination";
import { PropostaEstadoBadge } from "@/components/crm/proposta-estado-badge";
import { Alert, Badge } from "@/components/ui";
import { fmtDate, fmtEuro } from "@/lib/crm/shared";

export type ClienteHistoricoTipo = "leads" | "notas" | "sugestoes" | "propostas";

type Props = {
  tipo: ClienteHistoricoTipo;
  entidadeId: string;
  fromPath: string;
  itemLabel: string;
};

type PropostaRow = {
  id: string;
  codigo: string;
  titulo: string;
  estado: string;
  valorCentavos: number;
  createdAt: string;
};

type LeadRow = {
  id: string;
  codigo: string;
  empresaNome: string;
  estado: string;
  valorEstimadoCentavos: number;
  updatedAt: string;
};

type NotaRow = {
  id: string;
  tipo: string;
  titulo: string | null;
  createdAt: string;
  resumoIa: string | null;
};

type SugestaoRow = {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  score: number | string;
  createdAt: string;
  validadoEm: string | null;
};

function buildFetchUrl(
  tipo: ClienteHistoricoTipo,
  entidadeId: string,
  page: number,
  pageSize: number,
): string {
  const params = new URLSearchParams({
    entidadeClienteId: entidadeId,
    page: String(page),
    pageSize: String(pageSize),
  });
  switch (tipo) {
    case "propostas":
      return `/api/v1/propostas?${params}`;
    case "leads":
      return `/api/v1/crm/leads?${params}`;
    case "notas":
      return `/api/v1/crm/interaccoes?${params}`;
    case "sugestoes":
      params.delete("page");
      params.set("limit", "200");
      return `/api/v1/crm/sugestoes-ia?${params}`;
  }
}

function HistoricoRow({
  children,
  href,
}: {
  children: React.ReactNode;
  href?: string;
}) {
  const className =
    "flex items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-slate-900/45";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}

function HistoricoRows({
  tipo,
  items,
  entidadeId,
  fromPath,
}: {
  tipo: ClienteHistoricoTipo;
  items: unknown[];
  entidadeId: string;
  fromPath: string;
}) {
  if (tipo === "propostas") {
    return (
      <ul className="divide-y divide-slate-800/80">
        {(items as PropostaRow[]).map((p) => (
          <li key={p.id}>
            <HistoricoRow href={withPortalFrom(`/portal/propostas/${p.id}`, fromPath)}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{p.codigo}</p>
                <p className="truncate text-xs text-slate-400">{p.titulo}</p>
                <p className="mt-0.5 text-[11px] text-slate-600">{fmtDate(p.createdAt)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <PropostaEstadoBadge estado={p.estado as never} />
                <span className="text-sm font-semibold tabular-nums text-slate-100">
                  {fmtEuro(p.valorCentavos)}
                </span>
              </div>
            </HistoricoRow>
          </li>
        ))}
      </ul>
    );
  }

  if (tipo === "leads") {
    return (
      <ul className="divide-y divide-slate-800/80">
        {(items as LeadRow[]).map((l) => (
          <li key={l.id}>
            <HistoricoRow>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{l.codigo}</p>
                <p className="truncate text-xs text-slate-400">{l.empresaNome}</p>
                <p className="mt-0.5 text-[11px] text-slate-600">{fmtDate(l.updatedAt)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <LeadEstadoBadge estado={l.estado} />
                <span className="text-sm font-semibold tabular-nums text-slate-100">
                  {fmtEuro(l.valorEstimadoCentavos)}
                </span>
              </div>
            </HistoricoRow>
          </li>
        ))}
      </ul>
    );
  }

  if (tipo === "notas") {
    const fichaHref = withPortalFrom(
      `/portal/clientes/${entidadeId}?tab=notas-comerciais`,
      fromPath,
    );
    return (
      <ul className="divide-y divide-slate-800/80">
        {(items as NotaRow[]).map((n) => (
          <li key={n.id}>
            <HistoricoRow href={fichaHref}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {n.titulo || n.tipo}
                </p>
                {n.resumoIa ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{n.resumoIa}</p>
                ) : null}
                <p className="mt-0.5 text-[11px] text-slate-600">{fmtDate(n.createdAt)}</p>
              </div>
              <Badge variant="default">{n.tipo}</Badge>
            </HistoricoRow>
          </li>
        ))}
      </ul>
    );
  }

  const fichaHref = withPortalFrom(
    `/portal/clientes/${entidadeId}?tab=sugestoes-ia`,
    fromPath,
  );
  return (
    <ul className="divide-y divide-slate-800/80">
      {(items as SugestaoRow[]).map((s) => (
        <li key={s.id}>
          <HistoricoRow href={fichaHref}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-100">{s.titulo}</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {fmtDate(s.validadoEm ?? s.createdAt)} · score {Number(s.score).toFixed(0)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant="default">{s.tipo.replace("_", " ")}</Badge>
              <Badge
                variant={
                  s.estado === "ACEITE" ? "green" : s.estado === "REJEITADA" ? "red" : "yellow"
                }
              >
                {s.estado}
              </Badge>
            </div>
          </HistoricoRow>
        </li>
      ))}
    </ul>
  );
}

export function CrmClienteHistoricoPanel({ tipo, entidadeId, fromPath, itemLabel }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [items, setItems] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch(buildFetchUrl(tipo, entidadeId, page, pageSize), {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      setItems([]);
      setTotal(0);
      return;
    }
    const payload = await res.json();

    if (tipo === "sugestoes") {
      const all = (Array.isArray(payload) ? payload : []) as SugestaoRow[];
      const historico = all.filter((s) => s.estado === "ACEITE" || s.estado === "REJEITADA");
      const start = (page - 1) * pageSize;
      setTotal(historico.length);
      setItems(historico.slice(start, start + pageSize));
      return;
    }

    const parsed = parsePaginatedList<unknown>(payload);
    setItems(parsed.items);
    setTotal(parsed.total);
  }, [tipo, entidadeId, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [entidadeId, pageSize, tipo]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        A carregar {itemLabel}…
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (total === 0) {
    return (
      <p className="px-4 py-5 text-sm text-slate-500">Sem {itemLabel} registadas.</p>
    );
  }

  return (
    <>
      <HistoricoRows tipo={tipo} items={items} entidadeId={entidadeId} fromPath={fromPath} />
      <ListPaginationControls
        className="border-t border-slate-800/80 px-4 py-3"
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        numberedPages
      />
    </>
  );
}
