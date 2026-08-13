"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DgertRequisitoBanner, DgertTarget } from "@/components/portal/dgert-requisito-banner";
import {
  AvaliacaoParametrosSettings,
  type AvaliacaoParametros,
} from "@/components/settings/avaliacao-parametros-settings";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader, PaginatedDataTable, Select, Textarea, type Column,
} from "@/components/ui";

type AcaoOpt = { id: string; codigoInterno: string; titulo: string };
type TurmaOpt = { id: string; codigo: string; nome: string };
type MatriculaOpt = { id: string; formando: { nome: string; nif: string }; turma: { codigo: string } };
type AvaliacaoRow = {
  id: string;
  tipo: string;
  nota: number | null;
  observacoes: string | null;
  avaliadoEm: string;
};

const TIPO_LABEL: Record<string, string> = {
  continua: "Contínua",
  final: "Final",
  recuperacao: "Recuperação",
};

const DEFAULT_PARAMS: AvaliacaoParametros = {
  notaMinimaAprovacao: 50,
  escalaMaxima: 100,
  tiposPermitidos: ["continua", "final", "recuperacao"],
  exigirObservacoesAbaixoMinima: false,
};

function notaColor(nota: number, minimo: number) {
  if (nota >= minimo + 20) return "text-green-400";
  if (nota >= minimo) return "text-yellow-400";
  return "text-red-400";
}

