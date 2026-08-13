"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader, PaginatedDataTable, Select, type Column,
} from "@/components/ui";

type AcaoOpt = { id: string; codigoInterno: string; titulo: string };
type TurmaOpt = { id: string; codigo: string; nome: string };
type FormandoOpt = { id: string; nome: string; nif: string; email: string };
type MatriculaRow = {
  id: string;
  estado: string;
  createdAt: string;
  formando: { id: string; nome: string; nif: string; email: string };
  turma: { id: string; codigo: string; nome: string; acaoFormacao: { codigoInterno: string; titulo: string } };
};

const ESTADO_VARIANT: Record<string, "green" | "red" | "teal"> = {
  ATIVA: "green",
  DESISTENCIA: "red",
  CONCLUSAO: "teal",
};

export default function MatriculasPage() {
  const { canManageFormacao: canManage } = useTenantRole();
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [formandos, setFormandos] = useState<FormandoOpt[]>([]);
  const [matriculas, setMatriculas] = useState<MatriculaRow[]>([]);
  const [acaoId, setAcaoId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [formandoId, setFormandoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const MATRICULA_COLS: Column<MatriculaRow>[] = [
    {
      key: "formando",
      header: "Formando",
      sortable: true,
      sortValue: (m) => m.formando.nome,
      cell: (m) => (
        <>
          <p className="text-slate-200 font-medium">{m.formando.nome}</p>
          <p className="text-xs text-slate-500">NIF {m.formando.nif}</p>
        </>
      ),
    },
    {
      key: "turma",
      header: "Turma",
      sortable: true,
      hideOnMobile: true,
      sortValue: (m) => m.turma.codigo,
      cell: (m) => <span className="text-slate-400">{m.turma.codigo}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      sortable: true,
      sortCycle: ["ATIVA", "CONCLUSAO", "DESISTENCIA"],
      sortValue: (m) => m.estado,
      cell: (m) => <Badge variant={ESTADO_VARIANT[m.estado] ?? "default"}>{m.estado}</Badge>,
    },
    {
      key: "createdAt",
      header: "Data",
      sortable: true,
      hideOnMobile: true,
      sortValue: (m) => new Date(m.createdAt).getTime(),
      cell: (m) => <span className="text-xs text-slate-500">{formatDatePt(m.createdAt)}</span>,
    },
  ];

  useEffect(() => {
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) { const rows = (await r.json()) as AcaoOpt[]; setAcoes(rows); if (rows.length) setAcaoId(rows[0].id); }
    });
    void bffFetch("/api/v1/formandos", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) setFormandos((await r.json()) as FormandoOpt[]);
    });
  }, []);

  useEffect(() => {
    if (!acaoId) return;
    void bffFetch(`/api/v1/turmas?acaoFormacaoId=${encodeURIComponent(acaoId)}`, { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) { const rows = (await r.json()) as TurmaOpt[]; setTurmas(rows); if (rows.length) setTurmaId(rows[0].id); else setTurmaId(""); }
    });
  }, [acaoId]);

  const load = useCallback(async () => {
    if (!turmaId) { setMatriculas([]); return; }
    const r = await bffFetch(`/api/v1/matriculas?turmaId=${encodeURIComponent(turmaId)}`, { headers: { accept: "application/json" } });
    if (r.ok) setMatriculas((await r.json()) as MatriculaRow[]);
    else setError("Erro ao carregar matrículas.");
  }, [turmaId]);

  useEffect(() => { void load(); }, [load]);

  async function inscrever() {
    if (!canManage || !turmaId || !formandoId) return;
    setBusy(true); setError(null); setMsg(null);
    const r = await bffFetch("/api/v1/matriculas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ turmaId, formandoId }),
    });
    setBusy(false);
    if (!r.ok) { setError(await parseApiError(r)); return; }
    setMsg("Formando inscrito com sucesso.");
    setFormandoId("");
    await load();
  }

  async function mudarEstado(matriculaId: string, estado: string) {
    if (!canManage) return;
    setBusy(true); setError(null);
    const r = await bffFetch(`/api/v1/matriculas/${matriculaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ estado }),
    });
    setBusy(false);
    if (!r.ok) { setError("Erro ao actualizar estado."); return; }
    setMsg("Estado actualizado.");
    await load();
  }

  return (
    <>
      <PageHeader
        title="Inscrições / Matrículas"
        description="Gestão de inscrições de formandos nas turmas das acções de formação."
      />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Acção" value={acaoId} onChange={(e) => setAcaoId(e.target.value)}>
              {acoes.map((a) => <option key={a.id} value={a.id}>{a.codigoInterno} – {a.titulo}</option>)}
            </Select>
            <Select label="Turma" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.codigo} – {t.nome}</option>)}
            </Select>
            {canManage ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Inscrever formando</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Select value={formandoId} onChange={(e) => setFormandoId(e.target.value)} className="min-w-0 flex-1">
                    <option value="">Seleccionar...</option>
                    {formandos.map((f) => <option key={f.id} value={f.id}>{f.nome} (NIF {f.nif})</option>)}
                  </Select>
                  <Button onClick={() => void inscrever()} disabled={busy || !formandoId} className="w-full sm:w-auto sm:shrink-0">
                    Inscrever
                  </Button>
                </div>
                {formandos.length === 0 ? (
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                    Sem formandos na lista. Convida em{" "}
                    <Link href="/portal/utilizadores" className="text-blue-400 hover:text-blue-300">
                      Utilizadores
                    </Link>{" "}
                    (cargo FORMANDO + NIF) ou regista em{" "}
                    <Link href="/portal/formandos" className="text-blue-400 hover:text-blue-300">
                      Formandos
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-slate-700/40">
          <CardTitle>Matrículas ({matriculas.length})</CardTitle>
        </CardHeader>
        {matriculas.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Sem matrículas nesta turma.</div>
        ) : (
          <CardContent className="p-0">
            <PaginatedDataTable
              columns={MATRICULA_COLS}
              data={matriculas}
              keyField="id"
              paginationClassName="border-t border-slate-700/40 px-4 py-3"
              rowActions={
                canManage
                  ? (m) => (
                      <div className="flex items-center justify-end gap-1.5">
                        {m.estado === "ATIVA" ? (
                          <>
                            <Button size="sm" variant="teal" onClick={() => void mudarEstado(m.id, "CONCLUSAO")}>
                              Concluir
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => void mudarEstado(m.id, "DESISTENCIA")}>
                              Desistência
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => void mudarEstado(m.id, "ATIVA")}>
                            Reactivar
                          </Button>
                        )}
                      </div>
                    )
                  : undefined
              }
            />
          </CardContent>
        )}
      </Card>
    </>
  );
}
