"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, Trash2, Upload, X } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  PaginatedDataTable,
  Dialog,
  DialogContent,
  Input,
  PageHeader,
  type Column,
} from "@/components/ui";

type Ufcd = {
  codigo: string;
  designacao: string;
  area: string | null;
  cargaHoras: number | null;
  nivelQnq: string | null;
};

type ImportResult = {
  imported: number;
  created: number;
  updated: number;
  deactivated: number;
  fileRows?: number;
  uniqueCodes?: number;
  duplicateRows?: number;
  mensagem?: string;
  skippedTotal?: number;
  skipped?: Array<{ line: number; reason: string }>;
};

const CNQ_UFCD_URL = "https://catalogo.anqep.gov.pt/ufcdPesquisa";
const LIST_LIMIT = 10_000;
const QNQ_TITLE =
  "QNQ  Quadro Nacional de Qualificações: níveis 1 a 8 que classificam as qualificações em Portugal (alinhado com o Quadro Europeu).";

export default function CatalogoUfcdPage() {
  const { canManageFormacao: canManage, writeDisabled } = useTenantRole();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Ufcd[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const areasAsc = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const a = r.area?.trim();
      if (a) set.add(a);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }));
  }, [rows]);

  const displayedRows = useMemo(() => {
    if (!areaFilter) return rows;
    return rows.filter((r) => (r.area?.trim() ?? "") === areaFilter);
  }, [rows, areaFilter]);

  const allVisibleSelected = useMemo(
    () => displayedRows.length > 0 && displayedRows.every((r) => selectedIds.has(r.codigo)),
    [displayedRows, selectedIds],
  );

  const columns: Column<Ufcd>[] = useMemo(() => {
    function cycleAreaFilter() {
      if (areasAsc.length === 0) {
        setAreaFilter(null);
        return;
      }
      if (areaFilter === null) {
        setAreaFilter(areasAsc[0]!);
        return;
      }
      const idx = areasAsc.indexOf(areaFilter);
      if (idx < 0 || idx >= areasAsc.length - 1) setAreaFilter(null);
      else setAreaFilter(areasAsc[idx + 1]!);
    }

    return [
      {
        key: "codigo",
        header: "Código",
        sortable: true,
        sortValue: (r) => r.codigo,
        headerClassName: "w-[7.5rem]",
        className: "w-[7.5rem]",
        cell: (r) => <span className="font-mono font-semibold text-blue-400">{r.codigo}</span>,
      },
      {
        key: "designacao",
        header: "Designação",
        sortable: true,
        sortValue: (r) => r.designacao,
        headerClassName: "w-auto",
        cell: (r) => (
          <span className="block truncate text-slate-200" title={r.designacao}>
            {r.designacao}
          </span>
        ),
      },
      {
        key: "area",
        header: (
          <span className="inline-flex items-center gap-1.5">
            Área
            <Filter
              className={`h-3 w-3 shrink-0 ${areaFilter ? "text-violet-300 opacity-100" : "opacity-40"}`}
              aria-hidden
            />
          </span>
        ),
        headerText: areaFilter
          ? `Área filtrada: ${areaFilter}. Clique para a área seguinte.`
          : "Área  filtrar por área (ordem A–Z)",
        onHeaderClick: cycleAreaFilter,
        headerClassName: "w-[14rem]",
        className: "w-[14rem]",
        cell: (r) => (
          <span className="block truncate text-sm text-slate-400" title={r.area ?? undefined}>
            {r.area ?? "–"}
          </span>
        ),
      },
      {
        key: "cargaHoras",
        header: "Horas",
        cell: (r) => <Badge variant="default">{r.cargaHoras ?? "–"}</Badge>,
        className: "w-[5.5rem] text-center",
        headerClassName: "w-[5.5rem] text-center",
      },
      {
        key: "nivelQnq",
        header: (
          <span title={QNQ_TITLE} className="cursor-help">
            Nível QNQ
          </span>
        ),
        headerText: "Nível QNQ  Quadro Nacional de Qualificações",
        headerClassName: "w-[6.5rem]",
        className: "w-[6.5rem]",
        cell: (r) => (
          <span className="text-slate-500 text-sm" title={QNQ_TITLE}>
            {r.nivelQnq ?? "–"}
          </span>
        ),
      },
    ];
  }, [areaFilter, areasAsc]);

  const search = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: String(LIST_LIMIT) });
    if (term.trim()) params.set("q", term.trim());
    const res = await bffFetch(`/api/v1/catalogo-ufcd?${params}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) setError(await parseApiError(res));
    else {
      setRows((await res.json()) as Ufcd[]);
      setSelectedIds(new Set());
      setAreaFilter(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void search("");
  }, [search]);

  useEffect(() => {
    if (areaFilter && !areasAsc.includes(areaFilter)) setAreaFilter(null);
  }, [areaFilter, areasAsc]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(displayedRows.map((r) => r.codigo)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function deleteSelected() {
    if (selectedIds.size === 0 || writeDisabled) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/catalogo-ufcd/delete", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ codigos: [...selectedIds] }),
    });
    if (!res.ok) {
      setError(await parseApiError(res));
    } else {
      const data = (await res.json()) as { deleted: number };
      setMsg(`${data.deleted} UFCD(s) eliminada(s).`);
      setDeleteConfirmOpen(false);
      setSelectedIds(new Set());
      void search(q);
    }
    setBusy(false);
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const qs = deactivateMissing ? "?deactivateMissing=true" : "";
    const res = await bffFetch(`/api/v1/catalogo-ufcd/import${qs}`, { method: "POST", body: fd });
    if (!res.ok) {
      setImportError(await parseApiError(res));
    } else {
      setImportResult((await res.json()) as ImportResult);
      void search(q);
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex h-[calc(100dvh-10.75rem)] min-h-[22rem] flex-col gap-4 overflow-hidden sm:h-[calc(100dvh-12rem)]">
      <div className="shrink-0 space-y-4">
        <PageHeader
          title="Catálogo UFCD / CNQ"
          description="Referência oficial para validação de cursos e trilho SIGO. Clique numa linha para seleccionar."
          actions={
            canManage ? (
              <Button
                type="button"
                variant="secondary"
                disabled={writeDisabled}
                onClick={() => {
                  setImportResult(null);
                  setImportError(null);
                  setImportOpen(true);
                }}
              >
                <Upload className="h-4 w-4" aria-hidden />
                Importar
              </Button>
            ) : null
          }
        />

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

        {canManage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/50 px-4 py-3">
            <p className="text-sm text-slate-400">
              {selectedIds.size > 0 ? (
                <>
                  <span className="font-medium text-slate-200">{selectedIds.size}</span> seleccionada
                  {selectedIds.size === 1 ? "" : "s"}
                  {displayedRows.length > 0 ? (
                    <span className="text-slate-500">
                      {" "}
                      · {displayedRows.length}
                      {areaFilter ? ` de ${rows.length}` : ""} na lista
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  Clique nas linhas para seleccionar · {displayedRows.length}
                  {areaFilter ? ` de ${rows.length}` : ""} na lista
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={displayedRows.length === 0 || allVisibleSelected || writeDisabled}
                onClick={selectAllVisible}
              >
                Seleccionar todas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={selectedIds.size === 0}
                onClick={clearSelection}
              >
                Limpar selecção
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={selectedIds.size === 0 || writeDisabled || busy}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Eliminar{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <Alert variant="error">{error}</Alert> : null}
        {msg ? <Alert variant="success">{msg}</Alert> : null}

        {areaFilter ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Filtro de área:</span>
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-950/40 px-2.5 py-1 text-violet-200">
              <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 truncate" title={areaFilter}>
                {areaFilter}
              </span>
              <button
                type="button"
                className="rounded p-0.5 text-violet-300/80 hover:bg-violet-900/60 hover:text-violet-100"
                aria-label="Limpar filtro de área"
                onClick={() => setAreaFilter(null)}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
            <span className="text-xs text-slate-500">
              Clique em «Área» no cabeçalho para a área seguinte (A–Z).
            </span>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        <PaginatedDataTable<Ufcd>
          columns={columns}
          data={displayedRows}
          keyField="codigo"
          loading={loading}
          fixedLayout
          stickyHeader
          className="h-full"
          emptyMessage={
            areaFilter
              ? `Nenhuma UFCD na área «${areaFilter}». Clique em Área para passar à seguinte.`
              : "Nenhuma UFCD encontrada. Importe a listagem do CNQ para começar."
          }
          selection={
            canManage && !writeDisabled
              ? {
                  selectedIds,
                  onToggle: toggleSelected,
                }
              : undefined
          }
        />
      </div>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent
          title="Eliminar UFCDs"
          description={`Vai eliminar permanentemente ${selectedIds.size} UFCD(s) do catálogo.`}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Esta acção não remove códigos já associados a cursos; apenas deixa de os validar pelo
              catálogo.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                onClick={() => void deleteSelected()}
              >
                {busy ? "A eliminar…" : `Eliminar (${selectedIds.size})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent
          title="Importar catálogo UFCD"
          description="Carregue o Excel (.xlsx) obtido em «Descarregar Listagem» no CNQ."
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3 text-sm text-slate-300 space-y-2">
              <p className="font-medium text-slate-200">Onde exportar</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>
                  Abra{" "}
                  <a
                    href={CNQ_UFCD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    catalogo.anqep.gov.pt/ufcdPesquisa
                  </a>
                </li>
                <li>Pesquise (opcional) e clique em «Descarregar Listagem» (.xlsx)</li>
                <li>Seleccione o ficheiro Excel abaixo (CSV/TSV também são aceites)</li>
              </ol>
            </div>

            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="mt-1"
                checked={deactivateMissing}
                onChange={(e) => setDeactivateMissing(e.target.checked)}
              />
              <span>
                Desactivar UFCDs que não estejam no ficheiro (use só numa importação completa da
                listagem oficial).
              </span>
            </label>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
              disabled={importing || writeDisabled}
              onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
            />

            {importing ? <p className="text-sm text-slate-400">A importar…</p> : null}
            {importError ? <Alert variant="error">{importError}</Alert> : null}
            {importResult ? (
              <Alert variant="success">
                {importResult.mensagem ??
                  `Importadas ${importResult.imported} UFCDs únicas.`}{" "}
                ({importResult.created} novas, {importResult.updated} actualizadas
                {importResult.deactivated
                  ? `, ${importResult.deactivated} desactivadas`
                  : ""}
                ).
              </Alert>
            ) : null}
            {importResult?.skipped?.length ? (
              <ul className="max-h-32 overflow-y-auto text-xs text-slate-500 space-y-1">
                {importResult.skipped.map((s) => (
                  <li key={`${s.line}-${s.reason}`}>
                    Linha {s.line}: {s.reason}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setImportOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
