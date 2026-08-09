"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { bffFetch } from "@/lib/client/bff-fetch";
import { bffQuery } from "@/lib/client/bff-query";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  buildMonthGridCells,
  dayFromDateKey,
  formatDateKeyPt,
  formatLocalDateKey,
  monthLoadRange,
} from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { Alert, Card, PageHeader } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { CrmReuniaoTeamsControls } from "@/components/crm/crm-reuniao-teams-controls";
import { SessaoFormacaoPresencaControls } from "@/components/lms/sessao-formacao-presenca-controls";

export type CalendarioEventoRow = {
  id: string;
  tipo: string;
  titulo: string;
  subtitulo?: string;
  data: string;
  horaInicio: string;
  horaFim?: string;
  modalidade?: string;
  estado?: string;
  numeroSessao?: number;
  editavel?: boolean;
  criadoPorNome?: string;
  fonteId?: string;
  salaJoinUrl?: string | null;
  reuniaoEstado?: string | null;
  reuniaoIniciadaEm?: string | null;
  reuniaoTerminadaEm?: string | null;
  reuniaoDuracaoSegundos?: number | null;
  iniciadaEm?: string | null;
  terminadaEm?: string | null;
  formadorEntradaEm?: string | null;
  formadorDuracaoSegundos?: number | null;
  lmsAtivo?: boolean;
  matriculaId?: string | null;
  acaoFormacaoId?: string | null;
};

type TenantUserOption = { id: string; displayName: string; email: string };
type ClienteOpt = { id: string; nome: string; nif: string };

const GRUPOS_DESTINATARIO = [
  { value: "COMERCIAL", label: "Equipa comercial" },
  { value: "FORMANDO", label: "Formandos" },
  { value: "FORMADOR", label: "Formadores" },
  { value: "COORDENADOR_PEDAGOGICO", label: "Coord. Pedagógico" },
  { value: "COORDENADOR_COMERCIAL", label: "Coord. Comercial" },
  { value: "COORDENADOR_FINANCEIRO", label: "Coord. Financeiro" },
  { value: "ADMIN", label: "Administradores" },
  { value: "FINANCEIRO", label: "Financeiro" },
] as const;

type PortalCalendarioViewProps = {
  /** Vista formando: oculta reuniões CRM e eventos de gestor na criação */
  formandoMode?: boolean;
  title?: string;
  description?: string;
};

const TIPO_LABEL: Record<string, string> = {
  SESSAO_FORMACAO: "Sessão",
  REUNIAO_CRM: "Reunião",
  LEMBRETE: "Lembrete",
  EVENTO: "Evento",
  PRAZO_LMS: "Prazo LMS",
  FERIADO: "Feriado",
};

const TIPO_CHIP: Record<string, string> = {
  SESSAO_FORMACAO: "bg-blue-500/15 text-blue-300",
  REUNIAO_CRM: "bg-violet-500/15 text-violet-300",
  LEMBRETE: "bg-amber-500/15 text-amber-300",
  EVENTO: "bg-emerald-500/15 text-emerald-300",
  PRAZO_LMS: "bg-orange-500/15 text-orange-300",
  FERIADO: "bg-rose-500/15 text-rose-300",
};