export default function AvaliacoesPage() {
  const { canManageFormacao: canManage } = useTenantRole();
  const [params, setParams] = useState<AvaliacaoParametros>(DEFAULT_PARAMS);
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [matriculas, setMatriculas] = useState<MatriculaOpt[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoRow[]>([]);
  const [acaoId, setAcaoId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [matriculaId, setMatriculaId] = useState("");
  const [tipo, setTipo] = useState("continua");
  const [nota, setNota] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const AVAL_COLS: Column<AvaliacaoRow>[] = [
    {
      key: "tipo",
      header: "Tipo",
      sortable: true,
      sortCycle: ["final", "continua", "recuperacao"],
      sortCycleLabel: (v) => TIPO_LABEL[String(v)] ?? String(v),
      sortValue: (a) => a.tipo.toLowerCase(),
      cell: (a) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-400">
          {TIPO_LABEL[a.tipo.toLowerCase()] ?? a.tipo}
        </span>
      ),
    },
    {
      key: "nota",
      header: "Nota",
      sortable: true,
      sortValue: (a) => a.nota ?? -1,
      cell: (a) =>
        a.nota != null ? (
          <>
            <span className={`text-lg font-bold ${notaColor(a.nota, params.notaMinimaAprovacao)}`}>{a.nota}</span>
            <span className="text-slate-500 text-xs">/{params.escalaMaxima}</span>
          </>
        ) : (
          <span className="text-slate-500">–</span>
        ),
    },
    {
      key: "observacoes",
      header: "Observações",
      sortable: true,
      hideOnMobile: true,
      sortValue: (a) => a.observacoes ?? "",
      cell: (a) => (
        <span className="text-xs text-slate-400 max-w-xs truncate block">{a.observacoes ?? "–"}</span>
      ),
    },
    {
      key: "avaliadoEm",
      header: "Data",
      sortable: true,
      hideOnMobile: true,
      sortValue: (a) => new Date(a.avaliadoEm).getTime(),
      cell: (a) => <span className="text-xs text-slate-500">{formatDatePt(a.avaliadoEm)}</span>,
    },
  ];

  const tiposActivos = useMemo(
    () => params.tiposPermitidos.filter((t) => TIPO_LABEL[t]),
    [params.tiposPermitidos],
  );

  useEffect(() => {
    if (!tiposActivos.includes(tipo) && tiposActivos[0]) {
      setTipo(tiposActivos[0]);
    }
  }, [tipo, tiposActivos]);

  useEffect(() => {
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(async (r) => {
      if (!r.ok) return;
      const rows = (await r.json()) as AcaoOpt[];
      setAcoes(rows);
      const fromUrl = new URLSearchParams(window.location.search).get("acao");
      const pick = fromUrl && rows.some((a) => a.id === fromUrl) ? fromUrl : rows[0]?.id ?? "";
      if (pick) setAcaoId(pick);
    });
  }, []);

  useEffect(() => {
    if (!acaoId) return;
    void bffFetch(`/api/v1/turmas?acaoFormacaoId=${encodeURIComponent(acaoId)}`, { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) { const rows = (await r.json()) as TurmaOpt[]; setTurmas(rows); if (rows.length) setTurmaId(rows[0].id); }
    });
  }, [acaoId]);

  useEffect(() => {
    if (!turmaId) return;
    void bffFetch(`/api/v1/matriculas?turmaId=${encodeURIComponent(turmaId)}`, { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) { const rows = (await r.json()) as MatriculaOpt[]; setMatriculas(rows); if (rows.length) setMatriculaId(rows[0].id); }
    });
  }, [turmaId]);

  const load = useCallback(async () => {
    if (!matriculaId) { setAvaliacoes([]); return; }
    const r = await bffFetch(`/api/v1/avaliacoes/matricula/${matriculaId}`, { headers: { accept: "application/json" } });
    if (r.ok) setAvaliacoes((await r.json()) as AvaliacaoRow[]);
    else setError("Erro ao carregar avaliações.");
  }, [matriculaId]);

  useEffect(() => { void load(); }, [load]);

  async function criarAvaliacao() {
    if (!canManage || !matriculaId || !nota) return;
    const notaNum = Number.parseInt(nota, 10);
    if (
      params.exigirObservacoesAbaixoMinima &&
      notaNum < params.notaMinimaAprovacao &&
      !obs.trim()
    ) {
      setError(`Notas abaixo de ${params.notaMinimaAprovacao} exigem observações.`);
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch(`/api/v1/avaliacoes/matricula/${matriculaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ tipo, nota: notaNum, observacoes: obs.trim() || undefined }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setNota("");
    setObs("");
    setMsg("Avaliação registada.");
    await load();
  }

  return (
    <>
      <PageHeader
        title="Avaliações"
        description={`Registo por tipo e nota (escala 0–${params.escalaMaxima}, mínimo ${params.notaMinimaAprovacao} para aprovação).`}
      />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <DgertRequisitoBanner backHref={acaoId ? `/portal/dossie?acao=${acaoId}` : "/portal/dossie"} />

      {canManage ? (
        <div className="mb-6">
          <AvaliacaoParametrosSettings onSaved={setParams} />
        </div>
      ) : null}

      <DgertTarget id="avaliacoes_form" className="mb-6">
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Select label="Acção" value={acaoId} onChange={(e) => setAcaoId(e.target.value)}>
                {acoes.map((a) => <option key={a.id} value={a.id}>{a.codigoInterno} – {a.titulo}</option>)}
              </Select>
              <Select label="Turma" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
                {turmas.map((t) => <option key={t.id} value={t.id}>{t.codigo} – {t.nome}</option>)}
              </Select>
              <Select label="Formando (matrícula)" value={matriculaId} onChange={(e) => setMatriculaId(e.target.value)}>
                {matriculas.map((m) => <option key={m.id} value={m.id}>{m.formando.nome} · {m.turma.codigo}</option>)}
              </Select>
            </div>

            {canManage && matriculaId ? (
              <div className="max-w-md space-y-3 border-t border-slate-700/30 pt-4">
                <h3 className="text-sm font-semibold text-slate-300">Nova avaliação</h3>
                <div className="flex gap-3">
                  <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    {tiposActivos.map((t) => (
                      <option key={t} value={t}>
                        {TIPO_LABEL[t] ?? t}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    max={params.escalaMaxima}
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder={`Nota (0-${params.escalaMaxima})`}
                    className="w-36"
                  />
                </div>
                <Textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={2}
                  placeholder={
                    params.exigirObservacoesAbaixoMinima
                      ? `Observações (obrigatórias abaixo de ${params.notaMinimaAprovacao})`
                      : "Observações (opcional)"
                  }
                />
                <Button onClick={() => void criarAvaliacao()} disabled={busy || !nota}>
                  Registar avaliação
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </DgertTarget>

      <Card>
        <CardHeader className="border-b border-slate-700/40">
          <CardTitle>Avaliações ({avaliacoes.length})</CardTitle>
        </CardHeader>
        {avaliacoes.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Sem avaliações registadas.</div>
        ) : (
          <CardContent className="p-0">
            <PaginatedDataTable
              columns={AVAL_COLS}
              data={avaliacoes}
              keyField="id"
              paginationClassName="border-t border-slate-700/40 px-4 py-3"
            />
          </CardContent>
        )}
      </Card>
    </>
  );
}
