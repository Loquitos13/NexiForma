"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Badge, Card, CardContent, DataTable, Input, PageHeader, type Column } from "@/components/ui";

type Ufcd = {
  codigo: string;
  designacao: string;
  area: string | null;
  cargaHoras: number | null;
  nivelQnq: string | null;
};

const columns: Column<Ufcd>[] = [
  { key: "codigo", header: "Código", cell: (r) => <span className="font-mono font-semibold text-blue-400">{r.codigo}</span> },
  { key: "designacao", header: "Designação", cell: (r) => <span className="text-slate-200">{r.designacao}</span> },
  { key: "area", header: "Área", cell: (r) => <span className="text-slate-400 text-sm">{r.area ?? "–"}</span> },
  { key: "cargaHoras", header: "CH", cell: (r) => <Badge variant="default">{r.cargaHoras ?? "–"}</Badge>, className: "text-center", headerClassName: "text-center" },
  { key: "nivelQnq", header: "QNQ", cell: (r) => <span className="text-slate-500 text-sm">{r.nivelQnq ?? "–"}</span> },
];

export default function CatalogoUfcdPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Ufcd[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    const url = term.trim()
      ? `/api/v1/catalogo-ufcd?q=${encodeURIComponent(term.trim())}`
      : "/api/v1/catalogo-ufcd";
    const res = await bffFetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setRows((await res.json()) as Ufcd[]);
    setLoading(false);
  }, []);

  useEffect(() => { void search(""); }, [search]);

  return (
    <div className="space-y-5">
      <PageHeader title="Catálogo UFCD / CNQ" description="Referência DGEEC para validação de cursos e trilho SIGO." />

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <Input
            className="flex-1 min-w-[200px]"
            placeholder="Pesquisar código, designação ou área…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void search(q)}
          />
          <button
            type="button"
            onClick={() => void search(q)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
          >
            Pesquisar
          </button>
        </CardContent>
      </Card>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <DataTable<Ufcd>
        columns={columns}
        data={rows}
        keyField="codigo"
        loading={loading}
        emptyMessage="Nenhuma UFCD encontrada."
      />
    </div>
  );
}
