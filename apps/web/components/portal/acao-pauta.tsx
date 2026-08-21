"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, GraduationCap } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
} from "@/components/ui";

type Celula = {
  notaPauta: number | null;
  nota: number | null;
  avaliacaoId: string | null;
};

type PautaData = {
  acaoId: string;
  turmas: Array<{ id: string; codigo: string; nome: string }>;
  modulos: Array<{
    id: string;
    titulo: string;
    codigo: string | null;
    ordem: number;
    podeEditar: boolean;
  }>;
  formandos: Array<{
    matriculaId: string;
    turmaId: string;
    turmaCodigo: string;
    nome: string;
    nif: string;
    notas: Record<string, Celula>;
  }>;
};

type Props = { acaoId: string };

type AvaliacaoParams = {
  escalaMaxima: number;
  notaMinimaAprovacao: number;
};

const DEFAULT_PARAMS: AvaliacaoParams = {
  escalaMaxima: 100,
  notaMinimaAprovacao: 50,
};

function notaClass(n: number | null, minAprovacao: number, escalaMaxima: number) {
  if (n == null) return "text-slate-500";
  const pct = escalaMaxima > 0 ? (n / escalaMaxima) * 100 : n;
  if (pct >= 80) return "text-green-400";
  if (pct >= (minAprovacao / escalaMaxima) * 100) return "text-yellow-400";
  return "text-red-400";
}

function parseNota(raw: string, escalaMaxima: number): number | null | "invalid" {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > escalaMaxima) return "invalid";
  return n;
}

/** Rótulo curto para caber na largura do ecrã (ex.: "Módulo 1" → "M1"). */
function shortModuloLabel(titulo: string, ordem: number, index: number): string {
  const m = titulo.match(/m[oó]dulo\s*(\d+)/i);
  if (m) return `M${m[1]}`;
  if (ordem > 0) return `M${ordem}`;
  return `M${index + 1}`;
}

