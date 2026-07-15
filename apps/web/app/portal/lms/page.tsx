"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  Settings2,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { resolveSalaOnline, formatarDuracaoHhMmSs, isModalidadeOnline } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { openMeetingUrl } from "@/lib/client/open-meeting-url";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { aggregateLmsAcessos, filtrarEventosJoinLeave, formatarLabelSessaoLms, type LmsAcessoRow } from "@/lib/lms/attendance";
import { usePresencaPolling } from "@/lib/lms/use-presenca-sessao";
import { TempoPresencaAoVivo } from "@/components/lms/tempo-presenca-ao-vivo";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Input,
  PageHeader,
  Select,
  type Column,
} from "@/components/ui";

type AcaoOpt = { id: string; codigoInterno: string; titulo: string };
type TurmaOpt = { id: string; codigo: string; nome: string };
type SessaoRow = {
  id: string;
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  lmsAtivo: boolean;
  iniciadaEm?: string | null;
  terminadaEm?: string | null;
  zoomMeetingId?: string | null;
  teamsMeetingId?: string | null;
  salaJoinUrl?: string | null;
  minutosPresencaMin: number;
};
type PresencaLinha = {
  id: string;
  presente: boolean;
  minutosEfetivos: number | null;
  validado: boolean;
  origem: string;
  matricula: { id: string; formando: { nome: string; nif: string } };
};
type FolhaDetalhe = {
  id: string;
  origem: string;
  fechadaEm: string | null;
  presencas: PresencaLinha[];
};

const TABS = ["assiduidade", "eventos", "config"] as const;
type Tab = (typeof TABS)[number];

const MODALIDADES_SESSAO = [
  { value: "presencial", label: "Presencial" },
  { value: "b-learning", label: "B-learning" },
  { value: "online", label: "Online" },
] as const;

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveJoinUrl(s: SessaoRow) {
  return resolveSalaOnline(s);
}

function duracaoSessaoSeg(sessao: SessaoRow): number {
  if (!sessao.iniciadaEm) return 0;
  const fim = sessao.terminadaEm
    ? new Date(sessao.terminadaEm).getTime()
    : Date.now();
  return Math.max(0, Math.round((fim - new Date(sessao.iniciadaEm).getTime()) / 1000));
}

