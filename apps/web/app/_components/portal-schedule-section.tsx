"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileText,
  GraduationCap,
  Layers,
  Lock,
  MapPin,
  Plus,
  Radio,
  RefreshCw,
  Users,
  Video,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { openMeetingUrl } from "@/lib/client/open-meeting-url";
import { resolveSalaOnline, isModalidadeOnline, providerParaModalidade, ESTADOS_PRESENCA, ESTADO_PRESENCA_LABELS, isEstadoPresenca, ALERTA_PRESENCA_LABELS, type EstadoPresenca, type AlertaPresencaCodigo } from "@nexiforma/shared";
import { TempoPresencaAoVivo } from "@/components/lms/tempo-presenca-ao-vivo";
import { Alert } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";

type AcaoOption = { id: string; codigoInterno: string; titulo: string };

type CronogramaRow = {
  id: string;
  versao: number;
  aprovadoEm?: string | null;
  _count?: { sessoes: number };
};

type SessaoRow = {
  id: string;
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  estado: string;
  lmsAtivo?: boolean;
  iniciadaEm?: string | null;
  terminadaEm?: string | null;
  zoomMeetingId?: string | null;
  teamsMeetingId?: string | null;
  salaJoinUrl?: string | null;
  formador?: { id: string; nomeCompleto: string } | null;
  formadorPresente?: boolean | null;
  moduloUnidade?: { id: string; codigo: string | null; titulo: string } | null;
  _count?: { folhasPresenca: number };
};

type ModuloOpt = { id: string; codigo: string | null; titulo: string };

type CronogramaArquivo = {
  id: string;
  nomeFicheiro: string;
  tamanhoBytes: number;
  createdAt: string;
  expiresAt: string | null;
};

type FormadorOpt = { id: string; nomeCompleto: string };
type TurmaRow = { id: string; codigo: string; nome: string };
type FolhaRow = {
  id: string;
  fechadaEm: string | null;
  validadaFormadorEm: string | null;
  aprovadaGestorEm: string | null;
  turma?: { codigo: string; nome: string } | null;
  _count?: { presencas: number };
};

type PresencaLinha = {
  id: string;
  presente: boolean;
  estado: EstadoPresenca | null;
  motivoJustificacao: string | null;
  validado: boolean;
  minutosEfetivos?: number | null;
  matricula: { formando: { nome: string; nif: string } };
};

type PainelLmsFormando = {
  matriculaId: string;
  nome: string;
  nif: string;
  emailPresencaReuniao: string | null;
  emSessao: boolean;
  segundosTotais: number;
  tempoFormatado: string;
  minutosEfetivos: number;
  joinDesde: string | null;
  segundosFechados: number;
  alertas: AlertaPresencaCodigo[];
};

type PainelLms = {
  sessao: {
    emCurso: boolean;
    minutosPresencaMin: number;
    terminadaEm: string | null;
  };
  formandos: PainelLmsFormando[];
  emSessaoCount: number;
  totalMatriculas: number;
  alertasCount: number;
};

type FolhaDetalhe = {
  id: string;
  fechadaEm: string | null;
  validadaFormadorEm: string | null;
  aprovadaGestorEm: string | null;
  turma?: { id: string; codigo: string; nome: string } | null;
  sessao: {
    numeroSessao: number;
    data: string;
    horaInicio: string;
    horaFim: string;
    iniciadaEm?: string | null;
    terminadaEm?: string | null;
    formadorPresente?: boolean | null;
    formador?: { id: string; nomeCompleto: string } | null;
  };
  presencas: PresencaLinha[];
};

type Props = {
  acoes: AcaoOption[];
  /** Gestor e formador: cronograma, sessões planeadas, presenças e validação. */
  canManageAssiduidade: boolean;
  /** Só formador: iniciar sessão online e notificar formandos. */
  canIniciarSessao?: boolean;
  /** Quando definido, esconde o selector de acção (detalhe da acção). */
  fixedAcaoId?: string;
  /** Só gestor - aprovar cronograma para compliance. */
  canApproveCronograma?: boolean;
  /** Só gestor - aprovar folha de presenças validada pelo formador. */
  canApprovePresencasFolha?: boolean;
  /** Esconde título duplicado quando embutido no detalhe da acção. */
  embedded?: boolean;
  /** Curso da acção - necessário para módulos no cronograma DGERT. */
  cursoId?: string;
};

const MODALIDADES = [
  { value: "presencial", label: "Presencial", icon: MapPin },
  { value: "b-learning", label: "B-learning", icon: Layers },
  { value: "online", label: "Online", icon: Video },
] as const;

const ESTADOS_SESSAO = ["AGENDADA", "REALIZADA", "CANCELADA"] as const;

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
  return (
    <Badge variant={map[estado] ?? "default"}>{labels[estado] ?? estado}</Badge>
  );
}

function formatDataPt(iso: string) {
  return formatDatePt(iso);
}

function formatDataHoraPt(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-PT");
}

