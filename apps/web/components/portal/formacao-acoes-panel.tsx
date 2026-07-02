"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, PlusCircle } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Badge, Button, Dialog, DialogContent, Input } from "@/components/ui";

type Acao = {
  id: string;
  codigoInterno: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  inscricoes: "ABERTAS" | "FECHADAS";
  publicado: boolean;
  inscritos: number;
  totalSessoes: number;
};

type Props = {
  cursoUuid: string;
  cursoTitulo: string;
  canManage: boolean;
  onChanged: () => void;
};

const DIAS = [
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
  { v: 0, l: "Dom" },
];

const EMPTY_ACAO = {
  titulo: "",
  codigoInterno: "",
  dataInicio: "",
  dataFim: "",
  horaInicio: "18:30",
  horaFim: "22:00",
  repete: true,
  diasRepete: [1, 3, 5] as number[],
  local: "",
  inscricoes: "ABERTAS" as "ABERTAS" | "FECHADAS",
  publicado: true,
};

export function FormacaoAcoesPanel({ cursoUuid, cursoTitulo, canManage, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ACAO);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const r = await bffFetch(`/api/v1/formacoes/${cursoUuid}/acoes`, {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setAcoes((await r.json()) as Acao[]);
  }, [cursoUuid, open]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAcao(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/formacoes/${cursoUuid}/acoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        titulo: form.titulo.trim() || undefined,
        codigoInterno: form.codigoInterno.trim() || undefined,
        publicado: form.publicado,
        sessoes: {
          dataInicio: form.dataInicio,
          dataFim: form.dataFim,
          horaInicio: form.horaInicio,
          horaFim: form.horaFim,
          repete: form.repete,
          diasRepete: form.repete ? form.diasRepete : undefined,
          local: form.local.trim() || undefined,
          inscricoes: form.inscricoes,
        },
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setDialogOpen(false);
    setForm({ ...EMPTY_ACAO, titulo: cursoTitulo });
    await load();
    onChanged();
  }

  async function toggleAcaoPublicado(acao: Acao) {
    if (!canManage) return;
    setBusy(true);
    const r = await bffFetch(`/api/v1/formacoes/${cursoUuid}/acoes/${acao.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ publicado: !acao.publicado }),
    });
    setBusy(false);
    if (!r.ok) setError(await parseApiError(r));
    else {
      await load();
      onChanged();
    }
  }

  async function toggleInscricoes(acao: Acao) {
    if (!canManage) return;
    setBusy(true);
    const next = acao.inscricoes === "ABERTAS" ? "FECHADAS" : "ABERTAS";
    const r = await bffFetch(`/api/v1/formacoes/${cursoUuid}/acoes/${acao.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ inscricoes: next }),
    });
    setBusy(false);
    if (!r.ok) setError(await parseApiError(r));
    else {
      await load();
      onChanged();
    }
  }

  function toggleDia(d: number) {
    setForm((p) => ({
      ...p,
      diasRepete: p.diasRepete.includes(d)
        ? p.diasRepete.filter((x) => x !== d)
        : [...p.diasRepete, d].sort((a, b) => a - b),
    }));
  }

  return (
    <div className="w-full mt-2 border-t border-slate-700/40 pt-2">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Acções de formação
      </button>

      {open ? (
        <div className="mt-2 space-y-2">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {loading ? (
            <p className="text-xs text-slate-500">A carregar acções…</p>
          ) : (
            <>
              {acoes.map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-slate-700/40 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-slate-200 font-medium">{a.titulo}</p>
                    <p className="text-slate-500">
                      {a.codigoInterno} · {a.dataInicio} → {a.dataFim} · {a.totalSessoes} sessões ·{" "}
                      {a.inscritos} inscritos
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.inscricoes === "ABERTAS" ? "success" : "secondary"}>
                      {a.inscricoes}
                    </Badge>
                    <Badge variant={a.publicado ? "success" : "secondary"}>
                      {a.publicado ? "Publicada" : "Rascunho"}
                    </Badge>
                    {canManage ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void toggleInscricoes(a)}
                        >
                          Inscrições
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void toggleAcaoPublicado(a)}
                        >
                          {a.publicado ? "Despublicar" : "Publicar"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
              {!acoes.length ? (
                <p className="text-xs text-slate-500">Sem acções - crie uma para aparecer no website.</p>
              ) : null}
              {canManage ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setForm({ ...EMPTY_ACAO, titulo: cursoTitulo });
                    setDialogOpen(true);
                  }}
                >
                  <PlusCircle className="h-3.5 w-3.5 mr-1" /> Nova acção
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title="Nova acção de formação">
          <form onSubmit={(e) => void createAcao(e)} className="space-y-3 text-sm">
            <Input
              placeholder="Título (opcional)"
              value={form.titulo}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
            />
            <Input
              placeholder="Código interno (opcional)"
              value={form.codigoInterno}
              onChange={(e) => setForm((p) => ({ ...p, codigoInterno: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                required
                value={form.dataInicio}
                onChange={(e) => setForm((p) => ({ ...p, dataInicio: e.target.value }))}
              />
              <Input
                type="date"
                required
                value={form.dataFim}
                onChange={(e) => setForm((p) => ({ ...p, dataFim: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Hora início (HH:MM)"
                value={form.horaInicio}
                onChange={(e) => setForm((p) => ({ ...p, horaInicio: e.target.value }))}
                required
              />
              <Input
                placeholder="Hora fim (HH:MM)"
                value={form.horaFim}
                onChange={(e) => setForm((p) => ({ ...p, horaFim: e.target.value }))}
                required
              />
            </div>
            <Input
              placeholder="Local"
              value={form.local}
              onChange={(e) => setForm((p) => ({ ...p, local: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={form.repete}
                onChange={(e) => setForm((p) => ({ ...p, repete: e.target.checked }))}
              />
              Repetir em dias da semana
            </label>
            {form.repete ? (
              <div className="flex flex-wrap gap-1">
                {DIAS.map((d) => (
                  <button
                    key={d.v}
                    type="button"
                    className={`px-2 py-0.5 rounded text-xs border ${
                      form.diasRepete.includes(d.v)
                        ? "border-blue-500/50 bg-blue-500/20 text-blue-200"
                        : "border-slate-600 text-slate-400"
                    }`}
                    onClick={() => toggleDia(d.v)}
                  >
                    {d.l}
                  </button>
                ))}
              </div>
            ) : null}
            <select
              className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-200 text-sm"
              value={form.inscricoes}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  inscricoes: e.target.value as "ABERTAS" | "FECHADAS",
                }))
              }
            >
              <option value="ABERTAS">Inscrições abertas</option>
              <option value="FECHADAS">Inscrições fechadas</option>
            </select>
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={form.publicado}
                onChange={(e) => setForm((p) => ({ ...p, publicado: e.target.checked }))}
              />
              Publicar acção no website
            </label>
            <Button type="submit" disabled={busy} className="w-full">
              Criar acção
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