export default function LmsPage() {
  const router = useRouter();
  const { isStaff, showBackofficeTools, canManage, isFormador, loading: roleLoading } =
    useTenantRole();
  const [tab, setTab] = useState<Tab>("assiduidade");
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [sessoes, setSessoes] = useState<SessaoRow[]>([]);
  const [acessos, setAcessos] = useState<LmsAcessoRow[]>([]);
  const [eventosAcao, setEventosAcao] = useState<LmsAcessoRow[]>([]);
  const [eventosLoading, setEventosLoading] = useState(false);
  const [folha, setFolha] = useState<FolhaDetalhe | null>(null);
  const [acaoId, setAcaoId] = useState("");
  const [cronogramaId, setCronogramaId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [sessaoId, setSessaoId] = useState("");
  const [showNovaSessao, setShowNovaSessao] = useState(false);
  const [novaSessNum, setNovaSessNum] = useState("1");
  const [novaSessData, setNovaSessData] = useState(() => hojeIso());
  const [novaSessInicio, setNovaSessInicio] = useState("09:00");
  const [novaSessFim, setNovaSessFim] = useState("12:30");
  const [novaSessModalidade, setNovaSessModalidade] = useState("b-learning");
  const [zoomId, setZoomId] = useState("");
  const [minutosMin, setMinutosMin] = useState("60");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liveTick, setLiveTick] = useState(0);
  const [intDisp, setIntDisp] = useState({
    podeCriarSalaZoom: false,
    podeCriarSalaTeams: false,
    zoom: { aviso: null as string | null },
    teams: { aviso: null as string | null },
  });

  useEffect(() => {
    if (!roleLoading && isFormador) {
      router.replace("/portal/acoes");
    }
  }, [isFormador, roleLoading, router]);

  useEffect(() => {
    void bffFetch("/api/v1/integracoes/disponibilidade", { headers: { accept: "application/json" } }).then(
      async (r) => {
        if (!r.ok) return;
        const data = (await r.json()) as {
          podeCriarSalaZoom: boolean;
          podeCriarSalaTeams: boolean;
          zoom?: { aviso?: string | null };
          teams?: { aviso?: string | null };
        };
        setIntDisp({
          podeCriarSalaZoom: data.podeCriarSalaZoom,
          podeCriarSalaTeams: data.podeCriarSalaTeams,
          zoom: { aviso: data.zoom?.aviso ?? null },
          teams: { aviso: data.teams?.aviso ?? null },
        });
      },
    );
  }, []);

  useEffect(() => {
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(async (r) => {
      setLoading(false);
      if (!r.ok) return;
      const rows = (await r.json()) as AcaoOpt[];
      setAcoes(rows);
      if (rows.length) setAcaoId(rows[0].id);
    });
  }, []);

  const loadTurmas = useCallback(async (id: string) => {
    if (!id) return setTurmas([]);
    const r = await bffFetch(`/api/v1/turmas?acaoFormacaoId=${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
    });
    if (r.ok) {
      const rows = (await r.json()) as TurmaOpt[];
      setTurmas(rows);
      setTurmaId(rows[0]?.id ?? "");
    }
  }, []);

  const loadSessoes = useCallback(async (id: string, keepSessaoId?: string) => {
    if (!id) return setSessoes([]);
    const r = await bffFetch(`/api/v1/cronogramas?acaoFormacaoId=${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return;
    const cronos = (await r.json()) as { id: string }[];
    if (!cronos.length) {
      setCronogramaId("");
      return setSessoes([]);
    }
    const cronoId = cronos[0].id;
    setCronogramaId(cronoId);
    const r2 = await bffFetch(`/api/v1/sessoes-formacao?cronogramaId=${encodeURIComponent(cronoId)}`, {
      headers: { accept: "application/json" },
    });
    if (r2.ok) {
      const rows = (await r2.json()) as SessaoRow[];
      setSessoes(rows);
      const preferred =
        keepSessaoId && rows.some((s) => s.id === keepSessaoId)
          ? keepSessaoId
          : (rows[0]?.id ?? "");
      if (preferred) {
        setSessaoId(preferred);
        const picked = rows.find((s) => s.id === preferred);
        if (picked) {
          setZoomId(picked.zoomMeetingId ?? "");
          setMinutosMin(String(picked.minutosPresencaMin ?? 60));
        }
      } else {
        setSessaoId("");
      }
    }
  }, []);

  const loadFolha = useCallback(async (sid: string) => {
    if (!sid) return setFolha(null);
    const r = await bffFetch(`/api/v1/folhas-presenca?sessaoId=${encodeURIComponent(sid)}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return setFolha(null);
    const folhas = (await r.json()) as { id: string; origem: string }[];
    const auto = folhas.find((f) => f.origem === "automatica" || f.origem === "hibrida") ?? folhas[0];
    if (!auto) return setFolha(null);
    const d = await bffFetch(`/api/v1/folhas-presenca/${auto.id}`, { headers: { accept: "application/json" } });
    if (d.ok) setFolha((await d.json()) as FolhaDetalhe);
  }, []);

  const loadAcessos = useCallback(async (sid: string) => {
    if (!sid) return setAcessos([]);
    const r = await bffFetch(`/api/v1/lms/acessos?sessaoFormacaoId=${encodeURIComponent(sid)}`, {
      headers: { accept: "application/json" },
    });
    if (r.ok) setAcessos((await r.json()) as LmsAcessoRow[]);
  }, []);

  const loadEventosAcao = useCallback(async (id: string, opts?: { loading?: boolean }) => {
    if (!id) return setEventosAcao([]);
    const showLoading = opts?.loading !== false;
    if (showLoading) setEventosLoading(true);
    try {
      const r = await bffFetch(`/api/v1/lms/acessos?acaoFormacaoId=${encodeURIComponent(id)}`, {
        headers: { accept: "application/json" },
      });
      if (r.ok) setEventosAcao((await r.json()) as LmsAcessoRow[]);
    } finally {
      if (showLoading) setEventosLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTurmas(acaoId);
    void loadSessoes(acaoId);
    setShowNovaSessao(false);
  }, [acaoId, loadTurmas, loadSessoes]);

  useEffect(() => {
    const s = sessoes.find((x) => x.id === sessaoId);
    if (s) {
      setZoomId(s.zoomMeetingId ?? "");
      setMinutosMin(String(s.minutosPresencaMin ?? 60));
    }
    void loadAcessos(sessaoId);
    void loadFolha(sessaoId);
  }, [sessaoId, sessoes, loadAcessos, loadFolha]);

  const sessao = sessoes.find((s) => s.id === sessaoId);
  const sessaoEmCurso = Boolean(sessao?.iniciadaEm && !sessao?.terminadaEm);

  const refreshAssiduidade = useCallback(() => {
    void loadAcessos(sessaoId);
    void loadSessoes(acaoId, sessaoId);
  }, [loadAcessos, loadSessoes, sessaoId, acaoId]);

  const refreshEventos = useCallback(() => {
    if (!acaoId) return;
    void loadEventosAcao(acaoId, { loading: true });
  }, [loadEventosAcao, acaoId]);

  const pollAssiduidade = Boolean(sessaoId && sessao?.lmsAtivo && tab === "assiduidade");

  usePresencaPolling(refreshAssiduidade, pollAssiduidade, 3000);

  useEffect(() => {
    if (tab !== "eventos" || !acaoId) return;
    void loadEventosAcao(acaoId, { loading: true });
  }, [tab, acaoId, loadEventosAcao]);

  useEffect(() => {
    if (!sessaoEmCurso) return;
    const id = setInterval(() => setLiveTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [sessaoEmCurso]);

  const acaoActual = acoes.find((a) => a.id === acaoId) ?? acoes[0];
  const multiplasAcoes = acoes.length > 1;

  function abrirFormNovaSessao() {
    const maxNum = sessoes.reduce((m, s) => Math.max(m, s.numeroSessao), 0);
    setNovaSessNum(String(maxNum + 1));
    setNovaSessData(hojeIso());
    setNovaSessInicio("09:00");
    setNovaSessFim("12:30");
    setNovaSessModalidade("b-learning");
    setShowNovaSessao(true);
    setError(null);
    setMsg(null);
  }

  async function criarNovaSessao(e: FormEvent) {
    e.preventDefault();
    if (!showBackofficeTools || !cronogramaId) {
      setError("Sem cronograma nesta acção - o gestor deve criar o cronograma primeiro.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await bffFetch("/api/v1/sessoes-formacao", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          cronogramaId,
          numeroSessao: Number(novaSessNum),
          data: novaSessData,
          horaInicio: novaSessInicio,
          horaFim: novaSessFim,
          modalidade: novaSessModalidade,
        }),
      });
      if (!r.ok) {
        setError(await parseApiError(r));
        return;
      }
      const created = (await r.json()) as { id: string; numeroSessao: number };
      setMsg(`Sessão ${created.numeroSessao} criada.`);
      setShowNovaSessao(false);
      await loadSessoes(acaoId, created.id);
    } finally {
      setBusy(false);
    }
  }

  async function activarLmsSessao() {
    if (!sessaoId || !showBackofficeTools) return;
    setBusy(true);
    setError(null);
    try {
      const r = await bffFetch(`/api/v1/sessoes-formacao/${sessaoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ lmsAtivo: true }),
      });
      if (!r.ok) {
        setError(await parseApiError(r));
        return;
      }
      setMsg("Presença online activada nesta sessão.");
      await loadSessoes(acaoId, sessaoId);
    } finally {
      setBusy(false);
    }
  }

  async function guardarLms() {
    if (!sessaoId || !isStaff) return;
    setBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/sessoes-formacao/${sessaoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ lmsAtivo: true, zoomMeetingId: zoomId || null, minutosPresencaMin: Number(minutosMin) }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Sessão LMS actualizada.");
    await loadSessoes(acaoId, sessaoId);
  }

  async function sincronizar() {
    if (!sessaoId || !turmaId) return;
    setBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/assiduidade/sessoes/${sessaoId}/sincronizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ turmaId }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const data = (await r.json()) as { resultados?: { presente: boolean }[] };
    const presentes = data.resultados?.filter((x) => x.presente).length ?? 0;
    const total = data.resultados?.length ?? 0;
    setMsg(`Assiduidade sincronizada: ${presentes}/${total} presentes.`);
    await Promise.all([loadAcessos(sessaoId), loadFolha(sessaoId)]);
  }

  async function criarReuniao(provider: "ZOOM" | "TEAMS") {
    if (!sessaoId || !isFormador) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch(`/api/v1/integracoes/sessoes/${sessaoId}/reuniao?provider=${provider}`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const data = (await r.json()) as {
      joinUrl: string;
      provider: string;
      notificacoesEnviadas?: boolean;
    };
    setMsg(
      data.notificacoesEnviadas
        ? `Sala ${data.provider} criada - formandos e formador notificados por email.`
        : `Sala ${data.provider} criada.`,
    );
    const opened = openMeetingUrl(data.joinUrl);
    if (opened.blocked) {
      setError("Popup bloqueado - usa o link «Abrir» abaixo ou permite janelas emergentes.");
    }
    await loadSessoes(acaoId, sessaoId);
  }

  async function entrarNaSessao() {
    if (!sessaoId || !sala) {
      setError("Sem sala configurada para esta sessão.");
      return;
    }
    if (sessao?.terminadaEm) {
      setError("Esta sessão já terminou.");
      return;
    }
    if (!sessao?.iniciadaEm) {
      setError("Inicia a sessão no cronograma da formação - lá abre a sala Teams/Zoom e notifica os formandos.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const opened = openMeetingUrl(sala.joinUrl);
      if (opened.blocked) {
        setError("Popup bloqueado - usa o link «Abrir» ou permite janelas emergentes.");
      } else {
        setMsg("Sala aberta - o tempo da sessão está a contar.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function terminarSessao() {
    if (!sessaoId || !isFormador) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await bffFetch(`/api/v1/sessoes-formacao/${sessaoId}/terminar`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      if (!r.ok) {
        setError(await parseApiError(r));
        return;
      }
      const data = (await r.json()) as { presencasFechadas?: number; alreadyEnded?: boolean };
      setMsg(
        data.alreadyEnded
          ? "Sessão já tinha sido terminada."
          : `Sessão terminada - ${data.presencasFechadas ?? 0} presença(s) fechada(s) automaticamente.`,
      );
      await Promise.all([
        loadSessoes(acaoId, sessaoId),
        loadAcessos(sessaoId),
        loadEventosAcao(acaoId, { loading: false }),
      ]);
      setTab("assiduidade");
    } finally {
      setBusy(false);
    }
  }

  const sala = sessao ? resolveJoinUrl(sessao) : null;
  const integracaoPronta = sessao && isModalidadeOnline(sessao.modalidade)
    ? sessao.modalidade.toLowerCase().includes("online") &&
      !sessao.modalidade.toLowerCase().includes("learning")
      ? intDisp.podeCriarSalaZoom
      : intDisp.podeCriarSalaTeams
    : false;
  const avisoIntegracao =
    sessao && isModalidadeOnline(sessao.modalidade)
      ? sessao.modalidade.toLowerCase().includes("online") &&
        !sessao.modalidade.toLowerCase().includes("learning")
        ? intDisp.zoom.aviso
        : intDisp.teams.aviso
      : null;
  const limiar = Number(minutosMin) || 60;
  const agregado = useMemo(
    () => aggregateLmsAcessos(acessos, limiar, { ate: new Date() }),
    [acessos, limiar, liveTick],
  );

  const eventosVisiveis = useMemo(
    () => filtrarEventosJoinLeave(eventosAcao),
    [eventosAcao],
  );

  const stats = useMemo(() => {
    const presentesLms = agregado.filter((a) => a.presentePrevisto).length;
    const presentesFolha = folha?.presencas.filter((p) => p.presente).length ?? 0;
    return {
      formandos: agregado.length,
      presentesLms,
      presentesFolha,
      eventos: eventosVisiveis.length,
    };
  }, [agregado, folha, eventosVisiveis.length]);

  const ASSID_COLS: Column<ReturnType<typeof aggregateLmsAcessos>[number]>[] = [
    {
      key: "nome",
      header: "Formando",
      cell: (r) => (
        <div>
          <p className="font-medium text-slate-100">{r.nome}</p>
          <p className="text-xs text-slate-500">NIF {r.nif}</p>
        </div>
      ),
    },
    {
      key: "tempo",
      header: "Tempo na sessão",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <TempoPresencaAoVivo
            segundosFechados={r.segundosFechados}
            emSessao={r.emSessao}
            joinDesde={r.joinDesde}
            className={`text-sm ${r.emSessao ? "text-teal-400" : "text-slate-300"}`}
          />
          {r.emSessao ? (
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" title="Em sessão" />
          ) : null}
        </div>
      ),
    },
    {
      key: "minutos",
      header: "Minutos (limiar)",
      cell: (r) => (
        <span className="font-mono text-xs tabular-nums text-slate-500">
          {r.minutosEfetivos} / {limiar}
        </span>
      ),
    },
    {
      key: "joins",
      header: "Entradas / saídas",
      cell: (r) => (
        <Badge variant="default">
          {r.joins} / {r.leaves}
        </Badge>
      ),
      className: "text-center",
      headerClassName: "text-center",
    },
    {
      key: "previsto",
      header: "Previsto LMS",
      cell: (r) =>
        r.presentePrevisto ? (
          <span className="inline-flex items-center gap-1 text-green-400 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Presente
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-500 text-xs">
            <XCircle className="h-3.5 w-3.5" /> Ausente
          </span>
        ),
    },
    {
      key: "folha",
      header: "Folha sync",
      cell: (r) => {
        const p = folha?.presencas.find((x) => x.matricula.id === r.matriculaId);
        if (!p) return <span className="text-xs text-slate-600">–</span>;
        return p.presente ? (
          <Badge variant="green">Presente</Badge>
        ) : (
          <Badge variant="red">Ausente</Badge>
        );
      },
    },
  ];

  const EVENT_COLS: Column<LmsAcessoRow>[] = [
    {
      key: "sessao",
      header: "Sessão",
      cell: (a) => {
        const label = formatarLabelSessaoLms(a.sessao, a.sessaoFormacaoId);
        const actual = a.sessao?.id === sessaoId || a.sessaoFormacaoId === sessaoId;
        return (
          <span className={actual ? "text-teal-400 text-xs font-medium" : "text-slate-400 text-xs"}>
            {label}
            {actual ? " · actual" : ""}
          </span>
        );
      },
    },
    {
      key: "formando",
      header: "Formando",
      cell: (a) => <span className="text-slate-200">{a.matricula?.formando.nome ?? "–"}</span>,
    },
    {
      key: "evento",
      header: "Evento",
      cell: (a) => <Badge variant="blue">{a.evento}</Badge>,
    },
    {
      key: "duracao",
      header: "Duração",
      cell: (a) => (
        <span className="font-mono text-xs text-slate-400">
          {a.duracaoSegundos != null ? `${a.duracaoSegundos}s` : "–"}
        </span>
      ),
    },
    {
      key: "ocorridoEm",
      header: "Quando",
      cell: (a) => (
        <span className="text-xs text-slate-500">{new Date(a.ocorridoEm).toLocaleString("pt-PT")}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="LMS & assiduidade"
        description="Presença online via Zoom/Teams, registo de eventos e sincronização automática para folhas de presença."
        actions={
          showBackofficeTools ? (
            <Link
              href="/portal/integracoes"
              className="inline-flex items-center gap-2 h-7 px-3 text-xs font-semibold rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Integrações
            </Link>
          ) : null
        }
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      {/* Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-blue-400" />
            Sessão de formação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`grid gap-4 ${multiplasAcoes ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}
          >
            {multiplasAcoes ? (
              <Select label="Acção" value={acaoId} onChange={(e) => setAcaoId(e.target.value)}>
                {acoes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigoInterno} – {a.titulo}
                  </option>
                ))}
              </Select>
            ) : acaoActual ? (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Acção de formação</p>
                <p className="text-sm text-slate-200">
                  {acaoActual.codigoInterno} – {acaoActual.titulo}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 min-w-0">
                <Select label="Sessão" value={sessaoId} onChange={(e) => setSessaoId(e.target.value)}>
                  {sessoes.map((s) => (
                    <option key={s.id} value={s.id}>
                      S{s.numeroSessao} · {String(s.data).slice(0, 10)} ·{" "}
                      {s.lmsAtivo ? "LMS activo" : "LMS inactivo"}
                    </option>
                  ))}
                </Select>
              </div>
              {showBackofficeTools ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  disabled={busy || !acaoId || !cronogramaId}
                  onClick={() => (showNovaSessao ? setShowNovaSessao(false) : abrirFormNovaSessao())}
                >
                  <Plus className="h-4 w-4" />
                  {showNovaSessao ? "Cancelar" : "Nova sessão"}
                </Button>
              ) : null}
            </div>
          </div>

          {showNovaSessao && showBackofficeTools ? (
            <form
              onSubmit={(e) => void criarNovaSessao(e)}
              className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 grid gap-3 sm:grid-cols-2"
            >
              <p className="sm:col-span-2 text-sm font-medium text-slate-200">Registar nova sessão</p>
              <Input
                label="N.º sessão"
                type="number"
                min={1}
                value={novaSessNum}
                onChange={(e) => setNovaSessNum(e.target.value)}
                required
              />
              <Input
                label="Data"
                type="date"
                value={novaSessData}
                onChange={(e) => setNovaSessData(e.target.value)}
                required
              />
              <Input
                label="Início"
                value={novaSessInicio}
                onChange={(e) => setNovaSessInicio(e.target.value)}
                placeholder="09:00"
                required
              />
              <Input
                label="Fim"
                value={novaSessFim}
                onChange={(e) => setNovaSessFim(e.target.value)}
                placeholder="12:30"
                required
              />
              <Select
                label="Modalidade"
                value={novaSessModalidade}
                onChange={(e) => setNovaSessModalidade(e.target.value)}
              >
                {MODALIDADES_SESSAO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" size="sm" disabled={busy}>
                  Criar sessão
                </Button>
              </div>
            </form>
          ) : null}

          {!cronogramaId && acaoId && showBackofficeTools ? (
            <Alert variant="warning">
              Esta acção ainda não tem cronograma - pede ao gestor para o criar antes de registar sessões.
            </Alert>
          ) : null}
          {sessao ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={sessao.lmsAtivo ? "green" : "default"}>
                {sessao.lmsAtivo ? "LMS activo" : "LMS inactivo"}
              </Badge>
              <Badge variant="default">{sessao.modalidade}</Badge>
              <Badge variant="default">
                {sessao.horaInicio}–{sessao.horaFim}
              </Badge>
              {sala ? (
                <a
                  href={sala.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <Video className="h-3 w-3" />
                  Sala {sala.provider}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Stats */}
      {sessaoId ? (
        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-400/80" />
                <div>
                  <p className="text-2xl font-bold text-slate-100">{stats.formandos}</p>
                  <p className="text-xs text-slate-500">Formandos com eventos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-400/80" />
                <div>
                  <p className="text-2xl font-bold text-slate-100">{stats.presentesLms}</p>
                  <p className="text-xs text-slate-500">Presentes (cálculo LMS)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-8 w-8 text-teal-400/80" />
                <div>
                  <p className="text-2xl font-bold text-slate-100">{stats.presentesFolha}</p>
                  <p className="text-xs text-slate-500">Na folha sincronizada</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-purple-400/80" />
                <div>
                  <p className="text-2xl font-bold text-slate-100">{stats.eventos}</p>
                  <p className="text-xs text-slate-500">Eventos registados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-700/40">
        {(
          [
            ["assiduidade", "Assiduidade"],
            ["eventos", "Eventos"],
            ["config", "Configuração"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "assiduidade" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base">Resumo por formando</CardTitle>
            <div className="flex items-center gap-2">
              <Select
                label=""
                value={turmaId}
                onChange={(e) => setTurmaId(e.target.value)}
                className="min-w-[180px]"
              >
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.codigo} – {t.nome}
                  </option>
                ))}
              </Select>
              <Button
                disabled={busy || !sessao?.lmsAtivo || !turmaId}
                onClick={() => void sincronizar()}
              >
                <RefreshCw className="h-4 w-4" />
                Sincronizar → folha
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!sessao?.lmsAtivo ? (
              <Alert variant="warning">
                LMS inactivo nesta sessão. Activa em Configuração ou no cronograma da acção.
              </Alert>
            ) : null}
            <DataTable
              columns={ASSID_COLS}
              data={agregado}
              keyField="matriculaId"
              loading={loading}
              emptyMessage="Sem eventos LMS para esta sessão. Os formandos devem entrar na sala online."
            />
            {folha ? (
              <p className="mt-4 text-xs text-slate-500">
                Folha {folha.origem} · {folha.fechadaEm ? "fechada" : "aberta"} ·{" "}
                {folha.presencas.length} registo(s)
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tab === "eventos" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-xs text-slate-500">
              Todos os eventos da acção ({eventosVisiveis.length} entrada/saída
              {sessoes.length > 1 ? ` · ${sessoes.length} sessões` : ""})
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={!acaoId || eventosLoading}
              onClick={() => refreshEventos()}
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar eventos
            </Button>
          </div>
          <DataTable
            columns={EVENT_COLS}
            data={eventosVisiveis}
            keyField="id"
            loading={eventosLoading}
            emptyMessage="Sem eventos registados (entrada / saída) nesta acção."
          />
        </>
      ) : null}

      {tab === "config" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isFormador && !canManage ? "Sessão online" : "Sala online & parâmetros LMS"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            {!showBackofficeTools ? (
              <Alert variant="info">Apenas gestores e formadores podem alterar a configuração LMS.</Alert>
            ) : (
              <>
                {sessao && sessao.lmsAtivo ? (
                  <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Tempo da sessão</p>
                        {sessaoEmCurso && sessao.iniciadaEm ? (
                          <TempoPresencaAoVivo
                            segundosFechados={0}
                            emSessao
                            joinDesde={sessao.iniciadaEm}
                            className="text-3xl font-mono tabular-nums text-teal-300"
                          />
                        ) : (
                          <span className="text-3xl font-mono tabular-nums text-slate-400">
                            {formatarDuracaoHhMmSs(duracaoSessaoSeg(sessao))}
                          </span>
                        )}
                      </div>
                      {sessao.terminadaEm ? (
                        <Badge variant="default">Terminada</Badge>
                      ) : sessao.iniciadaEm ? (
                        <Badge variant="green">Em curso</Badge>
                      ) : (
                        <Badge variant="default">Por iniciar</Badge>
                      )}
                    </div>

                    {sessao.terminadaEm ? (
                      <p className="text-xs text-slate-500">
                        Sessão encerrada - consulta a assiduidade na tab correspondente.
                      </p>
                    ) : sala ? (
                      <div className="flex flex-col gap-2">
                        {sessao.iniciadaEm ? (
                          <Button size="sm" disabled={busy || !sessaoId} onClick={() => void entrarNaSessao()}>
                            <Video className="h-4 w-4" />
                            Entrar na sala
                          </Button>
                        ) : isFormador ? (
                          <Alert variant="info">
                            Inicia a sessão no{" "}
                            <Link href="/portal/acoes" className="underline hover:text-blue-300">
                              cronograma da formação
                            </Link>{" "}
                            para abrir a sala e notificar os formandos.
                          </Alert>
                        ) : (
                          <Alert variant="info">Aguarda o formador iniciar a sessão.</Alert>
                        )}
                        {isFormador && sessao.iniciadaEm ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy || !sessaoId}
                            onClick={() => void terminarSessao()}
                          >
                            Terminar sessão
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <Alert variant="warning">
                        {avisoIntegracao ??
                          (canManage
                            ? "Sem sala configurada - configura OAuth em Integrações ou cria a reunião abaixo."
                            : "Sem sala configurada - pede ao gestor para activar a integração Zoom/Teams.")}
                        {showBackofficeTools && integracaoPronta ? (
                          <div className="mt-3">
                            <Button size="sm" disabled={busy || !sessaoId} onClick={() => void activarLmsSessao()}>
                              Gerar sala online
                            </Button>
                          </div>
                        ) : null}
                      </Alert>
                    )}
                  </div>
                ) : sessao && isModalidadeOnline(sessao.modalidade) ? (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                    <p className="text-sm text-slate-300">Presença online</p>
                    <p className="text-xs text-slate-500">
                      Modalidade {sessao.modalidade} - activa o LMS para registar assiduidade e abrir a sala.
                    </p>
                    <Button size="sm" disabled={busy || !sessaoId} onClick={() => void activarLmsSessao()}>
                      Activar presença online
                    </Button>
                  </div>
                ) : sessao ? (
                  <Alert variant="info">
                    LMS inactivo nesta sessão (modalidade presencial - presença via folha manual).
                  </Alert>
                ) : null}

                {canManage ? (
                  <>
                    {roleLoading ? <p className="text-xs text-slate-500">A carregar permissões…</p> : null}

                    {intDisp.podeCriarSalaTeams ? (
                      <div className="rounded-xl border border-slate-700/30 bg-slate-800/30 p-4 space-y-3">
                        <p className="text-sm text-slate-300">Criar reunião Teams (OAuth)</p>
                        {sala ? (
                          <p className="text-xs text-slate-400">
                            Sala Teams activa{" "}
                            <a
                              href={sala.joinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              Abrir
                            </a>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">Sem sala Teams para esta sessão.</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {canManage && intDisp.podeCriarSalaTeams ? (
                            <Button
                              size="sm"
                              disabled={busy || !sessaoId}
                              onClick={() => void criarReuniao("TEAMS")}
                            >
                              Criar sala Teams
                            </Button>
                          ) : null}
                        </div>
                        {isFormador && !canManage ? (
                          <p className="text-xs text-slate-500">
                            Para iniciar sessões online, usa o cronograma da formação - evita duplicar
                            acções entre LMS e cronograma.
                          </p>
                        ) : canManage ? (
                          <p className="text-xs text-slate-500">
                            Preferível iniciar no cronograma; aqui podes criar sala manualmente se necessário.
                          </p>
                        ) : null}
                      </div>
                    ) : isModalidadeOnline(sessao?.modalidade ?? "") ? (
                      <Alert variant="warning">
                        {avisoIntegracao ??
                          "Integração Microsoft Teams não configurada - configure em Integrações."}
                      </Alert>
                    ) : (
                      <Alert variant="info">
                        Configure Microsoft Teams em{" "}
                        <Link href="/portal/integracoes" className="underline hover:text-blue-300">
                          Integrações
                        </Link>{" "}
                        para criar salas de formação online.
                      </Alert>
                    )}

                    <Input
                      label="Teams Meeting ID (opcional, legado)"
                      value={zoomId}
                      onChange={(e) => setZoomId(e.target.value)}
                      placeholder="ID da reunião existente"
                    />
                    <Input
                      label="Minutos mínimos para presença"
                      type="number"
                      min={1}
                      value={minutosMin}
                      onChange={(e) => setMinutosMin(e.target.value)}
                    />
                    <Button disabled={busy} onClick={() => void guardarLms()}>
                      Activar / actualizar LMS
                    </Button>
                  </>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
