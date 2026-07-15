"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Button, Card, CardContent, Input, Select } from "@/components/ui";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Curso", "Acção", "Conteúdos", "Sessão"] as const;

export function FormationSetupWizard() {
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [cursoId, setCursoId] = useState("");
  const [cursoForm, setCursoForm] = useState({
    designacao: "",
    codigoUfcd: "",
    cargaHoras: "25",
    modalidade: "presencial",
  });

  const [acaoId, setAcaoId] = useState("");
  const [acaoForm, setAcaoForm] = useState({
    codigoInterno: "",
    titulo: "",
    dataInicio: "",
    dataFim: "",
    estado: "PLANEADA",
  });

  const [skipConteudos, setSkipConteudos] = useState(false);
  const [skipSessao, setSkipSessao] = useState(true);

  const [cursos, setCursos] = useState<{ id: string; designacao: string; codigoUfcd: string | null }[]>([]);

  const loadCurso = useCallback(async (id: string) => {
    const r = await bffFetch(`/api/v1/cursos/${id}`, { headers: { accept: "application/json" } });
    if (!r.ok) return;
    const c = (await r.json()) as { designacao: string; codigoUfcd?: string | null; cargaHoras: number; modalidade: string };
    setCursoForm({
      designacao: c.designacao,
      codigoUfcd: c.codigoUfcd ?? "",
      cargaHoras: String(c.cargaHoras),
      modalidade: c.modalidade,
    });
  }, []);

  useEffect(() => {
    void bffFetch("/api/v1/cursos", { headers: { accept: "application/json" } }).then(async (r) => {
      if (!r.ok) return;
      const rows = (await r.json()) as { id: string; designacao: string; codigoUfcd: string | null }[];
      setCursos(rows);
      if (rows[0]?.id) {
        setCursoId(rows[0].id);
        void loadCurso(rows[0].id);
      }
    });
  }, [loadCurso]);

  async function saveCurso(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const body = {
      designacao: cursoForm.designacao.trim(),
      codigoUfcd: cursoForm.codigoUfcd.trim() || undefined,
      cargaHoras: Number(cursoForm.cargaHoras),
      modalidade: cursoForm.modalidade,
    };
    const isNew = !cursoId;
    const r = await bffFetch(isNew ? "/api/v1/cursos" : `/api/v1/cursos/${cursoId}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const saved = (await r.json()) as { id: string };
    setCursoId(saved.id);
    setMsg("Curso guardado.");
    setStep(2);
    if (!acaoForm.titulo) {
      setAcaoForm((f) => ({
        ...f,
        titulo: cursoForm.designacao.trim(),
        codigoInterno: f.codigoInterno || `AF-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      }));
    }
  }

  async function saveAcao(e: FormEvent) {
    e.preventDefault();
    if (!cursoId) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/acoes-formacao", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ ...acaoForm, cursoId }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const saved = (await r.json()) as { id: string };
    setAcaoId(saved.id);
    setMsg("Acção criada.");
    setStep(3);
  }

  function finishWizard() {
    setStep(4);
    setMsg("Formação base criada. Continua nos passos opcionais abaixo.");
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = step > n;
          const active = step === n;
          return (
            <div
              key={label}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                done
                  ? "border-teal-500/40 bg-teal-500/10 text-teal-300"
                  : active
                    ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                    : "border-slate-700/50 text-slate-600"
              }`}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{n}</span>}
              {label}
              {i < STEP_LABELS.length - 1 ? <ChevronRight className="h-3 w-3 opacity-40 hidden sm:block" /> : null}
            </div>
          );
        })}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {step === 1 ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-slate-400">
              Passo 1 — Define o curso (UFCD, horas e modalidade). Podes seleccionar um curso existente ou criar novo.
            </p>
            <Select
              label="Curso existente (opcional)"
              value={cursoId}
              onChange={(e) => {
                const id = e.target.value;
                setCursoId(id);
                if (id) void loadCurso(id);
                else setCursoForm({ designacao: "", codigoUfcd: "", cargaHoras: "25", modalidade: "presencial" });
              }}
            >
              <option value="">— Criar curso novo —</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigoUfcd ? `${c.codigoUfcd} – ` : ""}
                  {c.designacao}
                </option>
              ))}
            </Select>
            <form onSubmit={(e) => void saveCurso(e)} className="space-y-3">
              <Input
                label="Designação"
                required
                value={cursoForm.designacao}
                onChange={(e) => setCursoForm((p) => ({ ...p, designacao: e.target.value }))}
              />
              <Input
                label="Código UFCD"
                value={cursoForm.codigoUfcd}
                onChange={(e) => setCursoForm((p) => ({ ...p, codigoUfcd: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Carga horária"
                  type="number"
                  min={1}
                  value={cursoForm.cargaHoras}
                  onChange={(e) => setCursoForm((p) => ({ ...p, cargaHoras: e.target.value }))}
                />
                <Select
                  label="Modalidade"
                  value={cursoForm.modalidade}
                  onChange={(e) => setCursoForm((p) => ({ ...p, modalidade: e.target.value }))}
                >
                  <option value="presencial">Presencial</option>
                  <option value="b-learning">B-learning</option>
                  <option value="e-learning">E-learning</option>
                  <option value="online">Online (síncrono)</option>
                </Select>
              </div>
              <Button type="submit" disabled={busy}>
                Guardar curso e continuar
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-slate-400">Passo 2 — Cria a acção formativa ligada ao curso.</p>
            <form onSubmit={(e) => void saveAcao(e)} className="space-y-3">
              <Input
                label="Código interno"
                required
                value={acaoForm.codigoInterno}
                onChange={(e) => setAcaoForm((p) => ({ ...p, codigoInterno: e.target.value }))}
              />
              <Input
                label="Título"
                required
                value={acaoForm.titulo}
                onChange={(e) => setAcaoForm((p) => ({ ...p, titulo: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Início"
                  type="date"
                  required
                  value={acaoForm.dataInicio}
                  onChange={(e) => setAcaoForm((p) => ({ ...p, dataInicio: e.target.value }))}
                />
                <Input
                  label="Fim"
                  type="date"
                  required
                  value={acaoForm.dataFim}
                  onChange={(e) => setAcaoForm((p) => ({ ...p, dataFim: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Anterior
                </Button>
                <Button type="submit" disabled={busy}>
                  Criar acção
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-slate-400">
              Passo 3 — Conteúdos LMS (opcional). Os módulos ficam associados ao curso e são
              partilhados por todas as acções desse curso. Abre o editor visual ou salta para concluir.
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={skipConteudos}
                onChange={(e) => setSkipConteudos(e.target.checked)}
                className="rounded border-slate-600 accent-blue-500"
              />
              Saltar conteúdos por agora
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                Anterior
              </Button>
              {!skipConteudos ? (
                <Link
                  href={`/portal/fluxo?v=conteudos&cursoId=${encodeURIComponent(cursoId)}`}
                >
                  <Button type="button">Abrir editor de conteúdos</Button>
                </Link>
              ) : null}
              <Button type="button" onClick={finishWizard}>
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-slate-400">
              Passo 4 — Sessão e cronograma (opcional). Configura presenças e sala Teams na acção.
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={skipSessao}
                onChange={(e) => setSkipSessao(e.target.checked)}
                className="rounded border-slate-600 accent-blue-500"
              />
              Configurar sessões mais tarde
            </label>
            <div className="flex flex-wrap gap-2">
              {!skipSessao && acaoId ? (
                <Link href={`/portal/acoes/${acaoId}`}>
                  <Button type="button">Abrir acção (cronograma)</Button>
                </Link>
              ) : null}
              <Link href="/portal/fluxo">
                <Button type="button" variant="secondary">
                  Concluir
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