function ResumoSessaoPresencas({
  sessao,
  folhaDetalhe,
}: {
  sessao: SessaoRow;
  folhaDetalhe: FolhaDetalhe | null;
}) {
  const sessaoMeta = folhaDetalhe?.sessao;
  const presentes =
    folhaDetalhe?.presencas.filter((p) => p.estado === "PRESENTE").length ?? 0;
  const total = folhaDetalhe?.presencas.length ?? 0;
  const formadorPresente =
    sessaoMeta?.formadorPresente ?? sessao.formadorPresente;

  return (
    <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-3 text-xs space-y-2">
      <p className="text-sm font-medium text-slate-200">Dados da sessão</p>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Formador</dt>
          <dd className="text-slate-200">
            {sessaoMeta?.formador?.nomeCompleto ?? sessao.formador?.nomeCompleto ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Horário planeado</dt>
          <dd className="text-slate-200">
            {formatDataPt(sessao.data)} · {sessao.horaInicio}–{sessao.horaFim}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Início efectivo</dt>
          <dd className="text-slate-200">
            {formatDataHoraPt(sessaoMeta?.iniciadaEm ?? sessao.iniciadaEm)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Fim efectivo</dt>
          <dd className="text-slate-200">
            {formatDataHoraPt(sessaoMeta?.terminadaEm ?? sessao.terminadaEm)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Formador presente</dt>
          <dd className="text-slate-200">
            {formadorPresente === true
              ? "Sim"
              : formadorPresente === false
                ? "Não"
                : "-"}
          </dd>
        </div>
        {folhaDetalhe ? (
          <div>
            <dt className="text-slate-500">Presenças formandos</dt>
            <dd className="text-slate-200">
              {presentes} presente(s) de {total}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function PortalScheduleSection({
  acoes,
  canManageAssiduidade,
  canIniciarSessao = false,
  fixedAcaoId,
  canApproveCronograma = false,
  canApprovePresencasFolha = false,
  embedded = false,
  cursoId,
}: Props) {
  const [selectedAcaoId, setSelectedAcaoId] = useState(fixedAcaoId ?? "");
  const [cronogramas, setCronogramas] = useState<CronogramaRow[]>([]);
  const [selectedCronogramaId, setSelectedCronogramaId] = useState("");
  const [sessoes, setSessoes] = useState<SessaoRow[]>([]);
  const [selectedSessaoId, setSelectedSessaoId] = useState("");
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [folhas, setFolhas] = useState<FolhaRow[]>([]);
  const [folhaDetalhe, setFolhaDetalhe] = useState<FolhaDetalhe | null>(null);
  const [selectedFolhaId, setSelectedFolhaId] = useState("");
  const [presencaEdits, setPresencaEdits] = useState<
    Record<string, { estado: EstadoPresenca | ""; motivo: string }>
  >({});

  const [panel, setPanel] = useState<"sessoes" | "presencas">("sessoes");
  const [showNovaSessao, setShowNovaSessao] = useState(false);

  const [sessNum, setSessNum] = useState("1");
  const [sessData, setSessData] = useState("");
  const [sessInicio, setSessInicio] = useState("09:00");
  const [sessFim, setSessFim] = useState("12:30");
  const [sessModalidade, setSessModalidade] = useState("presencial");
  const [sessFormadorId, setSessFormadorId] = useState("");
  const [sessModuloId, setSessModuloId] = useState("");

  const [formadores, setFormadores] = useState<FormadorOpt[]>([]);
  const [modulos, setModulos] = useState<ModuloOpt[]>([]);
  const [arquivosCronograma, setArquivosCronograma] = useState<CronogramaArquivo[]>([]);
  const [editSessEstado, setEditSessEstado] = useState("AGENDADA");
  const [editSessFormadorId, setEditSessFormadorId] = useState("");
  const [editSessModuloId, setEditSessModuloId] = useState("");
  const [editSessModalidade, setEditSessModalidade] = useState("presencial");
  const [editLmsAtivo, setEditLmsAtivo] = useState(false);
  const [editFormadorPresente, setEditFormadorPresente] = useState<boolean | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [intDisp, setIntDisp] = useState({
    podeCriarSalaZoom: false,
    podeCriarSalaTeams: false,
    zoom: { aviso: null as string | null },
    teams: { aviso: null as string | null },
  });
  const [painelLms, setPainelLms] = useState<PainelLms | null>(null);

  const acaoId = fixedAcaoId ?? selectedAcaoId;
  const acaoLabel = acoes.find((a) => a.id === acaoId);
  const cronogramaAtivo = cronogramas.find((c) => c.id === selectedCronogramaId);
  const sessaoAtiva = sessoes.find((s) => s.id === selectedSessaoId);
  const formadorOperacao = Boolean(embedded && canIniciarSessao);
  const showPresencasWorkspace =
    (panel === "presencas" && !formadorOperacao) ||
    (formadorOperacao && Boolean(selectedSessaoId));
  const sessaoSala = sessaoAtiva ? resolveSalaOnline(sessaoAtiva) : null;
  const sessaoOnlineLms = Boolean(
    sessaoAtiva && isModalidadeOnline(sessaoAtiva.modalidade) && sessaoAtiva.lmsAtivo,
  );
  const providerSessao = sessaoAtiva ? providerParaModalidade(sessaoAtiva.modalidade) : "TEAMS";

  const stats = useMemo(() => {
    const realizadas = sessoes.filter((s) => s.estado === "REALIZADA").length;
    const folhasAbertas = folhas.filter((f) => !f.fechadaEm).length;
    const presentes = folhaDetalhe?.presencas.filter((p) => p.estado === "PRESENTE").length ?? 0;
    const totalPres = folhaDetalhe?.presencas.length ?? 0;
    return { realizadas, folhasAbertas, presentes, totalPres, totalSessoes: sessoes.length };
  }, [sessoes, folhas, folhaDetalhe]);

  useEffect(() => {
    if (fixedAcaoId) setSelectedAcaoId(fixedAcaoId);
    else if (acoes.length && !selectedAcaoId) setSelectedAcaoId(acoes[0].id);
  }, [acoes, fixedAcaoId, selectedAcaoId]);

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

  const loadPainelLms = useCallback(async () => {
    if (!selectedSessaoId || !selectedTurmaId || !sessaoAtiva?.lmsAtivo) {
      setPainelLms(null);
      return;
    }
    const res = await bffFetch(
      `/api/v1/lms/sessoes/${encodeURIComponent(selectedSessaoId)}/painel-presenca?turmaId=${encodeURIComponent(selectedTurmaId)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) {
      setPainelLms(null);
      return;
    }
    setPainelLms((await res.json()) as PainelLms);
  }, [selectedSessaoId, selectedTurmaId, sessaoAtiva?.lmsAtivo]);

  useEffect(() => {
    if (!selectedSessaoId || !selectedTurmaId || !sessaoAtiva?.lmsAtivo) {
      setPainelLms(null);
      return;
    }
    void loadPainelLms();
    const id = setInterval(() => void loadPainelLms(), 12_000);
    return () => clearInterval(id);
  }, [loadPainelLms, selectedSessaoId, selectedTurmaId, sessaoAtiva?.lmsAtivo]);

  const parseErr = async (res: Response) => {
    const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    if (Array.isArray(data?.message)) return data.message.join(", ");
    if (typeof data?.message === "string") return data.message;
    return `HTTP ${res.status}`;
  };

  const loadCronogramas = useCallback(async (id: string) => {
    if (!id) {
      setCronogramas([]);
      return;
    }
    const res = await bffFetch(`/api/v1/cronogramas?acaoFormacaoId=${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const rows = (await res.json()) as CronogramaRow[];
      setCronogramas(rows);
      setSelectedCronogramaId((prev) =>
        rows.length ? (rows.some((c) => c.id === prev) ? prev : rows[0].id) : "",
      );
    }
  }, []);

  const loadTurmas = useCallback(async (id: string) => {
    if (!id) {
      setTurmas([]);
      return;
    }
    const res = await bffFetch(`/api/v1/turmas?acaoFormacaoId=${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const rows = (await res.json()) as TurmaRow[];
      setTurmas(rows);
      setSelectedTurmaId((prev) =>
        rows.length ? (rows.some((t) => t.id === prev) ? prev : rows[0].id) : "",
      );
    }
  }, []);

  const loadSessoes = useCallback(async (cronogramaId: string) => {
    if (!cronogramaId) {
      setSessoes([]);
      return;
    }
    const res = await bffFetch(
      `/api/v1/sessoes-formacao?cronogramaId=${encodeURIComponent(cronogramaId)}`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const rows = (await res.json()) as SessaoRow[];
      setSessoes(rows);
      setSelectedSessaoId((prev) =>
        rows.length ? (rows.some((s) => s.id === prev) ? prev : rows[0].id) : "",
      );
      const nextNum = rows.length ? Math.max(...rows.map((s) => s.numeroSessao)) + 1 : 1;
      setSessNum(String(nextNum));
    }
  }, []);

  const loadFolhas = useCallback(async (sessaoId: string, turmaId?: string) => {
    if (!sessaoId) {
      setFolhas([]);
      return;
    }
    const qs = new URLSearchParams({ sessaoId });
    if (turmaId) qs.set("turmaId", turmaId);
    const res = await bffFetch(`/api/v1/folhas-presenca?${qs}`, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const rows = (await res.json()) as FolhaRow[];
      setFolhas(rows);
      setSelectedFolhaId((prev) =>
        rows.length ? (rows.some((f) => f.id === prev) ? prev : rows[0].id) : "",
      );
    }
  }, []);

  const loadFolhaDetalhe = useCallback(async (folhaId: string) => {
    if (!folhaId) {
      setFolhaDetalhe(null);
      return;
    }
    const res = await bffFetch(`/api/v1/folhas-presenca/${folhaId}`, {
      headers: { accept: "application/json" },
    });
    if (res.ok) setFolhaDetalhe((await res.json()) as FolhaDetalhe);
  }, []);

  useEffect(() => {
    void bffFetch("/api/v1/formadores", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) setFormadores((await r.json()) as FormadorOpt[]);
    });
  }, []);

  useEffect(() => {
    if (!cursoId) {
      setModulos([]);
      return;
    }
    void bffFetch(`/api/v1/conteudos-lms/unidades?cursoId=${encodeURIComponent(cursoId)}`, {
      headers: { accept: "application/json" },
    }).then(async (r) => {
      if (!r.ok) return;
      setModulos((await r.json()) as ModuloOpt[]);
    });
  }, [cursoId]);

  const loadArquivosCronograma = useCallback(async (id: string) => {
    if (!id) {
      setArquivosCronograma([]);
      return;
    }
    const r = await bffFetch(`/api/v1/cronogramas/acoes-formacao/${encodeURIComponent(id)}/arquivos`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setArquivosCronograma([]);
      return;
    }
    setArquivosCronograma((await r.json()) as CronogramaArquivo[]);
  }, []);

  useEffect(() => {
    if (acaoId) void loadArquivosCronograma(acaoId);
  }, [acaoId, loadArquivosCronograma]);

  useEffect(() => {
    const s = sessoes.find((x) => x.id === selectedSessaoId);
    if (s) {
      setEditSessEstado(s.estado);
      setEditSessFormadorId(s.formador?.id ?? "");
      setEditSessModuloId(s.moduloUnidade?.id ?? "");
      setEditSessModalidade(s.modalidade);
      setEditLmsAtivo(!!s.lmsAtivo);
      setEditFormadorPresente(s.formadorPresente ?? null);
    }
  }, [selectedSessaoId, sessoes]);

  useEffect(() => {
    if (acaoId) {
      void loadCronogramas(acaoId);
      void loadTurmas(acaoId);
    }
  }, [acaoId, loadCronogramas, loadTurmas]);

  useEffect(() => {
    void loadSessoes(selectedCronogramaId);
  }, [selectedCronogramaId, loadSessoes]);

  useEffect(() => {
    void loadFolhas(selectedSessaoId, selectedTurmaId || undefined);
  }, [selectedSessaoId, selectedTurmaId, loadFolhas]);

  useEffect(() => {
    void loadFolhaDetalhe(selectedFolhaId);
  }, [selectedFolhaId, loadFolhaDetalhe]);

  useEffect(() => {
    if (!folhaDetalhe) {
      setPresencaEdits({});
      return;
    }
    const next: Record<string, { estado: EstadoPresenca | ""; motivo: string }> = {};
    for (const p of folhaDetalhe.presencas) {
      next[p.id] = {
        estado: isEstadoPresenca(p.estado) ? p.estado : "",
        motivo: p.motivoJustificacao ?? "",
      };
    }
    setPresencaEdits(next);
  }, [folhaDetalhe]);

  async function criarCronograma() {
    if (!canManageAssiduidade || !acaoId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch("/api/v1/cronogramas", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ acaoFormacaoId: acaoId }),
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      setMsg("Nova versão do cronograma criada.");
      await loadCronogramas(acaoId);
    } finally {
      setBusy(false);
    }
  }

  async function submitSessao(e: FormEvent) {
    e.preventDefault();
    if (!selectedCronogramaId || !canManageAssiduidade) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch("/api/v1/sessoes-formacao", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          cronogramaId: selectedCronogramaId,
          numeroSessao: Number(sessNum),
          data: sessData,
          horaInicio: sessInicio,
          horaFim: sessFim,
          modalidade: sessModalidade,
          formadorId: sessFormadorId || undefined,
          moduloUnidadeId: sessModuloId || undefined,
        }),
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const created = (await res.json()) as { id: string; numeroSessao?: number };
      setMsg(`Sessão ${sessNum} registada. ${formadorOperacao && isModalidadeOnline(sessModalidade) ? "Usa «Iniciar e criar sala Teams» à direita." : ""}`.trim());
      setShowNovaSessao(false);
      await loadSessoes(selectedCronogramaId);
      if (created.id) setSelectedSessaoId(created.id);
    } finally {
      setBusy(false);
    }
  }

  async function updateSessao() {
    if (!selectedSessaoId || !canManageAssiduidade) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/sessoes-formacao/${selectedSessaoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          estado: editSessEstado,
          formadorId: editSessFormadorId || null,
          moduloUnidadeId: editSessModuloId || null,
          modalidade: editSessModalidade,
          lmsAtivo: editLmsAtivo,
          formadorPresente: editFormadorPresente,
        }),
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      setMsg("Sessão actualizada.");
      await loadSessoes(selectedCronogramaId);
    } finally {
      setBusy(false);
    }
  }

  async function criarReuniao(provider: "ZOOM" | "TEAMS") {
    if (!selectedSessaoId || !canIniciarSessao) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch(
        `/api/v1/integracoes/sessoes/${selectedSessaoId}/reuniao?provider=${provider}`,
        { method: "POST", headers: { accept: "application/json" } },
      );
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const data = (await res.json()) as {
        joinUrl: string;
        provider: string;
        notificacoesEnviadas?: boolean;
      };
      setMsg(
        data.notificacoesEnviadas
          ? `Sala Teams criada - formandos e formador notificados por email.`
          : `Sala Teams criada - abre o link para entrar.`,
      );
      await loadSessoes(selectedCronogramaId);
      const opened = openMeetingUrl(data.joinUrl);
      if (opened.blocked) {
        setMsg((m) => `${m ?? ""} Popup bloqueado - usa o link «Abrir sala» abaixo.`.trim());
      }
    } finally {
      setBusy(false);
    }
  }

  async function abrirSalaAtual() {
    if (!sessaoSala?.joinUrl) return;
    const opened = openMeetingUrl(sessaoSala.joinUrl);
    if (opened.blocked) {
      setErr("Popup bloqueado - usa o link «Abrir sala» ou permite janelas emergentes.");
    }
  }

  async function iniciarEAbrirSala() {
    if (!selectedSessaoId || !canIniciarSessao || !sessaoAtiva) return;
    const online = isModalidadeOnline(sessaoAtiva.modalidade) && sessaoAtiva.lmsAtivo;
    const provider = "TEAMS" as const;
    const integracaoPronta = intDisp.podeCriarSalaTeams;
    const sala = resolveSalaOnline(sessaoAtiva);

    if (online && !sala && integracaoPronta) {
      await criarReuniao(provider);
      return;
    }

    if (online && !sala) {
      setErr(
        intDisp.teams.aviso ??
          "Integração Microsoft Teams não configurada - pede ao gestor para activar em Integrações.",
      );
      return;
    }

    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!sessaoAtiva.iniciadaEm) {
        const res = await bffFetch(`/api/v1/sessoes-formacao/${selectedSessaoId}/iniciar`, {
          method: "POST",
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          setErr(await parseErr(res));
          return;
        }
        const data = (await res.json()) as {
          alreadyStarted?: boolean;
          notificacoesEnviadas?: boolean;
          salaOnline?: { joinUrl: string; provider: string } | null;
        };
        setMsg(
          data.alreadyStarted
            ? "Sessão já estava iniciada."
            : data.notificacoesEnviadas
              ? "Sessão iniciada - formandos notificados por email."
              : "Sessão iniciada.",
        );
        await loadSessoes(selectedCronogramaId);
        const joinUrl = data.salaOnline?.joinUrl ?? sala?.joinUrl;
        if (joinUrl) {
          const opened = openMeetingUrl(joinUrl);
          if (opened.blocked) {
            setMsg((m) => `${m ?? ""} Popup bloqueado - usa «Abrir sala» abaixo.`.trim());
          }
        }
        return;
      }

      if (sala?.joinUrl) {
        await abrirSalaAtual();
      }
    } finally {
      setBusy(false);
    }
  }

  async function terminarSessao() {
    if (!selectedSessaoId || !canIniciarSessao) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch(`/api/v1/sessoes-formacao/${selectedSessaoId}/terminar`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const data = (await res.json()) as { presencasFechadas?: number; turmasSincronizadas?: number };
      const syncMsg =
        (data.turmasSincronizadas ?? 0) > 0
          ? ` Folhas de ${data.turmasSincronizadas} turma(s) actualizadas com assiduidade LMS.`
          : "";
      setMsg(
        `Sessão terminada - ${data.presencasFechadas ?? 0} formando(s) tiveram a presença fechada automaticamente.${syncMsg}`,
      );
      await loadSessoes(selectedCronogramaId);
      if (selectedTurmaId && sessaoAtiva?.lmsAtivo) {
        await importarLms();
      }
    } finally {
      setBusy(false);
    }
  }

  async function iniciarSessao() {
    await iniciarEAbrirSala();
  }

  async function importarLms() {
    if (!canManageAssiduidade || !selectedSessaoId || !selectedTurmaId || !sessaoAtiva?.lmsAtivo) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch(
        `/api/v1/assiduidade/sessoes/${selectedSessaoId}/sincronizar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ turmaId: selectedTurmaId }),
        },
      );
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const data = (await res.json()) as {
        folhaPresencaId: string;
        resultados: Array<{ presente: boolean }>;
      };
      const presentes = data.resultados.filter((r) => r.presente).length;
      setSelectedFolhaId(data.folhaPresencaId);
      await loadFolhas(selectedSessaoId, selectedTurmaId);
      await loadFolhaDetalhe(data.folhaPresencaId);
      setMsg(
        `Assiduidade LMS importada - ${presentes}/${data.resultados.length} com tempo suficiente para presença.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function abrirFolha() {
    if (!selectedSessaoId || !selectedTurmaId) return;
    setBusy(true);
    setErr(null);
    setPanel("presencas");
    try {
      const qs = new URLSearchParams({
        sessaoId: selectedSessaoId,
        turmaId: selectedTurmaId,
      });
      const listRes = await bffFetch(`/api/v1/folhas-presenca?${qs}`, {
        headers: { accept: "application/json" },
      });
      if (listRes.ok) {
        const existentes = (await listRes.json()) as FolhaRow[];
        setFolhas(existentes);
        if (existentes.length > 0) {
          const folhaId = existentes[0].id;
          setSelectedFolhaId(folhaId);
          await loadFolhaDetalhe(folhaId);
          setMsg("Folha de presença aberta.");
          return;
        }
      }

      const res = await bffFetch("/api/v1/folhas-presenca", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sessaoId: selectedSessaoId, turmaId: selectedTurmaId }),
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const created = (await res.json()) as { id: string };
      setMsg("Folha de presença criada com as matrículas da turma.");
      setSelectedFolhaId(created.id);
      await loadFolhas(selectedSessaoId, selectedTurmaId);
      await loadFolhaDetalhe(created.id);
    } finally {
      setBusy(false);
    }
  }

  async function updatePresencaEstado(
    p: PresencaLinha,
    estado: EstadoPresenca,
    motivoJustificacao?: string | null,
  ) {
    if (estado === "FALTA_JUSTIFICADA") {
      const motivo = (motivoJustificacao ?? "").trim();
      if (!motivo) {
        setErr("Indique o motivo da falta justificada antes de guardar.");
        return;
      }
    }
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { estado };
      if (estado === "FALTA_JUSTIFICADA") {
        body.motivoJustificacao = (motivoJustificacao ?? "").trim();
      }
      const res = await bffFetch(`/api/v1/presencas/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok && selectedFolhaId) await loadFolhaDetalhe(selectedFolhaId);
      else if (!res.ok) setErr(await parseErr(res));
    } finally {
      setBusy(false);
    }
  }

  async function limparPresencaEstado(p: PresencaLinha) {
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/presencas/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ estado: null }),
      });
      if (res.ok && selectedFolhaId) await loadFolhaDetalhe(selectedFolhaId);
      else if (!res.ok) setErr(await parseErr(res));
    } finally {
      setBusy(false);
    }
  }

  function onPresencaEstadoChange(p: PresencaLinha, raw: string) {
    if (!raw) {
      setPresencaEdits((prev) => ({
        ...prev,
        [p.id]: { estado: "", motivo: "" },
      }));
      void limparPresencaEstado(p);
      return;
    }
    if (!isEstadoPresenca(raw)) return;
    const estado = raw;
    setPresencaEdits((prev) => ({
      ...prev,
      [p.id]: {
        estado,
        motivo: estado === "FALTA_JUSTIFICADA" ? (prev[p.id]?.motivo ?? p.motivoJustificacao ?? "") : "",
      },
    }));
    if (estado !== "FALTA_JUSTIFICADA") {
      void updatePresencaEstado(p, estado);
    }
  }

  function guardarFaltaJustificada(p: PresencaLinha) {
    const edit = presencaEdits[p.id];
    if (!edit || edit.estado !== "FALTA_JUSTIFICADA") return;
    void updatePresencaEstado(p, "FALTA_JUSTIFICADA", edit.motivo);
  }

  async function validarFolha() {
    if (!selectedFolhaId || !canManageAssiduidade) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/folhas-presenca/${selectedFolhaId}/validar`, {
        method: "PATCH",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      setMsg("Presenças validadas e folha fechada.");
      await loadFolhaDetalhe(selectedFolhaId);
      await loadFolhas(selectedSessaoId, selectedTurmaId);
    } finally {
      setBusy(false);
    }
  }

  async function aprovarFolha() {
    if (!selectedFolhaId || !canApprovePresencasFolha) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/folhas-presenca/${selectedFolhaId}/aprovar`, {
        method: "PATCH",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      setMsg("Folha de presenças aprovada pelo gestor.");
      await loadFolhaDetalhe(selectedFolhaId);
      await loadFolhas(selectedSessaoId, selectedTurmaId);
    } finally {
      setBusy(false);
    }
  }

  async function transferirPresencas() {
    if (!selectedFolhaId || !folhaDetalhe?.validadaFormadorEm) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(
        `/api/v1/folhas-presenca/${selectedFolhaId}/presencas.html?download=1`,
        { headers: { accept: "text/html" } },
      );
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const blob = await res.blob();
      const filename = parseFilenameFromDisposition(
        res.headers.get("Content-Disposition"),
        `presencas-sessao-${folhaDetalhe.sessao.numeroSessao}.html`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg("Folha de presenças transferível descarregada.");
    } finally {
      setBusy(false);
    }
  }

  async function imprimirPresencas() {
    if (!selectedFolhaId || !folhaDetalhe?.validadaFormadorEm) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/folhas-presenca/${selectedFolhaId}/presencas.html`, {
        headers: { accept: "text/html" },
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const html = await res.text();
      const opened = openHtmlForPrint(html);
      if (!opened.ok) {
        setErr(opened.error);
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  async function aprovarCronograma() {
    if (!canApproveCronograma || !cronogramaAtivo?.id || cronogramaAtivo.aprovadoEm) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch(`/api/v1/cronogramas/${cronogramaAtivo.id}/aprovar`, {
        method: "PATCH",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      setMsg("Cronograma aprovado e arquivo transferível gerado.");
      if (acaoId) {
        await loadCronogramas(acaoId);
        await loadArquivosCronograma(acaoId);
      }
    } finally {
      setBusy(false);
    }
  }

  function parseFilenameFromDisposition(header: string | null, fallback: string) {
    if (!header) return fallback;
    const match = /filename="([^"]+)"/i.exec(header);
    return match?.[1] ?? fallback;
  }

  async function transferirCronograma() {
    if (!cronogramaAtivo?.id) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await bffFetch(
        `/api/v1/cronogramas/${cronogramaAtivo.id}/cronograma.html?download=1`,
        { headers: { accept: "text/html" } },
      );
      if (!r.ok) {
        setErr("Erro ao gerar ficheiro do cronograma.");
        return;
      }
      const blob = await r.blob();
      const filename = parseFilenameFromDisposition(
        r.headers.get("Content-Disposition"),
        `cronograma-v${cronogramaAtivo.versao}.html`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg("Cronograma transferível descarregado.");
    } finally {
      setBusy(false);
    }
  }

  async function arquivarCronograma() {
    if (!cronogramaAtivo?.id) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await bffFetch(`/api/v1/cronogramas/${cronogramaAtivo.id}/arquivo`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      if (!r.ok) {
        setErr("Erro ao arquivar cronograma.");
        return;
      }
      setMsg("Cronograma arquivado para transferência (email, inspeção, etc.).");
      if (acaoId) await loadArquivosCronograma(acaoId);
    } finally {
      setBusy(false);
    }
  }

  async function descarregarArquivo(arquivoId: string, nome: string) {
    setBusy(true);
    setErr(null);
    try {
      const r = await bffFetch(`/api/v1/cronogramas/arquivos/${arquivoId}/download`, {
        headers: { accept: "text/html" },
      });
      if (!r.ok) {
        setErr("Erro ao descarregar arquivo.");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function imprimirCronograma() {
    if (!cronogramaAtivo?.id) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await bffFetch(`/api/v1/cronogramas/${cronogramaAtivo.id}/cronograma.html`, {
        headers: { accept: "text/html" },
      });
      if (!r.ok) {
        setErr("Erro ao gerar cronograma DGERT.");
        return;
      }
      const html = await r.text();
      const opened = openHtmlForPrint(html);
      if (!opened.ok) {
        setErr(opened.error);
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  function moduloLabel(m: ModuloOpt) {
    return m.codigo ? `${m.codigo} – ${m.titulo}` : m.titulo;
  }


  if (!acoes.length) return null;

  return (
    <div className="space-y-5">
      {formadorOperacao ? (
        <Card className="border-blue-500/25 bg-blue-500/5">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-slate-100">Sessão, sala Teams e assiduidade</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Cria a sessão online, inicia a reunião Teams e regista presenças - tudo nesta página, sem
              mudar de separador.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Cabeçalho + fluxo */}
      {!embedded ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-400" />
              Cronograma e assiduidade
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Planeia sessões, regista presenças por turma e cumpre requisitos DGERT.
            </p>
          </div>

          {!fixedAcaoId ? (
            <div className="w-full lg:max-w-xs">
              <Select
                label="Acção de formação"
                value={selectedAcaoId}
                onChange={(e) => setSelectedAcaoId(e.target.value)}
              >
                {acoes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigoInterno} – {a.titulo}
                  </option>
                ))}
              </Select>
            </div>
          ) : acaoLabel ? (
            <Badge variant="blue" className="self-start shrink-0">
              {acaoLabel.codigoInterno}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {/* Passos do fluxo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { n: 1, label: "Cronograma", icon: Layers, done: !!selectedCronogramaId },
          { n: 2, label: "Sessões", icon: Calendar, done: sessoes.length > 0 },
          { n: 3, label: "Folha", icon: ClipboardList, done: folhas.length > 0 },
          { n: 4, label: "Presenças", icon: CheckCircle2, done: !!folhaDetalhe?.fechadaEm },
        ].map((step, i, arr) => (
          <div
            key={step.n}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${
              step.done
                ? "border-teal-500/30 bg-teal-500/5 text-teal-300"
                : "border-slate-700/40 bg-slate-900/40 text-slate-500"
            }`}
          >
            <step.icon className="h-4 w-4 shrink-0" />
            <span className="font-medium truncate">{step.label}</span>
            {i < arr.length - 1 ? (
              <ChevronRight className="h-3 w-3 ml-auto hidden sm:block text-slate-600" />
            ) : null}
          </div>
        ))}
      </div>

      {msg ? <Alert variant="success">{msg}</Alert> : null}
      {err ? <Alert variant="error">{err}</Alert> : null}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-slate-900/50 border-slate-700/30">
          <CardContent className="py-3 px-4">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">Sessões</p>
            <p className="text-2xl font-bold text-slate-100 tabular-nums">{stats.totalSessoes}</p>
            <p className="text-[11px] text-teal-400">{stats.realizadas} realizadas</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700/30">
          <CardContent className="py-3 px-4">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">Versão</p>
            <p className="text-2xl font-bold text-slate-100 tabular-nums">
              {cronogramaAtivo ? `v${cronogramaAtivo.versao}` : "-"}
            </p>
            <p className="text-[11px] text-slate-500">
              {cronogramaAtivo?.aprovadoEm ? "Aprovado" : "Em edição"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700/30">
          <CardContent className="py-3 px-4">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">Folhas</p>
            <p className="text-2xl font-bold text-slate-100 tabular-nums">{folhas.length}</p>
            <p className="text-[11px] text-amber-400">{stats.folhasAbertas} abertas</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700/30">
          <CardContent className="py-3 px-4">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">Presenças</p>
            <p className="text-2xl font-bold text-slate-100 tabular-nums">
              {folhaDetalhe ? `${stats.presentes}/${stats.totalPres}` : "-"}
            </p>
            <p className="text-[11px] text-slate-500">folha seleccionada</p>
          </CardContent>
        </Card>
      </div>

      {/* Cronograma toolbar */}
      <Card className="border-slate-700/30 bg-slate-900/40">
        <CardContent className="py-4 flex flex-wrap items-end gap-3">
          {cronogramas.length > 0 ? (
            <div className="flex-1 min-w-[200px] max-w-sm">
              <Select
                label="Cronograma activo"
                value={selectedCronogramaId}
                onChange={(e) => setSelectedCronogramaId(e.target.value)}
              >
                {cronogramas.map((c) => (
                  <option key={c.id} value={c.id}>
                    Versão {c.versao} · {c._count?.sessoes ?? 0} sessões
                    {c.aprovadoEm ? " · aprovado" : ""}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <p className="text-sm text-slate-500 flex-1">
              Ainda não existe cronograma para esta acção.
            </p>
          )}
          {canManageAssiduidade ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void criarCronograma()}
            >
              <Plus className="h-4 w-4" />
              {cronogramas.length ? "Nova versão" : "Criar cronograma"}
            </Button>
          ) : null}
          {canApproveCronograma && cronogramaAtivo && !cronogramaAtivo.aprovadoEm ? (
            <Button
              type="button"
              size="sm"
              disabled={busy || sessoes.length === 0}
              onClick={() => void aprovarCronograma()}
              title={sessoes.length === 0 ? "Adiciona pelo menos uma sessão antes de aprovar" : undefined}
            >
              <CheckCircle2 className="h-4 w-4" />
              Aprovar cronograma
            </Button>
          ) : null}
          {cronogramaAtivo ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void transferirCronograma()}
                title="Descarregar HTML autónomo (transferível)"
              >
                <Download className="h-4 w-4" />
                Transferir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void imprimirCronograma()}
                title="Pré-visualizar e imprimir"
              >
                <FileText className="h-4 w-4" />
                Imprimir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void arquivarCronograma()}
                title="Guardar cópia em arquivo para partilha posterior"
              >
                Arquivar
              </Button>
            </>
          ) : null}
          {cronogramaAtivo?.aprovadoEm ? (
            <Badge variant="green" className="self-center shrink-0">
              Aprovado {formatDatePt(cronogramaAtivo.aprovadoEm)}
            </Badge>
          ) : cronogramaAtivo ? (
            <Badge variant="yellow" className="self-center shrink-0">
              Por aprovar
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {arquivosCronograma.length > 0 ? (
        <Card className="border-slate-700/30 bg-slate-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Arquivos transferíveis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {arquivosCronograma.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/30 bg-slate-800/30 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-slate-200 truncate">{a.nomeFicheiro}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(a.createdAt).toLocaleString("pt-PT")}
                    {a.expiresAt
                      ? ` · válido até ${formatDatePt(a.expiresAt)}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void descarregarArquivo(a.id, a.nomeFicheiro)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Descarregar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!selectedCronogramaId ? (
        <Card className="border-dashed border-slate-700/50">
          <CardContent className="py-12 text-center">
            <CalendarPlus className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Cria um cronograma para começar a planear sessões.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabs internas (gestor); formador vê sessão + assiduidade na mesma vista */}
          {!formadorOperacao ? (
          <div className="flex rounded-xl border border-slate-700/40 p-1 bg-slate-900/50 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setPanel("sessoes")}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                panel === "sessoes" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Sessões
            </button>
            <button
              type="button"
              onClick={() => setPanel("presencas")}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                panel === "presencas" ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Presenças
            </button>
          </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
            {/* Coluna principal */}
            <div className="min-w-0 space-y-4">
              {panel === "sessoes" || formadorOperacao ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-300">
                      {formadorOperacao ? "1. Planear sessão" : `Linha temporal (${sessoes.length})`}
                    </h3>
                    {canManageAssiduidade ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          if (formadorOperacao && !showNovaSessao) {
                            setSessData(new Date().toISOString().slice(0, 10));
                            setSessModalidade("online");
                          }
                          setShowNovaSessao((v) => !v);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        {formadorOperacao ? "Nova sessão online" : "Nova sessão"}
                      </Button>
                    ) : null}
                  </div>

                  {sessoes.length === 0 ? (
                    <Card className="border-dashed border-slate-700/40">
                      <CardContent className="py-10 text-center text-sm text-slate-500 space-y-3">
                        <p>Sem sessões planeadas. Adiciona a primeira sessão ao cronograma.</p>
                        {formadorOperacao && canManageAssiduidade ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setSessData(new Date().toISOString().slice(0, 10));
                              setSessModalidade("online");
                              setShowNovaSessao(true);
                            }}
                          >
                            <Video className="h-4 w-4" />
                            Criar sessão online (Teams)
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {sessoes.map((s) => {
                        const active = selectedSessaoId === s.id;
                        const ModIcon =
                          MODALIDADES.find((m) => m.value === s.modalidade)?.icon ?? MapPin;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSessaoId(s.id);
                              setShowNovaSessao(false);
                            }}
                            className={`w-full text-left rounded-xl border p-4 transition-all ${
                              active
                                ? "border-blue-500/40 bg-blue-500/10 ring-1 ring-blue-500/20"
                                : "border-slate-700/30 bg-slate-900/40 hover:border-slate-600/50"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex items-start gap-3 min-w-0">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-slate-200">
                                  S{s.numeroSessao}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-100">
                                    {formatDataPt(s.data)}
                                  </p>
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
                                    {s.lmsAtivo ? <Badge variant="teal">LMS</Badge> : null}
                                    {(() => {
                                      const sala = resolveSalaOnline(s);
                                      if (!sala) return null;
                                      return (
                                        <Badge variant="purple">
                                          {sala.provider}
                                        </Badge>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right text-[11px] text-slate-500 shrink-0">
                                <p className="flex items-center gap-1 justify-end">
                                  <ClipboardList className="h-3 w-3" />
                                  {s._count?.folhasPresenca ?? 0} folha(s)
                                </p>
                                {s.formador ? (
                                  <p className="flex items-center gap-1 justify-end mt-1 text-slate-400">
                                    <GraduationCap className="h-3 w-3" />
                                    {s.formador.nomeCompleto}
                                  </p>
                                ) : null}
                                {s.moduloUnidade ? (
                                  <p className="flex items-center gap-1 justify-end mt-1 text-slate-500">
                                    <Layers className="h-3 w-3" />
                                    {s.moduloUnidade.codigo ?? s.moduloUnidade.titulo}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {showNovaSessao && canManageAssiduidade ? (
                    <Card className="border-blue-500/20 bg-blue-500/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-slate-200">
                          {formadorOperacao ? "Nova sessão online" : "Registar nova sessão"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {formadorOperacao ? (
                          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                            Após criar, selecciona a sessão e usa «Iniciar e criar sala Teams» no painel à
                            direita.
                          </p>
                        ) : null}
                        <form onSubmit={(e) => void submitSessao(e)} className="grid gap-3 sm:grid-cols-2">
                          <Input
                            label="N.º sessão"
                            type="number"
                            min={1}
                            value={sessNum}
                            onChange={(e) => setSessNum(e.target.value)}
                            required
                          />
                          <Input
                            label="Data"
                            type="date"
                            value={sessData}
                            onChange={(e) => setSessData(e.target.value)}
                            required
                          />
                          <Input
                            label="Início"
                            value={sessInicio}
                            onChange={(e) => setSessInicio(e.target.value)}
                            placeholder="09:00"
                            required
                          />
                          <Input
                            label="Fim"
                            value={sessFim}
                            onChange={(e) => setSessFim(e.target.value)}
                            placeholder="12:30"
                            required
                          />
                          <Select
                            label="Modalidade"
                            value={sessModalidade}
                            onChange={(e) => setSessModalidade(e.target.value)}
                          >
                            {MODALIDADES.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </Select>
                          <Select
                            label="Formador"
                            value={sessFormadorId}
                            onChange={(e) => setSessFormadorId(e.target.value)}
                          >
                            <option value="">- Atribuir depois -</option>
                            {formadores.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.nomeCompleto}
                              </option>
                            ))}
                          </Select>
                          <Select
                            label="Módulo"
                            value={sessModuloId}
                            onChange={(e) => setSessModuloId(e.target.value)}
                          >
                            <option value="">- Sem módulo -</option>
                            {modulos.map((m) => (
                              <option key={m.id} value={m.id}>
                                {moduloLabel(m)}
                              </option>
                            ))}
                          </Select>
                          <div className="sm:col-span-2 flex flex-wrap gap-2">
                            <Button type="submit" disabled={busy}>
                              {formadorOperacao && isModalidadeOnline(sessModalidade)
                                ? "Criar sessão online"
                                : "Registar sessão"}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => setShowNovaSessao(false)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  ) : null}
                </>
              ) : null}

              {showPresencasWorkspace ? (
                <>
                  {formadorOperacao ? (
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 pt-2 border-t border-slate-700/40">
                      <ClipboardList className="h-4 w-4 text-teal-400" />
                      2. Assiduidade e folha
                    </h3>
                  ) : null}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-teal-400" />
                        Folha de presença
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!sessaoAtiva ? (
                        <p className="text-sm text-slate-500">Selecciona uma sessão na linha temporal.</p>
                      ) : (
                        <p className="text-sm text-slate-400">
                          Sessão {sessaoAtiva.numeroSessao} · {formatDataPt(sessaoAtiva.data)}
                        </p>
                      )}

                      {turmas.length === 0 ? (
                        <Alert variant="warning">
                          Cria turmas com matrículas antes de abrir folhas de presença.
                        </Alert>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Select
                            label="Turma"
                            value={selectedTurmaId}
                            onChange={(e) => setSelectedTurmaId(e.target.value)}
                          >
                            {turmas.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.codigo} – {t.nome}
                              </option>
                            ))}
                          </Select>
                          {folhas.length > 0 ? (
                            <Select
                              label="Folha existente"
                              value={selectedFolhaId}
                              onChange={(e) => setSelectedFolhaId(e.target.value)}
                            >
                              {folhas.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.turma ? `${f.turma.codigo} – ` : ""}
                                  {f.validadaFormadorEm
                                    ? "Validada"
                                    : "Em edição"}{" "}
                                  · {f._count?.presencas ?? 0} formandos
                                </option>
                              ))}
                            </Select>
                          ) : null}
                        </div>
                      )}

                      {sessaoAtiva?.lmsAtivo && selectedTurmaId && painelLms ? (
                        <div className="rounded-xl border border-teal-500/25 bg-teal-950/20 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-teal-200 flex items-center gap-2">
                              <Radio className="h-4 w-4" />
                              Assiduidade em tempo real (portal)
                            </p>
                            <span className="text-xs text-slate-400">
                              {painelLms.emSessaoCount}/{painelLms.totalMatriculas} na sessão · limiar{" "}
                              {painelLms.sessao.minutosPresencaMin} min
                              {painelLms.alertasCount > 0 ? (
                                <span className="text-amber-400 ml-2">
                                  · {painelLms.alertasCount} alerta(s)
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-xs min-w-[360px]">
                              <thead>
                                <tr className="text-left text-slate-500 uppercase tracking-wider border-b border-slate-700/30">
                                  <th className="py-1.5 px-2">Formando</th>
                                  <th className="py-1.5 px-2 hidden lg:table-cell">Email reunião</th>
                                  <th className="py-1.5 px-2">Estado</th>
                                  <th className="py-1.5 px-2 text-right">Tempo</th>
                                  <th className="py-1.5 px-2 hidden md:table-cell">Alertas</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {painelLms.formandos.map((f) => (
                                  <tr key={f.matriculaId}>
                                    <td className="py-1.5 px-2 text-slate-200">{f.nome}</td>
                                    <td className="py-1.5 px-2 text-slate-500 hidden lg:table-cell text-[11px]">
                                      {f.emailPresencaReuniao ?? "-"}
                                    </td>
                                    <td className="py-1.5 px-2">
                                      {f.emSessao ? (
                                        <span className="text-teal-400">Em sessão</span>
                                      ) : f.segundosTotais > 0 ? (
                                        <span className="text-slate-400">Saiu</span>
                                      ) : (
                                        <span className="text-slate-600">Ausente</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-300">
                                      {f.emSessao && f.joinDesde ? (
                                        <TempoPresencaAoVivo
                                          segundosFechados={f.segundosFechados}
                                          emSessao
                                          joinDesde={f.joinDesde}
                                          className="text-teal-400"
                                        />
                                      ) : (
                                        f.tempoFormatado
                                      )}
                                      {f.minutosEfetivos > 0 ? (
                                        <span className="text-slate-500 ml-1">({f.minutosEfetivos} min)</span>
                                      ) : null}
                                    </td>
                                    <td className="py-1.5 px-2 hidden md:table-cell">
                                      {f.alertas.length > 0 ? (
                                        <ul className="space-y-0.5">
                                          {f.alertas.map((a) => (
                                            <li key={a} className="text-[10px] text-amber-400/90 leading-snug">
                                              {ALERTA_PRESENCA_LABELS[a]}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span className="text-slate-600 text-[10px]">-</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Contagem via portal (matrícula autenticada). Na reunião Zoom/Teams só conta o email
                            configurado por formando - convidados com outro endereço são ignorados.
                          </p>
                        </div>
                      ) : null}

                      {sessaoAtiva ? (
                        <ResumoSessaoPresencas sessao={sessaoAtiva} folhaDetalhe={folhaDetalhe} />
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={busy || !selectedSessaoId || !selectedTurmaId}
                          onClick={() => void abrirFolha()}
                        >
                          <ClipboardList className="h-4 w-4" />
                          {canManageAssiduidade ? "Abrir folha (sessão + turma)" : "Consultar folha"}
                        </Button>
                        {sessaoAtiva?.lmsAtivo && canManageAssiduidade ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy || !selectedSessaoId || !selectedTurmaId}
                            onClick={() => void importarLms()}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Importar assiduidade LMS
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>

                  {folhaDetalhe ? (
                    <Card>
                      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 gap-2 flex-wrap">
                        <CardTitle className="text-base">
                          Registo de presenças
                          {folhaDetalhe.turma ? (
                            <span className="block text-xs font-normal text-slate-500 mt-0.5">
                              {folhaDetalhe.turma.codigo} – {folhaDetalhe.turma.nome}
                            </span>
                          ) : null}
                        </CardTitle>
                        {folhaDetalhe.aprovadaGestorEm ? (
                          <Badge variant="green" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Aprovada pelo gestor
                          </Badge>
                        ) : folhaDetalhe.validadaFormadorEm ? (
                          <Badge variant="green" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Validada pelo formador
                          </Badge>
                        ) : (
                          <Badge variant="default">Em edição</Badge>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto -mx-1">
                          <table className="w-full text-sm min-w-[480px]">
                            <thead>
                              <tr className="border-b border-slate-700/40 text-left text-xs text-slate-500 uppercase tracking-wider">
                                <th className="py-2 px-2">Formando</th>
                                <th className="py-2 px-2 hidden sm:table-cell">NIF</th>
                                <th className="py-2 px-2 hidden md:table-cell">Min LMS</th>
                                <th className="py-2 px-2">Assiduidade</th>
                                <th className="py-2 px-2">Motivo (falta justificada)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {folhaDetalhe.presencas.map((p) => {
                                const edit = presencaEdits[p.id] ?? {
                                  estado: isEstadoPresenca(p.estado) ? p.estado : "",
                                  motivo: p.motivoJustificacao ?? "",
                                };
                                const faltaJustificadaUi = edit.estado === "FALTA_JUSTIFICADA";
                                const motivoPendente =
                                  faltaJustificadaUi &&
                                  edit.motivo.trim() !== (p.motivoJustificacao ?? "").trim();
                                return (
                                <tr key={p.id} className="hover:bg-slate-800/30 align-top">
                                  <td className="py-2.5 px-2 text-slate-200 font-medium">
                                    {p.matricula.formando.nome}
                                  </td>
                                  <td className="py-2.5 px-2 text-slate-500 hidden sm:table-cell tabular-nums">
                                    {p.matricula.formando.nif}
                                  </td>
                                  <td className="py-2.5 px-2 text-slate-400 hidden md:table-cell tabular-nums text-xs">
                                    {p.minutosEfetivos != null ? `${p.minutosEfetivos} min` : "-"}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    {canManageAssiduidade ? (
                                      <select
                                        value={edit.estado}
                                        disabled={busy}
                                        onChange={(e) => onPresencaEstadoChange(p, e.target.value)}
                                        className="w-full max-w-[11rem] rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                                      >
                                        <option value="">- Seleccionar -</option>
                                        {ESTADOS_PRESENCA.map((est) => (
                                          <option key={est} value={est}>
                                            {ESTADO_PRESENCA_LABELS[est]}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-slate-300">
                                        {isEstadoPresenca(p.estado)
                                          ? ESTADO_PRESENCA_LABELS[p.estado]
                                          : "Por assinalar"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    {faltaJustificadaUi && canManageAssiduidade ? (
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <Input
                                          value={edit.motivo}
                                          placeholder="Ex.: consulta médica, despacho de serviço…"
                                          disabled={busy}
                                          onChange={(e) =>
                                            setPresencaEdits((prev) => ({
                                              ...prev,
                                              [p.id]: {
                                                ...edit,
                                                motivo: e.target.value,
                                              },
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              guardarFaltaJustificada(p);
                                            }
                                          }}
                                          className="text-sm min-w-[12rem]"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          disabled={busy || !edit.motivo.trim()}
                                          onClick={() => guardarFaltaJustificada(p)}
                                        >
                                          Guardar
                                        </Button>
                                        {motivoPendente ? (
                                          <span className="text-xs text-amber-400/90 sm:sr-only">
                                            Motivo por guardar
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : faltaJustificadaUi ? (
                                      <span className="text-slate-400 text-sm">
                                        {p.motivoJustificacao || "-"}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600 text-sm">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {canManageAssiduidade && !folhaDetalhe.validadaFormadorEm ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={() => void validarFolha()}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Validar e fechar folha
                            </Button>
                          ) : null}
                          {folhaDetalhe.validadaFormadorEm ? (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => void transferirPresencas()}
                                title="Descarregar HTML autónomo (transferível)"
                              >
                                <Download className="h-4 w-4" />
                                Transferir
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                onClick={() => void imprimirPresencas()}
                                title="Pré-visualizar e imprimir"
                              >
                                <FileText className="h-4 w-4" />
                                Imprimir
                              </Button>
                            </>
                          ) : null}
                          {canApprovePresencasFolha &&
                          folhaDetalhe.validadaFormadorEm &&
                          !folhaDetalhe.aprovadaGestorEm ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={() => void aprovarFolha()}
                            >
                              <Lock className="h-4 w-4" />
                              Aprovar folha
                            </Button>
                          ) : null}
                        </div>
                        {folhaDetalhe.validadaFormadorEm && canManageAssiduidade ? (
                          <p className="text-xs text-slate-500 mt-3">
                            Podes alterar o estado dos formandos a qualquer momento; alterações
                            reabrem a folha para nova validação.
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : null}
                </>
              ) : null}
            </div>

            {/* Painel lateral - operar sessão */}
            <aside className="min-w-0">
              {(panel === "sessoes" || formadorOperacao) && sessaoAtiva && canManageAssiduidade ? (
                <Card className={`border-slate-700/30 sticky top-4 ${formadorOperacao ? "border-blue-500/30 ring-1 ring-blue-500/15" : ""}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {formadorOperacao
                        ? `Operar sessão ${sessaoAtiva.numeroSessao}`
                        : `Editar sessão ${sessaoAtiva.numeroSessao}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Select
                      label="Estado"
                      value={editSessEstado}
                      onChange={(e) => setEditSessEstado(e.target.value)}
                    >
                      {ESTADOS_SESSAO.map((e) => (
                        <option key={e} value={e}>
                          {e === "AGENDADA" ? "Agendada" : e === "REALIZADA" ? "Realizada" : "Cancelada"}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Modalidade"
                      value={editSessModalidade}
                      onChange={(e) => setEditSessModalidade(e.target.value)}
                    >
                      {MODALIDADES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Formador"
                      value={editSessFormadorId}
                      onChange={(e) => setEditSessFormadorId(e.target.value)}
                    >
                      <option value="">- Sem formador -</option>
                      {formadores.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nomeCompleto}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Módulo"
                      value={editSessModuloId}
                      onChange={(e) => setEditSessModuloId(e.target.value)}
                    >
                      <option value="">- Sem módulo -</option>
                      {modulos.map((m) => (
                        <option key={m.id} value={m.id}>
                          {moduloLabel(m)}
                        </option>
                      ))}
                    </Select>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editFormadorPresente === true}
                        onChange={(e) =>
                          setEditFormadorPresente(e.target.checked ? true : false)
                        }
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-teal-500"
                      />
                      Formador presente na sessão
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editLmsAtivo}
                        onChange={(e) => setEditLmsAtivo(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-teal-500"
                      />
                      LMS activo (assiduidade automática)
                    </label>
                    {sessaoSala ? (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          disabled={busy || !!sessaoAtiva?.terminadaEm}
                          onClick={() => void abrirSalaAtual()}
                        >
                          <Video className="h-4 w-4" />
                          Abrir sala {sessaoSala.provider}
                        </Button>
                        <a
                          href={sessaoSala.joinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-purple-400 hover:text-purple-300 truncate text-center"
                        >
                          Link directo →
                        </a>
                      </div>
                    ) : null}
                    {canIniciarSessao ? (
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {sessaoOnlineLms
                          ? formadorOperacao
                            ? "Passo seguinte: inicia a sessão - a sala Teams abre e os formandos são notificados."
                            : "Inicia aqui - a sala abre automaticamente e os formandos são notificados."
                          : "Inicia a sessão para notificar os formandos (presencial)."}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-2">
                      {canIniciarSessao && !sessaoAtiva?.iniciadaEm && !sessaoAtiva?.terminadaEm ? (
                        <Button
                          type="button"
                          className="w-full"
                          disabled={busy || sessaoAtiva?.estado === "CANCELADA"}
                          onClick={() => void iniciarEAbrirSala()}
                        >
                          <Video className="h-4 w-4" />
                          {sessaoOnlineLms
                            ? sessaoSala
                              ? "Iniciar e abrir sala Teams"
                              : "Iniciar e criar sala Teams"
                            : "Iniciar sessão (notifica formandos)"}
                        </Button>
                      ) : null}
                      {canIniciarSessao && sessaoAtiva?.iniciadaEm && !sessaoAtiva?.terminadaEm && sessaoSala ? (
                        <Button
                          type="button"
                          className="w-full"
                          disabled={busy}
                          onClick={() => void abrirSalaAtual()}
                        >
                          <Video className="h-4 w-4" />
                          Entrar na sala {sessaoSala.provider}
                        </Button>
                      ) : null}
                      {canIniciarSessao ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full"
                          disabled={
                            busy ||
                            !sessaoAtiva?.iniciadaEm ||
                            !!sessaoAtiva?.terminadaEm ||
                            sessaoAtiva?.estado === "CANCELADA"
                          }
                          onClick={() => void terminarSessao()}
                        >
                          Terminar sessão (para todos os contadores)
                        </Button>
                      ) : null}
                    </div>
                    {sessaoAtiva?.terminadaEm ? (
                      <p className="text-[11px] text-slate-400">
                        Terminada em{" "}
                        {new Date(sessaoAtiva.terminadaEm).toLocaleString("pt-PT")}
                      </p>
                    ) : sessaoAtiva?.iniciadaEm ? (
                      <p className="text-[11px] text-teal-400/90">
                        Iniciada em{" "}
                        {new Date(sessaoAtiva.iniciadaEm).toLocaleString("pt-PT")}
                      </p>
                    ) : null}
                    <Button type="button" className="w-full" disabled={busy} onClick={() => void updateSessao()}>
                      Guardar alterações
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setPanel("presencas")}
                    >
                      Ir para presenças
                    </Button>
                  </CardContent>
                </Card>
              ) : panel === "sessoes" && sessaoAtiva && !canManageAssiduidade ? (
                <Card className="border-slate-700/30 sticky top-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Sessão {sessaoAtiva.numeroSessao}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-1.5">
                      {sessaoEstadoBadge(sessaoAtiva.estado)}
                      <Badge variant="default">{sessaoAtiva.modalidade}</Badge>
                    </div>
                    <ResumoSessaoPresencas sessao={sessaoAtiva} folhaDetalhe={folhaDetalhe} />
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setPanel("presencas")}
                    >
                      Ver presenças
                    </Button>
                  </CardContent>
                </Card>
              ) : panel === "presencas" ? (
                <Card className="border-slate-700/30 bg-slate-900/30 sticky top-4">
                  <CardContent className="py-6 text-sm text-slate-400 space-y-3">
                    <p className="font-medium text-slate-200">Assiduidade</p>
                    {sessaoAtiva ? (
                      <ResumoSessaoPresencas sessao={sessaoAtiva} folhaDetalhe={folhaDetalhe} />
                    ) : null}
                    {!canManageAssiduidade ? (
                      <p className="text-xs leading-snug">
                        Consulta dos dados da sessão: início, fim, formador e presenças.
                      </p>
                    ) : (
                      <ol className="list-decimal list-inside space-y-1.5 text-xs">
                        <li>Selecciona sessão e turma</li>
                        <li>Abre a folha (inclui matrículas)</li>
                        <li>Marca presenças dos formandos</li>
                        <li>Valida e fecha a folha</li>
                      </ol>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed border-slate-700/40">
                  <CardContent className="py-8 text-center text-sm text-slate-500">
                    Selecciona uma sessão para editar ou abrir presenças.
                  </CardContent>
                </Card>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
