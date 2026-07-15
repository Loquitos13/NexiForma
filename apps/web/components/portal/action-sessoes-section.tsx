"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Clock,
  GraduationCap,
  Layers,
  MapPin,
  Plus,
  Video,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from "@/components/ui";

type CronogramaRow = { id: string; versao: number; aprovadoEm: string | null };

type SessaoRow = {
  id: string;
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  estado: string;
  formador?: { nomeCompleto: string } | null;
  moduloUnidade?: { codigo: string | null; titulo: string } | null;
};

type FormadorOpt = { id: string; nomeCompleto: string };
type ModuloOpt = { id: string; codigo: string | null; titulo: string };

const MODALIDADES = [
  { value: "presencial", label: "Presencial", icon: MapPin },
  { value: "b-learning", label: "B-learning", icon: Layers },
  { value: "online", label: "Online", icon: Video },
] as const;

function sessaoEstadoBadge(estado: string) {
  const map: Record<string, "yellow" | "green" | "red" | "default"> = {
    AGENDADA: "yellow",
    REALIZADA: "green",
    CANCELADA: "red",
  };
  const labels: Record<string, string> = {
    AGENDADA: "Agendada",
    REALIZADA: "Realizada",
    CANCELADA: "Cancelada",
  };
  return <Badge variant={map[estado] ?? "default"}>{labels[estado] ?? estado}</Badge>;
}

type Props = {
  acaoId: string;
  cursoId: string;
  canManage: boolean;
};