function defaultHora(data: string): string {
  return `${data}T09:00`;
}

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PortalCalendarioView({
  formandoMode = false,
  title = "Calendário",
  description = "Sessões, reuniões, lembretes e prazos - clique num dia para ver eventos ou em «+ Agendar».",
}: PortalCalendarioViewProps) {
  const searchParams = useSearchParams();
  const { role, canManage, isComercial, writeDisabled } = useTenantRole();
  const [eventos, setEventos] = useState<CalendarioEventoRow[]>([]);
  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUserOption[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [podeCriarSalaTeams, setPodeCriarSalaTeams] = useState(false);
  const [teamsIntegracaoAviso, setTeamsIntegracaoAviso] = useState<string | null>(null);
  const [teamsDisponibilidadeLoading, setTeamsDisponibilidadeLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fonteId: "",
    titulo: "",
    descricao: "",
    inicio: "",
    fim: "",
    entidadeClienteId: "",
  });
  const dayPanelRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    kind: "LEMBRETE" as "LEMBRETE" | "REUNIAO" | "EVENTO",
    titulo: "",
    descricao: "",
    inicio: "",
    fim: "",
    entidadeClienteId: "",
    alvoUserIds: [] as string[],
    alvoRoles: [] as string[],
    criarSalaTeams: false,
  });

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const hoje = formatLocalDateKey(new Date());
  const dias = useMemo(() => buildMonthGridCells(ano, mes), [ano, mes]);

  const canCreateReuniao = !formandoMode && (canManage || isComercial);
  const canCreateEvento = !formandoMode && canManage;
  const canCreateAnything = !writeDisabled && (canCreateReuniao || canCreateEvento || true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { inicio, fim } = monthLoadRange(ano, mes);

    try {
      const r = await bffQuery("/api/v1/calendario/eventos", {
        body: { inicio, fim },
      });
      if (!r.ok) {
        setError(r.status === 403 ? "Sem permissão para o calendário." : await parseApiError(r));
        setEventos([]);
        return;
      }
      setEventos((await r.json()) as CalendarioEventoRow[]);
    } catch {
      setError("Erro ao carregar calendário.");
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => {
    const dataParam = searchParams.get("data");
    if (dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
      setSelectedDate(dataParam);
      const [y, m] = dataParam.split("-").map(Number);
      if (y && m) setMesAtual(new Date(y, m - 1, 1));
    }
    const reuniaoId = searchParams.get("reuniao");
    if (reuniaoId) {
      setSelectedEventId(`reuniao-${reuniaoId}`);
    }
  }, [searchParams]);

  useEffect(() => {
    const reuniaoId = searchParams.get("reuniao");
    if (!reuniaoId || eventos.length === 0) return;
    const match = eventos.find((e) => e.fonteId === reuniaoId || e.id === `reuniao-${reuniaoId}`);
    if (!match) return;
    setSelectedDate(match.data);
    setSelectedEventId(match.id);
  }, [searchParams, eventos]);

  useEffect(() => {
    if (!selectedEventId || !dayPanelRef.current) return;
    dayPanelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedEventId, selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadTeamsDisponibilidade = useCallback(async () => {
    if (formandoMode) return;
    setTeamsDisponibilidadeLoading(true);
    try {
      const requests: Promise<Response>[] = [
        bffFetch("/api/v1/integracoes/disponibilidade", { headers: { accept: "application/json" } }),
      ];
      if (canManage) {
        requests.push(
          bffFetch("/api/v1/integracoes/oauth/status", { headers: { accept: "application/json" } }),
        );
      }
      const [dRes, oauthRes] = await Promise.all(requests);

      let ready = false;
      let aviso: string | null = null;

      if (dRes.ok) {
        const data = (await dRes.json()) as {
          podeCriarSalaTeams?: boolean;
          teams?: { aviso?: string | null; ready?: boolean };
        };
        ready = Boolean(data.podeCriarSalaTeams ?? data.teams?.ready);
        aviso = data.teams?.aviso ?? null;
      } else if (dRes.status === 403) {
        aviso = "Integração Teams não disponível para o seu perfil ou plano.";
      } else {
        aviso = "Não foi possível verificar a integração Teams.";
      }

      if (!ready && oauthRes?.ok) {
        const oauth = (await oauthRes.json()) as { teams?: { ready?: boolean; missing?: string[] } };
        if (oauth.teams?.ready) {
          ready = true;
          aviso = null;
        } else if (!aviso && oauth.teams?.missing?.length) {
          aviso = `Teams não configurado (${oauth.teams.missing.join(", ")})`;
        }
      }

      setPodeCriarSalaTeams(ready);
      setTeamsIntegracaoAviso(aviso);
    } finally {
      setTeamsDisponibilidadeLoading(false);
    }
  }, [canManage, formandoMode]);

  useEffect(() => {
    if (formandoMode) return;
    void (async () => {
      if (!canCreateReuniao) return;
      const cRes = await bffFetch("/api/v1/entidades-cliente", {
        headers: { accept: "application/json" },
      });
      if (cRes.ok) setClientes((await cRes.json()) as ClienteOpt[]);
    })();
    void loadTeamsDisponibilidade();
  }, [canCreateReuniao, formandoMode, loadTeamsDisponibilidade]);

  useEffect(() => {
    if (!dialogOpen || form.kind !== "REUNIAO") return;
    void loadTeamsDisponibilidade();
  }, [dialogOpen, form.kind, loadTeamsDisponibilidade]);

  useEffect(() => {
    if (podeCriarSalaTeams) return;
    setForm((f) => (f.criarSalaTeams ? { ...f, criarSalaTeams: false } : f));
  }, [podeCriarSalaTeams]);

  useEffect(() => {
    if (!dialogOpen || form.kind !== "REUNIAO" || !podeCriarSalaTeams) return;
    setForm((f) => (f.criarSalaTeams ? f : { ...f, criarSalaTeams: true }));
  }, [dialogOpen, form.kind, podeCriarSalaTeams]);

  useEffect(() => {
    if (!canManage || formandoMode) return;
    void (async () => {
      const r = await bffFetch("/api/v1/users", { headers: { accept: "application/json" } });
      if (!r.ok) return;
      const rows = (await r.json()) as TenantUserOption[];
      setTenantUsers(rows.filter((u) => u.id));
    })();
  }, [canManage, formandoMode]);

  const eventosDoDia = (data: string) =>
    eventos.filter((e) => e.data === data).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  const selectEvent = (evento: CalendarioEventoRow, data: string) => {
    setSelectedDate(data);
    setSelectedEventId(evento.id);
  };

  const openCreateDialog = (data: string) => {
    setSelectedDate(data);
    setForm({
      kind: canCreateReuniao ? "REUNIAO" : canCreateEvento ? "EVENTO" : "LEMBRETE",
      titulo: "",
      descricao: "",
      inicio: defaultHora(data),
      fim: "",
      entidadeClienteId: "",
      alvoUserIds: [],
      alvoRoles: [],
      criarSalaTeams: true,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleDayClick = (data: string) => {
    setSelectedDate(data);
    setSelectedEventId(null);
  };

  const reuniaoEditavel = (e: CalendarioEventoRow) =>
    e.tipo === "REUNIAO_CRM" &&
    !!e.fonteId &&
    e.reuniaoEstado !== "EM_CURSO" &&
    e.reuniaoEstado !== "CONCLUIDA" &&
    e.estado !== "EM_CURSO" &&
    e.estado !== "CONCLUIDA";

  const openEditReuniao = async (e: CalendarioEventoRow) => {
    if (!e.fonteId) return;
    setEditFormError(null);
    const r = await bffFetch(`/api/v1/crm/interaccoes/${e.fonteId}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const row = (await r.json()) as {
      titulo?: string | null;
      notasLivres?: string | null;
      agendadoPara?: string | null;
      agendadoFim?: string | null;
      entidadeCliente?: { id: string } | null;
    };
    setEditForm({
      fonteId: e.fonteId,
      titulo: row.titulo?.trim() || e.titulo,
      descricao: row.notasLivres?.trim() || "",
      inicio: row.agendadoPara ? isoToDatetimeLocal(row.agendadoPara) : `${e.data}T${e.horaInicio}`,
      fim: row.agendadoFim
        ? isoToDatetimeLocal(row.agendadoFim)
        : e.horaFim
          ? `${e.data}T${e.horaFim}`
          : "",
      entidadeClienteId: row.entidadeCliente?.id ?? "",
    });
    setEditDialogOpen(true);
  };

  const submitEditReuniao = async () => {
    if (!editForm.fonteId || !editForm.titulo.trim()) {
      setEditFormError("Indique um título.");
      return;
    }
    setEditSaving(true);
    setEditFormError(null);
    try {
      const r = await bffFetch(`/api/v1/crm/interaccoes/${editForm.fonteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          titulo: editForm.titulo.trim(),
          notasLivres: editForm.descricao.trim() || editForm.titulo.trim(),
          agendadoPara: new Date(editForm.inicio).toISOString(),
          agendadoFim: editForm.fim ? new Date(editForm.fim).toISOString() : undefined,
          entidadeClienteId: editForm.entidadeClienteId || undefined,
        }),
      });
      if (!r.ok) {
        setEditFormError(await parseApiError(r));
        return;
      }
      setEditDialogOpen(false);
      await load();
    } catch {
      setEditFormError("Erro ao guardar.");
    } finally {
      setEditSaving(false);
    }
  };

  const removeReuniao = async (fonteId: string) => {
    if (!window.confirm("Cancelar esta reunião CRM?")) return;
    const r = await bffFetch(`/api/v1/crm/interaccoes/${fonteId}`, { method: "DELETE" });
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setSelectedEventId(null);
    await load();
  };

  const submitCreate = async () => {
    if (!form.titulo.trim()) {
      setFormError("Indique um título.");
      return;
    }
    setSaving(true);
    setFormError(null);

    try {
      if (form.kind === "REUNIAO") {
        const r = await bffFetch("/api/v1/crm/interaccoes", {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            tipo: "REUNIAO",
            titulo: form.titulo.trim(),
            notasLivres: form.descricao.trim() || form.titulo.trim() || undefined,
            agendadoPara: new Date(form.inicio).toISOString(),
            agendadoFim: form.fim ? new Date(form.fim).toISOString() : undefined,
            entidadeClienteId: form.entidadeClienteId || undefined,
            criarSalaTeams: form.criarSalaTeams && podeCriarSalaTeams ? true : undefined,
          }),
        });
        if (!r.ok) {
          setFormError(await parseApiError(r));
          return;
        }
      } else {
        const r = await bffFetch("/api/v1/calendario/notas", {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            tipo: form.kind,
            titulo: form.titulo.trim(),
            descricao: form.descricao.trim() || undefined,
            inicio: new Date(form.inicio).toISOString(),
            fim: form.fim ? new Date(form.fim).toISOString() : undefined,
            entidadeClienteId:
              form.kind === "LEMBRETE" || form.kind === "EVENTO"
                ? form.entidadeClienteId || undefined
                : undefined,
            alvoUserIds:
              form.kind === "EVENTO" || (form.kind === "LEMBRETE" && canManage)
                ? form.alvoUserIds
                : undefined,
            alvoRoles:
              form.kind === "EVENTO" || (form.kind === "LEMBRETE" && canManage)
                ? form.alvoRoles
                : undefined,
          }),
        });
        if (!r.ok) {
          setFormError(await parseApiError(r));
          return;
        }
      }

      setDialogOpen(false);
      await load();
    } catch {
      setFormError("Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  const removeNota = async (fonteId: string) => {
    if (!window.confirm("Remover este lembrete/evento?")) return;
    const r = await bffFetch(`/api/v1/calendario/notas/${fonteId}`, { method: "DELETE" });
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    await load();
  };

  const eventLabel = (e: CalendarioEventoRow) => {
    if (e.tipo === "SESSAO_FORMACAO") {
      const codigo = e.titulo.split("–")[0]?.trim() ?? e.titulo;
      return `${codigo} S${e.numeroSessao ?? ""} ${e.horaInicio}`.trim();
    }
    return `${TIPO_LABEL[e.tipo] ?? e.tipo} ${e.horaInicio}`;
  };

  if (loading && eventos.length === 0) {
    return <PageContentSkeleton />;
  }

  return (
    <>
      <PageHeader title={title} description={description} />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

      <Card className="mb-6 overflow-x-auto">
        <div className="flex min-w-[280px] flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4 border-b border-slate-700/30">
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}
            className="px-2 py-1.5 sm:px-3 rounded-lg border border-slate-600/40 text-xs sm:text-sm text-slate-400 hover:bg-slate-800/40 transition-colors"
          >
            ← <span className="hidden sm:inline">{new Date(ano, mes - 1, 1).toLocaleDateString("pt-PT", { month: "short" })}</span>
          </button>
          <h2 className="text-sm sm:text-lg font-bold text-slate-100 text-center">
            {new Date(ano, mes, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}
            className="px-2 py-1.5 sm:px-3 rounded-lg border border-slate-600/40 text-xs sm:text-sm text-slate-400 hover:bg-slate-800/40 transition-colors"
          >
            <span className="hidden sm:inline">{new Date(ano, mes + 1, 1).toLocaleDateString("pt-PT", { month: "short" })}</span> →
          </button>
        </div>

        <div className="grid min-w-[280px] grid-cols-7 text-center">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((d) => (
            <div
              key={d}
              className="py-1.5 sm:py-2 text-[9px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-700/20"
            >
              <span className="sm:hidden">{d.charAt(0)}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
          {dias.map((data, i) => (
            <button
              key={data ?? `blank-${i}`}
              type="button"
              disabled={!data}
              onClick={() => data && handleDayClick(data)}
              className={`min-h-[52px] sm:min-h-[72px] p-1 sm:p-1.5 border border-slate-700/10 text-left transition-colors ${
                !data
                  ? "bg-slate-900/30"
                  : data === hoje
                    ? "bg-blue-500/5"
                    : data === selectedDate
                      ? "bg-blue-500/10 ring-1 ring-blue-500/30"
                      : "hover:bg-slate-800/30 cursor-pointer"
              }`}
            >
              {data ? (
                <>
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                      data === hoje ? "bg-blue-600 text-white" : "text-slate-400"
                    }`}
                  >
                    {dayFromDateKey(data)}
                  </span>
                  {eventosDoDia(data).length > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {eventosDoDia(data)
                        .slice(0, 3)
                        .map((e) => (
                          <div
                            key={e.id}
                            role="button"
                            tabIndex={0}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              selectEvent(e, data);
                            }}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter" || ev.key === " ") {
                                ev.preventDefault();
                                ev.stopPropagation();
                                selectEvent(e, data);
                              }
                            }}
                            className={`text-[9px] leading-tight truncate px-1 py-0.5 rounded cursor-pointer hover:ring-1 hover:ring-white/20 ${
                              selectedEventId === e.id ? "ring-1 ring-violet-400/60" : ""
                            } ${TIPO_CHIP[e.tipo] ?? "bg-slate-500/15 text-slate-300"}`}
                          >
                            {eventLabel(e)}
                          </div>
                        ))}
                      {eventosDoDia(data).length > 3 ? (
                        <div className="text-[9px] text-slate-500 px-1">+{eventosDoDia(data).length - 3} mais</div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </button>
          ))}
        </div>
      </Card>

      {selectedDate ? (
        <div
          ref={dayPanelRef}
          className="mb-6 rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-slate-200">
              {formatDateKeyPt(selectedDate)}
            </h3>
            {canCreateAnything ? (
              <button
                type="button"
                onClick={() => openCreateDialog(selectedDate)}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
              >
                + Agendar
              </button>
            ) : null}
          </div>
          {eventosDoDia(selectedDate).length === 0 ? (
            <p className="text-sm text-slate-500">Sem eventos neste dia.</p>
          ) : (
            <div className="space-y-2">
              {eventosDoDia(selectedDate).map((e) => (
                <div
                  key={e.id}
                  className={`p-3 rounded-xl border transition-colors ${
                    selectedEventId === e.id
                      ? "bg-violet-500/10 border-violet-500/30 ring-1 ring-violet-500/20"
                      : "bg-slate-800/40 border-slate-700/20"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => selectEvent(e, selectedDate)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${TIPO_CHIP[e.tipo] ?? "bg-slate-500/10 text-slate-400"}`}
                        >
                          {TIPO_LABEL[e.tipo] ?? e.tipo}
                        </span>
                        <p className="text-sm font-medium text-slate-200">{e.titulo}</p>
                      </div>
                      {e.subtitulo ? (
                        <p className="text-xs text-slate-500 mt-0.5">{e.subtitulo}</p>
                      ) : null}
                      <p className="text-xs text-slate-500 mt-1">
                        {e.horaInicio}
                        {e.horaFim ? `–${e.horaFim}` : ""}
                        {e.modalidade ? ` · ${e.modalidade}` : ""}
                        {e.estado ? ` · ${e.estado}` : ""}
                        {e.criadoPorNome && role === "tenant_manager" ? ` · ${e.criadoPorNome}` : ""}
                      </p>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {e.editavel && (e.tipo === "LEMBRETE" || e.tipo === "EVENTO") ? (
                        <button
                          type="button"
                          onClick={() => {
                            const id = e.fonteId ?? e.id.replace(/^nota-/, "");
                            void removeNota(id);
                          }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remover
                        </button>
                      ) : null}
                      {canCreateReuniao && reuniaoEditavel(e) ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void openEditReuniao(e)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => e.fonteId && void removeReuniao(e.fonteId)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {e.tipo === "REUNIAO_CRM" && e.fonteId ? (
                    <CrmReuniaoTeamsControls
                      reuniao={{
                        fonteId: e.fonteId,
                        salaJoinUrl: e.salaJoinUrl,
                        reuniaoEstado: e.reuniaoEstado ?? e.estado,
                        reuniaoIniciadaEm: e.reuniaoIniciadaEm,
                        reuniaoTerminadaEm: e.reuniaoTerminadaEm,
                        reuniaoDuracaoSegundos: e.reuniaoDuracaoSegundos,
                      }}
                      podeCriarSalaTeams={podeCriarSalaTeams}
                      teamsAviso={teamsIntegracaoAviso}
                      writeDisabled={writeDisabled || !canCreateReuniao}
                      onUpdated={load}
                    />
                  ) : null}
                  {e.tipo === "SESSAO_FORMACAO" && e.fonteId ? (
                    <SessaoFormacaoPresencaControls
                      sessao={{
                        fonteId: e.fonteId,
                        acaoFormacaoId: e.acaoFormacaoId,
                        salaJoinUrl: e.salaJoinUrl,
                        iniciadaEm: e.iniciadaEm,
                        terminadaEm: e.terminadaEm,
                        formadorEntradaEm: e.formadorEntradaEm,
                        formadorDuracaoSegundos: e.formadorDuracaoSegundos,
                        lmsAtivo: e.lmsAtivo,
                        modalidade: e.modalidade,
                      }}
                      podeGerir={
                        !formandoMode &&
                        (role === "formador" || role === "tenant_manager")
                      }
                      reuniaoHref={
                        formandoMode && e.matriculaId && e.iniciadaEm && !e.terminadaEm
                          ? `/portal/formando/reuniao?matriculaId=${encodeURIComponent(e.matriculaId)}&sessaoFormacaoId=${encodeURIComponent(e.fonteId)}`
                          : null
                      }
                      writeDisabled={writeDisabled}
                      onUpdated={load}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          title="Agendar"
          description={
            selectedDate
              ? `Novo evento em ${formatDateKeyPt(selectedDate)}`
              : "Novo evento"
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo</label>
              <select
                value={form.kind}
                onChange={(ev) => {
                  const kind = ev.target.value as typeof form.kind;
                  setForm((f) => ({
                    ...f,
                    kind,
                    criarSalaTeams: kind === "REUNIAO" ? true : f.criarSalaTeams,
                  }));
                }}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="LEMBRETE">Lembrete</option>
                {canCreateReuniao ? <option value="REUNIAO">Reunião CRM</option> : null}
                {canCreateEvento ? <option value="EVENTO">Evento (opcional: com alvos)</option> : null}
              </select>
            </div>

            {canCreateReuniao &&
            (form.kind === "REUNIAO" || form.kind === "LEMBRETE" || form.kind === "EVENTO") ? (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cliente (opcional)</label>
                <select
                  value={form.entidadeClienteId}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, entidadeClienteId: ev.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">- Não relacionado com cliente -</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.nif})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {canCreateReuniao && form.kind === "REUNIAO" ? (
              <div className="space-y-2 rounded-lg border border-slate-700/40 bg-slate-800/20 px-3 py-3">
                <label
                  className={`flex items-center gap-2 text-sm text-slate-200 ${
                    podeCriarSalaTeams ? "cursor-pointer" : "cursor-not-allowed opacity-80"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.criarSalaTeams}
                    disabled={!podeCriarSalaTeams || teamsDisponibilidadeLoading}
                    onChange={(ev) =>
                      setForm((f) => ({ ...f, criarSalaTeams: ev.target.checked }))
                    }
                    className="rounded border-slate-600 disabled:opacity-60"
                  />
                  Criar sala Microsoft Teams (link partilhável com o cliente)
                </label>
                {teamsDisponibilidadeLoading ? (
                  <p className="text-xs text-slate-500 px-1">A verificar integração Teams…</p>
                ) : !podeCriarSalaTeams ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 space-y-1.5">
                    <p className="text-xs text-amber-300/95">
                      {teamsIntegracaoAviso ??
                        "Teams ainda não está pronto neste tenant. Configure Azure Tenant ID e organizador M365."}
                    </p>
                    {canManage ? (
                      <Link
                        href="/portal/integracoes"
                        className="inline-block text-xs font-medium text-blue-400 hover:text-blue-300"
                      >
                        Configurar em Integrações →
                      </Link>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Peça ao administrador do tenant para configurar Teams em Integrações.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="block text-xs text-slate-400 mb-1">Título</label>
              <input
                value={form.titulo}
                onChange={(ev) => setForm((f) => ({ ...f, titulo: ev.target.value }))}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Notas</label>
              <textarea
                value={form.descricao}
                onChange={(ev) => setForm((f) => ({ ...f, descricao: ev.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Início</label>
                <input
                  type="datetime-local"
                  value={form.inicio.slice(0, 16)}
                  onChange={(ev) => setForm((f) => ({ ...f, inicio: ev.target.value }))}
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fim (opcional)</label>
                <input
                  type="datetime-local"
                  value={form.fim ? form.fim.slice(0, 16) : ""}
                  onChange={(ev) => setForm((f) => ({ ...f, fim: ev.target.value }))}
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            </div>

            {(form.kind === "EVENTO" || form.kind === "LEMBRETE") && canManage ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">Grupos</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {GRUPOS_DESTINATARIO.map((g) => (
                      <label
                        key={g.value}
                        className="flex items-center gap-2 rounded-lg border border-slate-700/40 bg-slate-800/30 px-3 py-2 text-sm text-slate-200 cursor-pointer hover:bg-slate-800/50"
                      >
                        <input
                          type="checkbox"
                          checked={form.alvoRoles.includes(g.value)}
                          onChange={(ev) => {
                            setForm((f) => ({
                              ...f,
                              alvoRoles: ev.target.checked
                                ? [...f.alvoRoles, g.value]
                                : f.alvoRoles.filter((r) => r !== g.value),
                            }));
                          }}
                          className="rounded border-slate-600"
                        />
                        {g.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Utilizadores</label>
                  <select
                    multiple
                    value={form.alvoUserIds}
                    onChange={(ev) => {
                      const selected = Array.from(ev.target.selectedOptions).map((o) => o.value);
                      setForm((f) => ({ ...f, alvoUserIds: selected }));
                    }}
                    className="w-full min-h-[100px] rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
                  >
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-[11px] text-slate-500">
                  Opcional - sem grupos nem utilizadores, o evento fica só para si. Pode combinar
                  grupos e pessoas individuais.
                </p>
              </div>
            ) : null}

            {formError ? <p className="text-sm text-red-400">{formError}</p> : null}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitCreate()}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent title="Editar reunião CRM" description="Altere data, título ou cliente.">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cliente (opcional)</label>
              <select
                value={editForm.entidadeClienteId}
                onChange={(ev) =>
                  setEditForm((f) => ({ ...f, entidadeClienteId: ev.target.value }))
                }
                className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">- Não relacionado com cliente -</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.nif})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Título</label>
              <input
                value={editForm.titulo}
                onChange={(ev) => setEditForm((f) => ({ ...f, titulo: ev.target.value }))}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Notas</label>
              <textarea
                value={editForm.descricao}
                onChange={(ev) => setEditForm((f) => ({ ...f, descricao: ev.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Início</label>
                <input
                  type="datetime-local"
                  value={editForm.inicio.slice(0, 16)}
                  onChange={(ev) => setEditForm((f) => ({ ...f, inicio: ev.target.value }))}
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fim (opcional)</label>
                <input
                  type="datetime-local"
                  value={editForm.fim ? editForm.fim.slice(0, 16) : ""}
                  onChange={(ev) => setEditForm((f) => ({ ...f, fim: ev.target.value }))}
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            </div>
            {editFormError ? <p className="text-sm text-red-400">{editFormError}</p> : null}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void submitEditReuniao()}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {editSaving ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? <p className="text-sm text-slate-500 text-center py-4">A actualizar…</p> : null}
    </>
  );
}