export function AcaoPauta({ acaoId }: Props) {
  const [data, setData] = useState<PautaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [params, setParams] = useState<AvaliacaoParams>(DEFAULT_PARAMS);

  const loadParams = useCallback(async () => {
    const r = await bffFetch("/api/v1/portal/tenant/avaliacao-parametros", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return;
    const json = (await r.json()) as { parametros: AvaliacaoParams };
    setParams(json.parametros);
  }, []);

  useEffect(() => {
    void loadParams();
  }, [loadParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch(`/api/v1/avaliacoes/acao/${acaoId}/pauta`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      setError(await parseApiError(res));
      setData(null);
      setLoading(false);
      return;
    }
    const json = (await res.json()) as PautaData;
    setData(json);
    const next: Record<string, string> = {};
    for (const f of json.formandos) {
      for (const m of json.modulos) {
        const cell = f.notas[m.id];
        const key = `${f.matriculaId}:${m.id}`;
        next[key] = cell?.notaPauta != null ? String(cell.notaPauta) : "";
      }
    }
    setDrafts(next);
    setLoading(false);
  }, [acaoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const formandos = useMemo(() => {
    if (!data) return [];
    if (!turmaId) return data.formandos;
    return data.formandos.filter((f) => f.turmaId === turmaId);
  }, [data, turmaId]);

  const resumo = useMemo(() => {
    if (!data || !formandos.length || !data.modulos.length) {
      return { celulas: 0, preenchidas: 0, media: null as number | null, aprovados: 0 };
    }
    let preenchidas = 0;
    let soma = 0;
    let aprovados = 0;
    const celulas = formandos.length * data.modulos.length;
    for (const f of formandos) {
      let somaFormando = 0;
      let nFormando = 0;
      for (const m of data.modulos) {
        const key = `${f.matriculaId}:${m.id}`;
        const parsed = parseNota(drafts[key] ?? "", params.escalaMaxima);
        if (typeof parsed === "number") {
          preenchidas += 1;
          soma += parsed;
          somaFormando += parsed;
          nFormando += 1;
        }
      }
      if (nFormando > 0 && somaFormando / nFormando >= params.notaMinimaAprovacao) aprovados += 1;
    }
    return {
      celulas,
      preenchidas,
      media: preenchidas ? Math.round((soma / preenchidas) * 10) / 10 : null,
      aprovados,
    };
  }, [data, formandos, drafts, params.notaMinimaAprovacao]);

  async function guardar(matriculaId: string, moduloUnidadeId: string) {
    const key = `${matriculaId}:${moduloUnidadeId}`;
    const parsed = parseNota(drafts[key] ?? "", params.escalaMaxima);
    if (parsed === "invalid") {
      setError(`Nota inválida (0–${params.escalaMaxima}).`);
      return;
    }
    const cell = data?.formandos
      .find((f) => f.matriculaId === matriculaId)
      ?.notas[moduloUnidadeId];
    const prev = cell?.notaPauta ?? null;
    if (prev === parsed) return;
    if (prev == null && parsed == null) return;
    setSaving(key);
    setError(null);
    setMsg(null);
    const res = await bffFetch(
      `/api/v1/avaliacoes/matricula/${matriculaId}/pauta/${moduloUnidadeId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ nota: parsed }),
      },
    );
    setSaving(null);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setData((prevData) => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        formandos: prevData.formandos.map((f) => {
          if (f.matriculaId !== matriculaId) return f;
          const prevCell = f.notas[moduloUnidadeId] ?? {
            notaPauta: null,
            nota: null,
            avaliacaoId: null,
          };
          return {
            ...f,
            notas: {
              ...f.notas,
              [moduloUnidadeId]: {
                ...prevCell,
                notaPauta: parsed,
                nota: parsed,
              },
            },
          };
        }),
      };
    });
    setMsg("Nota da pauta guardada.");
  }

  function exportCsv() {
    if (!data) return;
    const headers = [
      "Formando",
      "NIF",
      "Turma",
      ...data.modulos.map((m) => m.titulo.replace(/"/g, '""')),
    ];
    const lines = [headers.map((h) => `"${h}"`).join(";")];
    for (const f of formandos) {
      const cols = [
        f.nome,
        f.nif,
        f.turmaCodigo,
        ...data.modulos.map((m) => {
          const key = `${f.matriculaId}:${m.id}`;
          const parsed = parseNota(drafts[key] ?? "", params.escalaMaxima);
          return typeof parsed === "number" ? String(parsed) : "";
        }),
      ];
      lines.push(cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pauta-${acaoId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !data) {
    return <p className="text-sm text-slate-500">A carregar pauta…</p>;
  }

  if (!data) {
    return <Alert variant="error">{error ?? "Não foi possível carregar a pauta."}</Alert>;
  }

  const pct =
    resumo.celulas > 0 ? Math.round((resumo.preenchidas / resumo.celulas) * 100) : 0;

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <Card>
        <CardHeader className="border-b border-slate-700/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-400" />
                Pauta por módulo
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Nota do teste final de cada módulo (0–{params.escalaMaxima}). Aprovação a partir de{" "}
                {params.notaMinimaAprovacao}. As pontuações LMS não entram nesta grelha. Guarda ao sair
                da célula (ou Enter).{" "}
                <Link href="/portal/avaliacoes" className="text-blue-400 hover:text-blue-300">
                  Editar parâmetros de avaliação
                </Link>
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!formandos.length || !data.modulos.length}
              onClick={exportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Preenchimento</p>
              <p className="text-lg font-semibold tabular-nums text-slate-100">
                {pct}%
                <span className="ml-1 text-xs font-normal text-slate-500">
                  ({resumo.preenchidas}/{resumo.celulas})
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Média</p>
              <p className={`text-lg font-semibold tabular-nums ${notaClass(resumo.media, params.notaMinimaAprovacao, params.escalaMaxima)}`}>
                {resumo.media != null ? resumo.media : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Formandos ≥{params.notaMinimaAprovacao}
              </p>
              <p className="text-lg font-semibold tabular-nums text-slate-100">
                {resumo.aprovados}
                <span className="ml-1 text-xs font-normal text-slate-500">
                  / {formandos.length}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Módulos</p>
              <p className="text-lg font-semibold tabular-nums text-slate-100">
                {data.modulos.length}
              </p>
            </div>
          </div>

          <div className="max-w-xs">
            <Select label="Turma" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">Todas</option>
              {data.turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        {formandos.length === 0 || data.modulos.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            {data.modulos.length === 0
              ? "Ainda não existem módulos no curso desta acção."
              : "Sem formandos inscritos."}
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-slate-700/30">
                  <th className="w-[22%] min-w-0 text-left px-2 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider sm:px-3 sm:text-xs">
                    Formando
                  </th>
                  {data.modulos.map((m, i) => (
                    <th
                      key={m.id}
                      className="min-w-0 px-0.5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:px-1 sm:text-xs"
                      title={m.titulo}
                    >
                      <span className="block truncate font-medium normal-case text-slate-300">
                        {shortModuloLabel(m.titulo, m.ordem, i)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {formandos.map((f) => (
                  <tr key={f.matriculaId}>
                    <td className="min-w-0 px-2 py-2 sm:px-3">
                      <div className="truncate font-medium text-slate-200" title={f.nome}>
                        {f.nome}
                      </div>
                      <div className="truncate text-[10px] text-slate-500 sm:text-[11px]">
                        {f.turmaCodigo} · {f.nif}
                      </div>
                    </td>
                    {data.modulos.map((m) => {
                      const key = `${f.matriculaId}:${m.id}`;
                      const cell = f.notas[m.id];
                      const editable = m.podeEditar;
                      return (
                        <td key={m.id} className="min-w-0 px-0.5 py-1.5 text-center align-middle sm:px-1">
                          {editable ? (
                            <input
                              type="number"
                              min={0}
                              max={params.escalaMaxima}
                              className={`mx-auto h-7 w-full max-w-[2.75rem] rounded-md border border-slate-600/60 bg-slate-950/80 px-0.5 text-center text-xs tabular-nums sm:h-8 sm:max-w-[3.25rem] sm:text-sm ${notaClass(
                                drafts[key] === "" ? null : Number(drafts[key]),
                                params.notaMinimaAprovacao,
                                params.escalaMaxima,
                              )}`}
                              value={drafts[key] ?? ""}
                              placeholder="-"
                              onChange={(e) =>
                                setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              onBlur={() => void guardar(f.matriculaId, m.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              disabled={saving === key}
                              aria-label={`Nota ${m.titulo} – ${f.nome}`}
                              title={m.titulo}
                            />
                          ) : (
                            <span
                              className={`text-xs tabular-nums font-medium sm:text-sm ${notaClass(cell?.nota ?? null, params.notaMinimaAprovacao, params.escalaMaxima)}`}
                              title={m.titulo}
                            >
                              {cell?.nota != null ? cell.nota : "-"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