export function ActionSessoesSection({ acaoId, cursoId, canManage }: Props) {
  const [cronogramaId, setCronogramaId] = useState("");
  const [cronogramaVersao, setCronogramaVersao] = useState<number | null>(null);
  const [sessoes, setSessoes] = useState<SessaoRow[]>([]);
  const [formadores, setFormadores] = useState<FormadorOpt[]>([]);
  const [modulos, setModulos] = useState<ModuloOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    numeroSessao: "1",
    data: "",
    horaInicio: "09:00",
    horaFim: "12:30",
    modalidade: "presencial",
    formadorId: "",
    moduloUnidadeId: "",
  });

  const ordenadas = useMemo(
    () =>
      [...sessoes].sort(
        (a, b) =>
          a.numeroSessao - b.numeroSessao ||
          String(a.data).localeCompare(String(b.data)),
      ),
    [sessoes],
  );

  const loadSessoes = useCallback(async (cronoId: string) => {
    if (!cronoId) {
      setSessoes([]);
      return;
    }
    const res = await bffFetch(`/api/v1/sessoes-formacao?cronogramaId=${encodeURIComponent(cronoId)}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      setError(await parseApiError(res));
      setSessoes([]);
      return;
    }
    const rows = (await res.json()) as SessaoRow[];
    setSessoes(rows);
    const nextNum = rows.length ? Math.max(...rows.map((s) => s.numeroSessao)) + 1 : 1;
    setForm((f) => ({ ...f, numeroSessao: String(nextNum) }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const cronoRes = await bffFetch(`/api/v1/cronogramas?acaoFormacaoId=${encodeURIComponent(acaoId)}`, {
      headers: { accept: "application/json" },
    });
    if (!cronoRes.ok) {
      setError(await parseApiError(cronoRes));
      setLoading(false);
      return;
    }
    const cronos = (await cronoRes.json()) as CronogramaRow[];
    const ativo = cronos[0];
    if (!ativo) {
      setCronogramaId("");
      setCronogramaVersao(null);
      setSessoes([]);
      setLoading(false);
      return;
    }
    setCronogramaId(ativo.id);
    setCronogramaVersao(ativo.versao);
    await loadSessoes(ativo.id);
    setLoading(false);
  }, [acaoId, loadSessoes]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void bffFetch("/api/v1/formadores", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) setFormadores((await r.json()) as FormadorOpt[]);
    });
    void bffFetch(`/api/v1/conteudos-lms/unidades?cursoId=${encodeURIComponent(cursoId)}`, {
      headers: { accept: "application/json" },
    }).then(async (r) => {
      if (r.ok) setModulos((await r.json()) as ModuloOpt[]);
    });
  }, [cursoId]);

  async function criarCronograma() {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    const res = await bffFetch("/api/v1/cronogramas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ acaoFormacaoId: acaoId }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Cronograma criado.");
    await load();
  }

  async function submitSessao(e: FormEvent) {
    e.preventDefault();
    if (!cronogramaId || !canManage) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/sessoes-formacao", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        cronogramaId,
        numeroSessao: Number(form.numeroSessao),
        data: form.data,
        horaInicio: form.horaInicio,
        horaFim: form.horaFim,
        modalidade: form.modalidade,
        formadorId: form.formadorId || undefined,
        moduloUnidadeId: form.moduloUnidadeId || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg(`Sessão ${form.numeroSessao} agendada.`);
    setShowForm(false);
    await loadSessoes(cronogramaId);
  }

  if (loading) {
    return <p className="text-sm text-slate-500 py-8 text-center">A carregar sessões…</p>;
  }

  if (!cronogramaId) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <CalendarPlus className="h-10 w-10 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-400">Esta acção ainda não tem cronograma.</p>
          {canManage ? (
            <Button onClick={() => void criarCronograma()} disabled={busy}>
              Criar cronograma
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-200">Sessões programadas</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Cronograma v{cronogramaVersao} · {ordenadas.length} sessão(ões)
          </p>
        </div>
        {canManage ? (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            {showForm ? "Fechar" : "Nova sessão"}
          </Button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Agendar nova sessão</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void submitSessao(e)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="N.º sessão"
                type="number"
                min={1}
                value={form.numeroSessao}
                onChange={(e) => setForm((f) => ({ ...f, numeroSessao: e.target.value }))}
                required
              />
              <Input
                label="Data"
                type="date"
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                required
              />
              <Select
                label="Modalidade"
                value={form.modalidade}
                onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value }))}
              >
                {MODALIDADES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Início"
                value={form.horaInicio}
                onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))}
                placeholder="09:00"
                required
              />
              <Input
                label="Fim"
                value={form.horaFim}
                onChange={(e) => setForm((f) => ({ ...f, horaFim: e.target.value }))}
                placeholder="12:30"
                required
              />
              <Select
                label="Formador"
                value={form.formadorId}
                onChange={(e) => setForm((f) => ({ ...f, formadorId: e.target.value }))}
              >
                <option value="">- opcional -</option>
                {formadores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nomeCompleto}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-2">
                <Select
                  label="Unidade pedagógica"
                  value={form.moduloUnidadeId}
                  onChange={(e) => setForm((f) => ({ ...f, moduloUnidadeId: e.target.value }))}
                >
                  <option value="">- opcional -</option>
                  {modulos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.codigo ? `${m.codigo} · ` : ""}
                      {m.titulo}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex gap-2 pt-1">
                <Button type="submit" disabled={busy}>
                  {busy ? "A guardar…" : "Agendar sessão"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {ordenadas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-slate-500">Nenhuma sessão agendada para esta acção.</p>
            {canManage ? (
              <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5" />
                Agendar primeira sessão
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {ordenadas.map((s) => {
            const ModIcon = MODALIDADES.find((m) => m.value === s.modalidade)?.icon ?? MapPin;
            return (
              <Card
                key={s.id}
                className="border-slate-700/30 bg-slate-900/30 transition-colors hover:border-slate-600/40"
              >
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-slate-100">
                        S{s.numeroSessao}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{formatDatePt(s.data)}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {s.horaInicio} – {s.horaFim}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge variant="default" className="gap-1">
                            <ModIcon className="h-3 w-3" />
                            {s.modalidade}
                          </Badge>
                          {sessaoEstadoBadge(s.estado)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 space-y-1">
                      {s.formador ? (
                        <p className="flex items-center gap-1 justify-end text-slate-400">
                          <GraduationCap className="h-3 w-3" />
                          {s.formador.nomeCompleto}
                        </p>
                      ) : null}
                      {s.moduloUnidade ? (
                        <p className="flex items-center gap-1 justify-end">
                          <Layers className="h-3 w-3" />
                          {s.moduloUnidade.codigo ?? s.moduloUnidade.titulo}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Presenças, folhas e sessões online em{" "}
        <Link href={`/portal/acoes/${acaoId}?tab=cronograma`} className="text-blue-400 hover:text-blue-300">
          Cronograma
        </Link>
        .
      </p>
    </div>
  );
}
