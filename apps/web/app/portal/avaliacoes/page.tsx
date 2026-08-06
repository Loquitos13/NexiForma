"use client";

import { useCallback, useEffect, useState } from "react";
import { DgertRequisitoBanner, DgertTarget } from "@/components/portal/dgert-requisito-banner";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import {
  Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader, Select, TableScroll, Textarea,
} from "@/components/ui";

type AcaoOpt = { id: string; codigoInterno: string; titulo: string };
type TurmaOpt = { id: string; codigo: string; nome: string };
type MatriculaOpt = { id: string; formando: { nome: string; nif: string }; turma: { codigo: string } };
type AvaliacaoRow = {
  id: string;
  tipo: string;
  nota: number;
  observacoes: string | null;
  createdAt: string;
  createdBy?: { email: string } | null;
};

const notaColor = (n: number) => (n >= 80 ? "text-green-400" : n >= 50 ? "text-yellow-400" : "text-red-400");

export default function AvaliacoesPage() {
  const { canManageFormacao: canManage } = useTenantRole();
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [matriculas, setMatriculas] = useState<MatriculaOpt[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoRow[]>([]);
  const [acaoId, setAcaoId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [matriculaId, setMatriculaId] = useState("");
  const [tipo, setTipo] = useState("CONTINUA");
  const [nota, setNota] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true); setError(null); setMsg(null);
    const r = await bffFetch(`/api/v1/avaliacoes/matricula/${matriculaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ tipo, nota: parseInt(nota), observacoes: obs.trim() || undefined }),
    });
    setBusy(false);
    if (!r.ok) { setError("Erro ao criar avaliação."); return; }
    setNota(""); setObs(""); setMsg("Avaliação registada.");
    await load();
  }

  return (
    <>
      <PageHeader
        title="Avaliações"
        description="Registo de avaliações de formandos por tipo, nota e observações."
      />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <DgertRequisitoBanner backHref={acaoId ? `/portal/dossie?acao=${acaoId}` : "/portal/dossie"} />

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
                    <option value="CONTINUA">Contínua</option>
                    <option value="FINAL">Final</option>
                    <option value="RECUPERACAO">Recuperação</option>
                  </Select>
                  <Input type="number" min={0} max={100} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (0-100)" className="w-32" />
                </div>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Observações (opcional)" />
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
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nota</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Observações</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {avaliacoes.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-400">{a.tipo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-lg font-bold ${notaColor(a.nota)}`}>{a.nota}</span>
                      <span className="text-slate-500 text-xs">/100</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden sm:table-cell max-w-xs truncate">{a.observacoes ?? "–"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{formatDatePt(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </>
  );
}
