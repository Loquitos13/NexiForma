"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  QrCode,
  Radio,
  RefreshCw,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { openMeetingUrl } from "@/lib/client/open-meeting-url";
import { terminarSessaoFormacaoComConfirmacao } from "@/lib/client/terminar-sessao-formacao";
import {
  getDgertRequisitoGuide,
  readDgertRequisitoFromSearch,
} from "@/lib/dossie/dgert-requisito";
import {
  readPendenciaFocusFromSearch,
  type PendenciaFocus,
} from "@/lib/client/pendencias-documentacao-href";
import { notifyComplianceUpdated } from "@/lib/client/use-portal-notifications";
import { resolveSalaOnline, isModalidadeOnline, providerParaModalidade, ESTADOS_PRESENCA, ESTADO_PRESENCA_LABELS, isEstadoPresenca, labelOrigemPresenca, origemPresencaBadgeVariant, ALERTA_PRESENCA_LABELS, formatarDuracaoHhMmSs, type EstadoPresenca, type AlertaPresencaCodigo } from "@nexiforma/shared";
import { TempoPresencaAoVivo } from "@/components/lms/tempo-presenca-ao-vivo";
import { Alert } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { dismissToast, pushStickyToast, pushToast } from "@/components/ui/toast";
import { cn } from "@/lib/ui/cn";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import {
  SumarioAssinaturaModal,
  type SumarioAssinaturaConfirm,
} from "@/components/portal/sumario-assinatura-modal";
import {
  FolhaAprovacaoModal,
  type FolhaAprovacaoConfirm,
} from "@/components/portal/folha-aprovacao-modal";
import { PresencaQrModal } from "@/components/portal/presenca-qr-modal";
import { CronogramaImportIaModal } from "@/components/portal/cronograma-import-ia-modal";
import { FormadorSessaoPicker } from "@/components/portal/formador-sessao-picker";
import { AtribuirFormadorAcaoModal } from "@/components/portal/atribuir-formador-acao-modal";
import { formadorNomeBadge } from "@/lib/formador-display";

const TURMA_VIEW_STORAGE_PREFIX = "portal-acao-turma:";

function readStoredTurmaId(acaoId: string): string | null {
  if (typeof window === "undefined" || !acaoId) return null;
  try {
    return window.localStorage.getItem(`${TURMA_VIEW_STORAGE_PREFIX}${acaoId}`)?.trim() || null;
  } catch {
    return null;
  }
}

function storeTurmaId(acaoId: string, turmaId: string) {
  if (typeof window === "undefined" || !acaoId || !turmaId) return;
  try {
    window.localStorage.setItem(`${TURMA_VIEW_STORAGE_PREFIX}${acaoId}`, turmaId);
  } catch {
    /* ignore quota / private mode */
  }
}

type AcaoOption = { id: string; codigoInterno: string; titulo: string };

type CronogramaRow = {
  id: string;
  versao: number;
  aprovadoEm?: string | null;
  _count?: { sessoes: number };
};

type ImportIaJobRow = {
  id: string;
  cronogramaId: string;
  acaoFormacaoId: string;
  status: "A_PROCESSAR" | "RASCUNHO" | "FALHA" | "APLICADO" | "DESCARTADO";
  nomeFicheiro: string | null;
  erro: string | null;
};

type SessaoRow = {
  id: string;
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  turmaId?: string | null;
  /** Nome do módulo no cronograma (import IA), quando não há ModuloUnidade ligado. */
  titulo?: string | null;
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
  formadorEntradaEm?: string | null;
  formadorSaidaEm?: string | null;
  formadorDuracaoSegundos?: number | null;
  moduloUnidade?: { id: string; codigo: string | null; titulo: string } | null;
  _count?: { folhasPresenca: number };
};

function tituloSessao(s: Pick<SessaoRow, "numeroSessao" | "titulo" | "moduloUnidade">): string {
  return s.moduloUnidade?.titulo?.trim() || s.titulo?.trim() || `Sessão ${s.numeroSessao}`;
}

type ModuloOpt = { id: string; codigo: string | null; titulo: string };

type CronogramaArquivo = {
  id: string;
  nomeFicheiro: string;
  tamanhoBytes: number;
  createdAt: string;
  expiresAt: string | null;
};

type FormadorOpt = {
  id: string;
  nomeCompleto: string;
  email?: string | null;
  ccpNumero?: string | null;
};
type TurmaRow = {
  id: string;
  codigo: string;
  nome: string;
  _count?: { matriculas: number };
};
type MatriculaTurmaPreview = {
  id: string;
  estado: string;
  formando: { nome: string; nif: string };
};
type SumarioRow = {
  id: string;
  conteudo: string;
  imutavel: boolean;
  assinadoEm: string | null;
  assinaturaTipo: string | null;
  pdfNomeFicheiro: string | null;
  pdfStorageKey: string | null;
};
type FolhaRow = {
  id: string;
  sessaoId?: string | null;
  fechadaEm: string | null;
  validadaFormadorEm: string | null;
  aprovadaGestorEm: string | null;
  turma?: { codigo: string; nome: string } | null;
  _count?: { presencas: number };
};

function folhaPresencasJaFechada(
  folha: Pick<FolhaRow, "fechadaEm" | "validadaFormadorEm" | "aprovadaGestorEm"> | null | undefined,
): boolean {
  if (!folha) return false;
  if (folha.fechadaEm) return true;
  return Boolean(folha.validadaFormadorEm && folha.aprovadaGestorEm);
}

type PresencaLinha = {
  id: string;
  presente: boolean;
  estado: EstadoPresenca | null;
  motivoJustificacao: string | null;
  validado: boolean;
  minutosEfetivos?: number | null;
  origem?: string | null;
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

type FolhaActor = {
  id: string;
  nome: string;
  role: string;
  roleLabel: string;
  assinaturaNome?: string | null;
  em?: string | null;
};

type FolhaDetalhe = {
  id: string;
  fechadaEm: string | null;
  validadaFormadorEm: string | null;
  aprovadaGestorEm: string | null;
  validacaoFormadorAssinaturaNome?: string | null;
  aprovacaoAssinaturaNome?: string | null;
  validadaPor?: FolhaActor | null;
  aprovadaPor?: FolhaActor | null;
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
  /** Pode iniciar sessão (gestor ou formador) - a sessão concreta ainda exige atribuição. */
  canIniciarSessao?: boolean;
  /** Quando definido, esconde o selector de acção (detalhe da acção). */
  fixedAcaoId?: string;
  /** Só gestor - aprovar cronograma para compliance. */
  canApproveCronograma?: boolean;
  /** Gestor ou coordenador pedagógico - aprovar folha validada pelo formador. */
  canApprovePresencasFolha?: boolean;
  /** Esconde título duplicado quando embutido no detalhe da acção. */
  embedded?: boolean;
  /** Curso da acção - necessário para módulos no cronograma DGERT. */
  cursoId?: string;
  /** Perfil do formador autenticado (para restringir operação à sessão atribuída). */
  formadorProfileId?: string | null;
  /** Callback para sincronizar compliance/estado da acção no ecrã pai. */
  onUpdated?: () => void | Promise<void>;
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
  formadorProfileId = null,
  onUpdated,
}: Props) {
  const searchParams = useSearchParams();
  const [selectedAcaoId, setSelectedAcaoId] = useState(fixedAcaoId ?? "");
  const [cronogramas, setCronogramas] = useState<CronogramaRow[]>([]);
  const [selectedCronogramaId, setSelectedCronogramaId] = useState("");
  const [sessoes, setSessoes] = useState<SessaoRow[]>([]);
  const [selectedSessaoId, setSelectedSessaoId] = useState("");
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [matriculasTurma, setMatriculasTurma] = useState<MatriculaTurmaPreview[]>([]);
  const [folhas, setFolhas] = useState<FolhaRow[]>([]);
  const [folhaDetalhe, setFolhaDetalhe] = useState<FolhaDetalhe | null>(null);
  const [selectedFolhaId, setSelectedFolhaId] = useState("");
  const [presencaEdits, setPresencaEdits] = useState<
    Record<string, { estado: EstadoPresenca | ""; motivo: string }>
  >({});

  const [panel, setPanel] = useState<"sessoes" | "presencas">("sessoes");
  const [showNovaSessao, setShowNovaSessao] = useState(false);
  const [showImportIa, setShowImportIa] = useState(false);
  const [initialImportJobId, setInitialImportJobId] = useState<string | null>(null);
  const [importJobs, setImportJobs] = useState<ImportIaJobRow[]>([]);
  const [dgertRequisito, setDgertRequisito] = useState<string | null>(null);
  /** Deep-link ?sessaoId= - consumido quando a lista de sessões carrega. */
  const urlSessaoIdRef = useRef<string | null>(null);
  const [pendenciaFocus, setPendenciaFocus] = useState<PendenciaFocus | null>(null);

  const urlSessaoId = searchParams.get("sessaoId")?.trim() || null;
  const urlFocus = readPendenciaFocusFromSearch(`?${searchParams.toString()}`);
  const urlImportJob = searchParams.get("importJob");
  const urlDgertRequisito = readDgertRequisitoFromSearch(`?${searchParams.toString()}`);

  useEffect(() => {
    if (urlImportJob) {
      setInitialImportJobId(urlImportJob);
      setShowImportIa(true);
    }
  }, [urlImportJob]);

  useEffect(() => {
    if (urlSessaoId) urlSessaoIdRef.current = urlSessaoId;
    if (urlFocus) {
      setPendenciaFocus(urlFocus);
      setPanel(urlFocus === "folha" ? "presencas" : "sessoes");
    } else {
      setPendenciaFocus(null);
    }
  }, [urlSessaoId, urlFocus]);

  useEffect(() => {
    setDgertRequisito(urlDgertRequisito);
    if (urlFocus) return;
    const guide = getDgertRequisitoGuide(urlDgertRequisito);
    if (!guide) return;
    if (
      guide.target === "cronograma_presencas" ||
      urlDgertRequisito === "assiduidade" ||
      urlDgertRequisito === "folhas_fechadas" ||
      urlDgertRequisito === "taxa_assiduidade"
    ) {
      setPanel("presencas");
    } else if (
      guide.target === "cronograma_sessoes" ||
      guide.target === "sessao_sumario" ||
      urlDgertRequisito === "sessoes_planeadas" ||
      urlDgertRequisito === "formadores" ||
      urlDgertRequisito === "sumarios" ||
      urlDgertRequisito === "sumarios_assinados"
    ) {
      setPanel("sessoes");
      if (
        urlDgertRequisito === "sessoes_planeadas" ||
        urlDgertRequisito === "formadores"
      ) {
        setShowNovaSessao(true);
      }
    }
  }, [urlDgertRequisito, urlFocus]);

  // Se as sessões já estão carregadas, aplica o sessaoId da URL de imediato.
  useEffect(() => {
    if (!urlSessaoId || !sessoes.length) return;
    if (sessoes.some((s) => s.id === urlSessaoId)) {
      setSelectedSessaoId(urlSessaoId);
      urlSessaoIdRef.current = null;
    }
  }, [urlSessaoId, sessoes]);

  const dgertTarget = getDgertRequisitoGuide(dgertRequisito)?.target ?? null;
  const highlightFolha =
    pendenciaFocus === "folha" ||
    pendenciaFocus === "pendencias" ||
    dgertRequisito === "folhas_fechadas";
  const highlightSumario =
    pendenciaFocus === "sumario" ||
    pendenciaFocus === "pendencias" ||
    dgertTarget === "sessao_sumario";

  // Após deep-link, faz scroll para o bloco da pendência (folha / sumário).
  useEffect(() => {
    if (!pendenciaFocus || !selectedSessaoId) return;
    const target =
      pendenciaFocus === "folha"
        ? "cronograma_presencas"
        : "sessao_sumario";
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-dgert-target="${target}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [pendenciaFocus, selectedSessaoId, panel]);

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
  /** Erro de validação da folha - permanece até o gestor/formador corrigir assiduidades. */
  const [folhaValidacaoErr, setFolhaValidacaoErr] = useState<string | null>(null);
  const [intDisp, setIntDisp] = useState({
    podeCriarSalaZoom: false,
    podeCriarSalaTeams: false,
    zoom: { aviso: null as string | null },
    teams: { aviso: null as string | null },
  });
  const [painelLms, setPainelLms] = useState<PainelLms | null>(null);
  const [sumario, setSumario] = useState<SumarioRow | null>(null);
  const [sumarioPdf, setSumarioPdf] = useState<File | null>(null);
  const [sumarioModalOpen, setSumarioModalOpen] = useState(false);
  const [folhaAprovacaoModalOpen, setFolhaAprovacaoModalOpen] = useState(false);
  const [folhaValidacaoModalOpen, setFolhaValidacaoModalOpen] = useState(false);
  const [presencaQrModalOpen, setPresencaQrModalOpen] = useState(false);
  const [atribuirFormadorModalOpen, setAtribuirFormadorModalOpen] = useState(false);

  const acaoId = fixedAcaoId ?? selectedAcaoId;
  const acaoLabel = acoes.find((a) => a.id === acaoId);
  const cronogramaAtivo = cronogramas.find((c) => c.id === selectedCronogramaId);
  const rascunhoImportJob = importJobs.find((j) => j.status === "RASCUNHO");
  const processandoImportJob = importJobs.find((j) => j.status === "A_PROCESSAR");
  const sessaoAtiva = sessoes.find((s) => s.id === selectedSessaoId);
  const turmaAtiva = turmas.find((t) => t.id === selectedTurmaId) ?? null;
  const folhaSeleccionada = folhas.find((f) => f.id === selectedFolhaId) ?? null;
  const folhaTurmaFechada = folhaPresencasJaFechada(folhaSeleccionada);
  /** Vista simplificada só para formador (cronograma/import, etc.). */
  const formadorOperacao = Boolean(embedded && canIniciarSessao && !canApproveCronograma);
  /** Aside operacional (mock): título + formador + acções - na página da acção. */
  const asideOperacional = Boolean(embedded);
  /** Gestor da entidade OU formador atribuído a esta sessão. */
  const canOperateSessaoAtiva = Boolean(
    canApproveCronograma ||
      (formadorProfileId && sessaoAtiva?.formador?.id === formadorProfileId),
  );
  /** Contagem estável: lista carregada, ou _count da turma se a lista ainda falhar. */
  const inscritosTurmaCount = Math.max(
    matriculasTurma.length,
    turmaAtiva?._count?.matriculas ?? 0,
  );
  const sessaoSemFormador = Boolean(sessaoAtiva && !sessaoAtiva.formador?.id);
  const showPresencasWorkspace =
    (panel === "presencas" && !formadorOperacao) ||
    (formadorOperacao &&
      Boolean(selectedSessaoId) &&
      (Boolean(sessaoAtiva?.iniciadaEm) || sessaoAtiva?.estado === "REALIZADA"));
  const presencasWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const sessaoSala = sessaoAtiva ? resolveSalaOnline(sessaoAtiva) : null;
  const sessaoOnlineLms = Boolean(
    sessaoAtiva && isModalidadeOnline(sessaoAtiva.modalidade) && sessaoAtiva.lmsAtivo,
  );
  const providerSessao = sessaoAtiva ? providerParaModalidade(sessaoAtiva.modalidade) : "TEAMS";

  const sessoesSemFormador = useMemo(
    () => sessoes.filter((s) => !s.formador?.id).length,
    [sessoes],
  );
  const formadorNomesNaAcao = useMemo(
    () => sessoes.map((s) => s.formador?.nomeCompleto).filter((n): n is string => Boolean(n)),
    [sessoes],
  );
  /** Lista do picker: API + formadores já presentes nas sessões (cobre 403 / lista vazia). */
  const formadoresPicker = useMemo(() => {
    const byId = new Map<string, FormadorOpt>();
    for (const f of formadores) byId.set(f.id, f);
    for (const s of sessoes) {
      if (s.formador?.id && !byId.has(s.formador.id)) {
        byId.set(s.formador.id, {
          id: s.formador.id,
          nomeCompleto: s.formador.nomeCompleto,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt"));
  }, [formadores, sessoes]);
  const podeAtribuirEsteATodas =
    Boolean(editSessFormadorId) &&
    !sessoes.every((s) => s.formador?.id === editSessFormadorId);

  const stats = useMemo(() => {
    const realizadas = sessoes.filter((s) => s.estado === "REALIZADA").length;
    const folhasAbertas = folhas.filter((f) => !f.aprovadaGestorEm && !f.fechadaEm).length;
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
    try {
      const res = await bffFetch(
        `/api/v1/lms/sessoes/${encodeURIComponent(selectedSessaoId)}/painel-presenca?turmaId=${encodeURIComponent(selectedTurmaId)}`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) {
        setPainelLms(null);
        return;
      }
      setPainelLms((await res.json()) as PainelLms);
    } catch {
      // Rede/API indisponível - o poll seguinte tenta de novo.
    }
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
      setSelectedCronogramaId((prev) => {
        if (!rows.length) return "";
        if (prev && rows.some((c) => c.id === prev)) return prev;
        // Evita ficar numa versão nova vazia quando a anterior ainda tem sessões.
        const comSessoes = rows.find((c) => (c._count?.sessoes ?? 0) > 0);
        if (comSessoes) return comSessoes.id;
        const aprovado = rows.find((c) => c.aprovadoEm);
        if (aprovado) return aprovado.id;
        return rows[0]!.id;
      });
    }
  }, []);

  const loadImportJobs = useCallback(async (cronogramaId: string) => {
    // Importação IA é só gestor/coordenador pedagógico - formador recebe 403.
    if (!canApproveCronograma || !cronogramaId) {
      setImportJobs([]);
      return;
    }
    try {
      const res = await bffFetch(
        `/api/v1/cronogramas/importar-ia/jobs?cronogramaId=${encodeURIComponent(cronogramaId)}`,
        { headers: { accept: "application/json" } },
      );
      if (res.ok) {
        setImportJobs((await res.json()) as ImportIaJobRow[]);
      }
    } catch {
      // Poll silencioso: "Failed to fetch" se a API/BFF estiver em baixo.
    }
  }, [canApproveCronograma]);

  useEffect(() => {
    if (!canApproveCronograma || !selectedCronogramaId) {
      setImportJobs([]);
      return;
    }
    void loadImportJobs(selectedCronogramaId);
    const id = setInterval(() => void loadImportJobs(selectedCronogramaId), 8_000);
    return () => clearInterval(id);
  }, [canApproveCronograma, selectedCronogramaId, loadImportJobs]);

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
      const stored = readStoredTurmaId(id);
      setSelectedTurmaId((prev) => {
        if (rows.length === 0) return "";
        if (prev && rows.some((t) => t.id === prev)) return prev;
        if (stored && rows.some((t) => t.id === stored)) return stored;
        // Default: primeira turma criada (ordem da API).
        return rows[0]!.id;
      });
    }
  }, []);

  useEffect(() => {
    if (acaoId && selectedTurmaId) storeTurmaId(acaoId, selectedTurmaId);
  }, [acaoId, selectedTurmaId]);

  const loadMatriculasTurma = useCallback(async (turmaId: string) => {
    if (!turmaId) {
      setMatriculasTurma([]);
      return;
    }
    const res = await bffFetch(
      `/api/v1/matriculas?turmaId=${encodeURIComponent(turmaId)}`,
      { headers: { accept: "application/json" } },
    );
    if (res.ok) {
      setMatriculasTurma((await res.json()) as MatriculaTurmaPreview[]);
    } else {
      setMatriculasTurma([]);
    }
  }, []);

  const loadSessoes = useCallback(async (cronogramaId: string, turmaId?: string) => {
    if (!cronogramaId || !turmaId) {
      setSessoes([]);
      setSelectedSessaoId("");
      return;
    }
    const qs = new URLSearchParams({ cronogramaId, turmaId });
    const res = await bffFetch(`/api/v1/sessoes-formacao?${qs}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return;
    let rows = (await res.json()) as SessaoRow[];
    const precisaTitulo = rows.some((s) => !s.moduloUnidade?.titulo && !s.titulo?.trim());
    if (precisaTitulo) {
      try {
        const fix = await bffFetch(
          `/api/v1/cronogramas/${encodeURIComponent(cronogramaId)}/importar-ia/reparar-titulos`,
          { method: "POST", headers: { accept: "application/json" } },
        );
        if (fix.ok) {
          const again = await bffFetch(`/api/v1/sessoes-formacao?${qs}`, {
            headers: { accept: "application/json" },
          });
          if (again.ok) rows = (await again.json()) as SessaoRow[];
        }
      } catch {
        /* ignore - lista continua sem títulos */
      }
    }
    setSessoes(rows);
    setSelectedSessaoId((prev) => {
      const fromUrl = urlSessaoIdRef.current;
      if (fromUrl && rows.some((s) => s.id === fromUrl)) {
        urlSessaoIdRef.current = null;
        return fromUrl;
      }
      return rows.length ? (rows.some((s) => s.id === prev) ? prev : rows[0].id) : "";
    });
    const nextNum = rows.length ? Math.max(...rows.map((s) => s.numeroSessao)) + 1 : 1;
    setSessNum(String(nextNum));
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
    } else {
      setFolhas([]);
      setSelectedFolhaId("");
      setFolhaDetalhe(null);
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
    void (async () => {
      const [listRes, meRes] = await Promise.all([
        bffFetch("/api/v1/formadores", { headers: { accept: "application/json" } }),
        bffFetch("/api/v1/formadores/me", { headers: { accept: "application/json" } }),
      ]);
      const byId = new Map<string, FormadorOpt>();
      if (listRes.ok) {
        for (const f of (await listRes.json()) as FormadorOpt[]) byId.set(f.id, f);
      }
      if (meRes.ok) {
        const me = (await meRes.json()) as FormadorOpt;
        if (me?.id) byId.set(me.id, { id: me.id, nomeCompleto: me.nomeCompleto, email: me.email, ccpNumero: me.ccpNumero });
      }
      setFormadores([...byId.values()]);
    })();
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
    void loadSessoes(selectedCronogramaId, selectedTurmaId || undefined);
  }, [selectedCronogramaId, selectedTurmaId, loadSessoes]);

  useEffect(() => {
    void loadMatriculasTurma(selectedTurmaId);
  }, [selectedTurmaId, loadMatriculasTurma]);

  useEffect(() => {
    void loadFolhas(selectedSessaoId, selectedTurmaId || undefined);
  }, [selectedSessaoId, selectedTurmaId, loadFolhas]);

  useEffect(() => {
    setFolhaValidacaoErr(null);
    void loadFolhaDetalhe(selectedFolhaId);
  }, [selectedFolhaId, loadFolhaDetalhe]);

  const loadSumario = useCallback(
    async (sessaoId: string | null) => {
      if (!sessaoId || !canManageAssiduidade) {
        setSumario(null);
        setSumarioPdf(null);
        return;
      }
      const r = await bffFetch(
        `/api/v1/sumarios?sessaoId=${encodeURIComponent(sessaoId)}`,
        { headers: { accept: "application/json" } },
      );
      if (!r.ok) {
        setSumario(null);
        setSumarioPdf(null);
        return;
      }
      const list = (await r.json()) as SumarioRow[];
      const signed = list.find((s) => s.imutavel);
      const draft = list.find((s) => !s.imutavel);
      setSumario(signed ?? draft ?? null);
      setSumarioPdf(null);
    },
    [canManageAssiduidade],
  );

  useEffect(() => {
    void loadSumario(selectedSessaoId);
  }, [selectedSessaoId, loadSumario]);

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

  async function apagarCronograma() {
    if (!canApproveCronograma || !cronogramaAtivo || !acaoId) return;
    const nSessoes = cronogramaAtivo._count?.sessoes ?? sessoes.length;
    if (nSessoes > 0) {
      const ok = window.confirm(
        `Apagar o cronograma versão ${cronogramaAtivo.versao}?\n\n` +
          `Isto elimina permanentemente ${nSessoes} sessão(ões) e dados associados ` +
          `(folhas de presença, sumários, etc.).\n\n` +
          `Esta acção não pode ser anulada.`,
      );
      if (!ok) return;
    } else if (
      !window.confirm(`Apagar o cronograma versão ${cronogramaAtivo.versao} (sem sessões)?`)
    ) {
      return;
    }

    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch(`/api/v1/cronogramas/${cronogramaAtivo.id}`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        versao?: number;
        sessoesApagadas?: number;
      } | null;
      const apagadas = data?.sessoesApagadas ?? nSessoes;
      setMsg(
        apagadas > 0
          ? `Cronograma v${data?.versao ?? cronogramaAtivo.versao} apagado (${apagadas} sessão(ões)).`
          : `Cronograma v${data?.versao ?? cronogramaAtivo.versao} apagado.`,
      );
      setSelectedCronogramaId("");
      setSessoes([]);
      setSelectedSessaoId("");
      await loadCronogramas(acaoId);
    } finally {
      setBusy(false);
    }
  }

  async function submitSessao(e: FormEvent) {
    e.preventDefault();
    if (!selectedCronogramaId || !selectedTurmaId || !canManageAssiduidade) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await bffFetch("/api/v1/sessoes-formacao", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          cronogramaId: selectedCronogramaId,
          turmaId: selectedTurmaId,
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
      await loadSessoes(selectedCronogramaId, selectedTurmaId || undefined);
      if (created.id) setSelectedSessaoId(created.id);
    } finally {
      setBusy(false);
    }
  }

  async function updateSessao() {
    if (!selectedSessaoId || !canManageAssiduidade) return;
    const prevFormadorId = sessaoAtiva?.formador?.id ?? "";
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
      if ((editSessFormadorId || "") !== prevFormadorId) {
        markFormadorChanged();
      }
      setMsg("Sessão actualizada.");
      await loadSessoes(selectedCronogramaId, selectedTurmaId || undefined);
    } finally {
      setBusy(false);
    }
  }

  function markFormadorChanged() {
    if (!canManageAssiduidade || formadorOperacao) return;
    const cronogramaId = selectedCronogramaId;
    if (!cronogramaId) return;
    const toastId = `formador-atribuicao-${cronogramaId}`;
    pushStickyToast(
      "warning",
      "Pode enviar um email para o endereço de registo de cada formador atribuído nas sessões.",
      {
        id: toastId,
        title: "Enviar notificação de atribuição aos formadores?",
        actions: [
          {
            label: "Enviar email de atribuição",
            onClick: async () => {
              const res = await bffFetch("/api/v1/sessoes-formacao/notificar-atribuicao", {
                method: "POST",
                headers: { "Content-Type": "application/json", accept: "application/json" },
                body: JSON.stringify({ cronogramaId }),
              });
              if (!res.ok) {
                pushToast("error", await parseErr(res));
                return;
              }
              const data = (await res.json()) as { formadoresNotificados?: number };
              dismissToast(toastId);
              pushToast(
                "success",
                data.formadoresNotificados
                  ? `Notificação de atribuição enviada a ${data.formadoresNotificados} formador(es).`
                  : "Notificação de atribuição enviada.",
              );
            },
          },
          {
            label: "Agora não",
            variant: "ghost",
            onClick: () => dismissToast(toastId),
          },
        ],
      },
    );
  }

  async function atribuirFormadorTodas(formadorId: string) {
    if (!selectedCronogramaId || !selectedTurmaId || !canManageAssiduidade) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch("/api/v1/sessoes-formacao/atribuir-formador", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          cronogramaId: selectedCronogramaId,
          turmaId: selectedTurmaId,
          formadorId,
        }),
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const data = (await res.json()) as { actualizadas?: number; formadorNome?: string | null };
      markFormadorChanged();
      setAtribuirFormadorModalOpen(false);
      setEditSessFormadorId(formadorId);
      setMsg(
        data.formadorNome
          ? `${data.formadorNome} atribuído(a) a ${data.actualizadas ?? "todas as"} sessões da turma.`
          : "Formador atribuído a todas as sessões da turma.",
      );
      await loadSessoes(selectedCronogramaId, selectedTurmaId);
    } finally {
      setBusy(false);
    }
  }

  async function criarReuniao(provider: "ZOOM" | "TEAMS") {
    if (!selectedSessaoId || !canIniciarSessao || !canOperateSessaoAtiva) return;
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
      await loadSessoes(selectedCronogramaId, selectedTurmaId || undefined);
      const opened = openMeetingUrl(data.joinUrl);
      if (opened.blocked) {
        setMsg((m) => `${m ?? ""} Popup bloqueado - usa o link «Abrir sala» abaixo.`.trim());
      }
    } finally {
      setBusy(false);
    }
  }

  async function abrirSalaAtual() {
    if (!selectedSessaoId || !canIniciarSessao || !canOperateSessaoAtiva) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      // Entrar regista presença do formador e inicia/retoma o contador.
      const res = await bffFetch(
        `/api/v1/sessoes-formacao/${selectedSessaoId}/entrar-formador`,
        { method: "POST", headers: { accept: "application/json" } },
      );
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const data = (await res.json()) as {
        salaOnline?: { joinUrl?: string } | null;
      };
      await loadSessoes(selectedCronogramaId, selectedTurmaId || undefined);
      const joinUrl = data.salaOnline?.joinUrl ?? sessaoSala?.joinUrl;
      if (joinUrl) {
        const opened = openMeetingUrl(joinUrl);
        setMsg(
          opened.blocked
            ? "Entrada registada - popup bloqueado; usa o link da sala."
            : "Entrada registada - contador do formador activo.",
        );
      } else {
        setMsg("Entrada registada - contador do formador activo.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function iniciarEAbrirSala() {
    if (!selectedSessaoId || !canIniciarSessao || !canOperateSessaoAtiva || !sessaoAtiva) return;
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
            ? "Sessão já estava iniciada - contador do formador activo."
            : data.notificacoesEnviadas
              ? "Sessão iniciada - contador activo; formandos notificados."
              : "Sessão iniciada - contador do formador activo.",
        );
        await loadSessoes(selectedCronogramaId, selectedTurmaId || undefined);
        void onUpdated?.();
        notifyComplianceUpdated(acaoId);
        const joinUrl = data.salaOnline?.joinUrl ?? sala?.joinUrl;
        if (joinUrl) {
          const opened = openMeetingUrl(joinUrl);
          if (opened.blocked) {
            setMsg((m) => `${m ?? ""} Popup bloqueado - usa «Abrir sala» abaixo.`.trim());
          }
        }
        return;
      }

      await abrirSalaAtual();
    } finally {
      setBusy(false);
    }
  }

  async function terminarSessao() {
    if (!selectedSessaoId || !canIniciarSessao || !canOperateSessaoAtiva) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const result = await terminarSessaoFormacaoComConfirmacao(selectedSessaoId);
      if (!result.ok) {
        if (!result.cancelled) setErr(result.error);
        return;
      }
      const data = result.data;
      const syncMsg =
        (data.turmasSincronizadas ?? 0) > 0
          ? ` Folhas de ${data.turmasSincronizadas} turma(s) actualizadas com assiduidade LMS.`
          : "";
      const avisoMsg = data.avisoPedagogicoEnviado
        ? " O departamento pedagógico foi notificado das pendências (folha/sumário)."
        : "";
      setMsg(
        `Sessão terminada - ${data.presencasFechadas ?? 0} formando(s) tiveram a presença fechada automaticamente.${syncMsg}${avisoMsg}`,
      );
      await loadSessoes(selectedCronogramaId, selectedTurmaId || undefined);
      if (selectedTurmaId && sessaoAtiva?.lmsAtivo) {
        await importarLms();
      }
      void onUpdated?.();
      notifyComplianceUpdated(acaoId);
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
    if (!selectedSessaoId) return;
    if (!canOperateSessaoAtiva) {
      setErr(
        sessaoSemFormador
          ? "Atribua um formador a esta sessão antes de registar presenças."
          : "Só o gestor ou o formador atribuído a esta sessão podem registar presenças.",
      );
      return;
    }
    if (!sessaoAtiva?.iniciadaEm) {
      setErr("Inicia a sessão antes de abrir a folha de presença.");
      return;
    }
    // Sessão terminada: a folha continua acessível (marcar/validar/aprovar).
    // Só o QR em directo exige sessão ainda em curso.
    const turmaId = selectedTurmaId || turmas[0]?.id || "";
    if (!turmaId) {
      setErr("Cria uma turma com inscritos antes de registar presenças.");
      return;
    }
    if (turmaId !== selectedTurmaId) setSelectedTurmaId(turmaId);

    setBusy(true);
    setErr(null);
    setPanel("presencas");
    try {
      const qs = new URLSearchParams({
        sessaoId: selectedSessaoId,
        turmaId,
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
          if (
            canManageAssiduidade &&
            canOperateSessaoAtiva &&
            !sessaoAtiva.terminadaEm
          ) {
            setPresencaQrModalOpen(true);
          }
          return;
        }
      }

      const res = await bffFetch("/api/v1/folhas-presenca", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sessaoId: selectedSessaoId, turmaId }),
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      const created = (await res.json()) as { id: string };
      setSelectedFolhaId(created.id);
      await loadFolhas(selectedSessaoId, turmaId);
      await loadFolhaDetalhe(created.id);
      if (
        canManageAssiduidade &&
        canOperateSessaoAtiva &&
        !sessaoAtiva.terminadaEm
      ) {
        setPresencaQrModalOpen(true);
      }
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
      if (res.ok && selectedFolhaId) {
        setFolhaValidacaoErr(null);
        await loadFolhaDetalhe(selectedFolhaId);
        void onUpdated?.();
        notifyComplianceUpdated(acaoId);
      } else if (!res.ok) setErr(await parseErr(res));
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
      if (res.ok && selectedFolhaId) {
        await loadFolhaDetalhe(selectedFolhaId);
        void onUpdated?.();
        notifyComplianceUpdated(acaoId);
      } else if (!res.ok) setErr(await parseErr(res));
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

  function abrirModalValidacaoFolha() {
    if (!selectedFolhaId || !canManageAssiduidade || !folhaDetalhe) return;

    const incompletos = folhaDetalhe.presencas.filter((p) => {
      const edit = presencaEdits[p.id];
      const estadoUi =
        edit && edit.estado !== ""
          ? edit.estado
          : isEstadoPresenca(p.estado)
            ? p.estado
            : "";
      if (!isEstadoPresenca(estadoUi)) return true;
      if (estadoUi === "FALTA_JUSTIFICADA") {
        const motivo = (edit?.motivo ?? p.motivoJustificacao ?? "").trim();
        return !motivo;
      }
      return false;
    });
    if (incompletos.length > 0) {
      setFolhaValidacaoErr(
        "Todos os formandos devem ter presença, falta justificada (com motivo) ou falta injustificada assinalada antes de validar a folha.",
      );
      return;
    }
    setFolhaValidacaoErr(null);
    setFolhaValidacaoModalOpen(true);
  }

  async function confirmarValidacaoFolha(payload: FolhaAprovacaoConfirm) {
    if (!selectedFolhaId || !canManageAssiduidade) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/folhas-presenca/${selectedFolhaId}/validar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ nomeAssinatura: payload.nomeAssinatura }),
      });
      if (!res.ok) {
        setFolhaValidacaoErr(await parseErr(res));
        return;
      }
      setFolhaValidacaoModalOpen(false);
      setFolhaValidacaoErr(null);
      setMsg(
        "Folha validada e assinada. Aguarda aprovação do gestor ou coordenador pedagógico.",
      );
      await loadFolhaDetalhe(selectedFolhaId);
      await loadFolhas(selectedSessaoId, selectedTurmaId);
      void onUpdated?.();
      notifyComplianceUpdated(acaoId);
    } finally {
      setBusy(false);
    }
  }

  async function confirmarAprovacaoFolha(payload: FolhaAprovacaoConfirm) {
    if (!selectedFolhaId || !canApprovePresencasFolha) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/folhas-presenca/${selectedFolhaId}/aprovar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ nomeAssinatura: payload.nomeAssinatura }),
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      setFolhaAprovacaoModalOpen(false);
      setMsg("Folha de presenças aprovada e assinada pelo gestor.");
      await loadFolhaDetalhe(selectedFolhaId);
      await loadFolhas(selectedSessaoId, selectedTurmaId);
      void onUpdated?.();
      notifyComplianceUpdated(acaoId);
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
      void onUpdated?.();
      notifyComplianceUpdated(acaoId);
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

  async function confirmarSumarioAssinatura(payload: SumarioAssinaturaConfirm) {
    if (!selectedSessaoId || !canManageAssiduidade) return;
    if (!canOperateSessaoAtiva) {
      setErr("Só o formador desta sessão (ou o gestor) pode registar o sumário.");
      return;
    }
    if (!sessaoAtiva?.terminadaEm) {
      setErr("O sumário só pode ser registado depois de a sessão ser terminada.");
      return;
    }
    if (sumario?.imutavel) {
      setErr("Sumário já assinado - não editável.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      let sumarioId = sumario?.id ?? null;
      const saveRes = sumarioId
        ? await bffFetch(`/api/v1/sumarios/${sumarioId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({ conteudo: payload.conteudo }),
          })
        : await bffFetch(`/api/v1/sumarios/sessao/${selectedSessaoId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({ conteudo: payload.conteudo }),
          });
      if (!saveRes.ok) {
        setErr(await parseErr(saveRes));
        return;
      }
      if (!sumarioId) {
        const created = (await saveRes.json()) as { id: string };
        sumarioId = created.id;
      }
      const signRes = await bffFetch(`/api/v1/sumarios/${sumarioId}/assinar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ nomeAssinatura: payload.nomeAssinatura }),
      });
      if (!signRes.ok) {
        setErr(await parseErr(signRes));
        await loadSumario(selectedSessaoId);
        return;
      }
      setSumarioModalOpen(false);
      setMsg("Sumário registado e assinado.");
      await loadSumario(selectedSessaoId);
      void onUpdated?.();
      notifyComplianceUpdated(acaoId);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPdfSumarioSessao() {
    if (!sumario?.id || sumario.imutavel || !sumarioPdf) return;
    if (!canOperateSessaoAtiva) {
      setErr("Só o formador desta sessão (ou o gestor) pode carregar o PDF do sumário.");
      return;
    }
    if (!sessaoAtiva?.terminadaEm) {
      setErr("O sumário só pode ser registado depois de a sessão ser terminada.");
      return;
    }
    if (
      sumarioPdf.type !== "application/pdf" &&
      !sumarioPdf.name.toLowerCase().endsWith(".pdf")
    ) {
      setErr("Apenas ficheiros PDF (.pdf) são aceites.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", sumarioPdf);
      const res = await bffFetch(`/api/v1/sumarios/${sumario.id}/upload-pdf-assinado`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      setMsg("PDF assinado carregado. Sumário fechado.");
      await loadSumario(selectedSessaoId);
      void onUpdated?.();
      notifyComplianceUpdated(acaoId);
    } finally {
      setBusy(false);
    }
  }

  async function descarregarPdfSumario() {
    if (!sumario?.id || !sumario.pdfStorageKey) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/sumarios/${sumario.id}/pdf`, {
        headers: { accept: "application/pdf" },
      });
      if (!res.ok) {
        setErr(await parseErr(res));
        return;
      }
      await downloadResponseAsFile(
        res,
        sumario.pdfNomeFicheiro ?? `sumario-sessao.pdf`,
      );
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

      {/* Passos do fluxo (gestor) */}
      {!formadorOperacao ? (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { n: 1, label: "Cronograma", icon: Layers, done: !!selectedCronogramaId },
          { n: 2, label: "Sessões", icon: Calendar, done: sessoes.length > 0 },
          { n: 3, label: "Folha", icon: ClipboardList, done: folhas.length > 0 },
          { n: 4, label: "Presenças", icon: CheckCircle2, done: !!folhaDetalhe?.aprovadaGestorEm || !!folhaDetalhe?.fechadaEm },
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
      ) : null}

      {msg ? <Alert variant="success">{msg}</Alert> : null}
      {err ? <Alert variant="error">{err}</Alert> : null}

      {!formadorOperacao && rascunhoImportJob ? (
        <div className="cronograma-ia-chip-ready flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-emerald-200">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              Rascunho IA pronto{rascunhoImportJob.nomeFicheiro ? ` (${rascunhoImportJob.nomeFicheiro})` : ""} -
              reveja e aplique as sessões propostas.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  setErr(null);
                  try {
                    const res = await bffFetch(
                      `/api/v1/cronogramas/importar-ia/jobs/${rascunhoImportJob.id}/descartar`,
                      { method: "POST", headers: { accept: "application/json" } },
                    );
                    if (!res.ok) {
                      setErr("Não foi possível descartar o rascunho.");
                      return;
                    }
                    setMsg("Rascunho IA descartado.");
                    await loadImportJobs(selectedCronogramaId);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setInitialImportJobId(rascunhoImportJob.id);
                setShowImportIa(true);
              }}
            >
              Ver rascunho
            </Button>
          </div>
        </div>
      ) : !formadorOperacao && processandoImportJob ? (
        <div className="cronograma-ia-chip-processing flex items-center gap-2 rounded-xl border border-violet-500/40 px-4 py-3 text-sm text-violet-200">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>
            A IA está a analisar
            {processandoImportJob.nomeFicheiro ? ` «${processandoImportJob.nomeFicheiro}»` : " o cronograma"} em
            background…
          </span>
        </div>
      ) : null}

      {/* KPIs */}
      {!formadorOperacao ? (
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
      ) : null}

      {/* Cronograma toolbar */}
      {!formadorOperacao ? (
      <Card
        data-dgert-target="cronograma_panel"
        className={cn(
          "border-slate-700/30 bg-slate-900/40",
          (dgertTarget === "cronograma_panel" || dgertRequisito === "cronograma") &&
            "ring-2 ring-amber-400/55 ring-offset-2 ring-offset-slate-950",
        )}
      >
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
              className={cn(
                dgertRequisito === "cronograma" &&
                  "ring-2 ring-amber-400/70 shadow-[0_0_0_3px_rgba(251,191,36,0.15)]",
              )}
            >
              <Plus className="h-4 w-4" />
              {cronogramas.length ? "Nova versão" : "Criar cronograma"}
            </Button>
          ) : null}
          {canManageAssiduidade &&
          !formadorOperacao &&
          cronogramaAtivo &&
          !cronogramaAtivo.aprovadoEm ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => setShowImportIa(true)}
              title="Importar sessões a partir de um cronograma existente (IA)"
            >
              <Sparkles className="h-4 w-4" />
              Importar com IA
            </Button>
          ) : null}
          {canApproveCronograma && cronogramaAtivo && !cronogramaAtivo.aprovadoEm ? (
            <span data-dgert-target="cronograma_aprovar">
              <Button
                type="button"
                size="sm"
                disabled={busy || sessoes.length === 0}
                onClick={() => void aprovarCronograma()}
                title={sessoes.length === 0 ? "Adiciona pelo menos uma sessão antes de aprovar" : undefined}
                className={cn(
                  (dgertTarget === "cronograma_aprovar" || dgertRequisito === "cronograma_aprovado") &&
                    "ring-2 ring-amber-400/70 shadow-[0_0_0_3px_rgba(251,191,36,0.15)]",
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                Aprovar cronograma
              </Button>
            </span>
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
              {canApproveCronograma ? (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => void apagarCronograma()}
                  title="Apagar esta versão do cronograma"
                >
                  <Trash2 className="h-4 w-4" />
                  Apagar
                </Button>
              ) : null}
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
      ) : null}

      {!formadorOperacao && arquivosCronograma.length > 0 ? (
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
            <p className="text-slate-400 text-sm">
              {formadorOperacao
                ? "Ainda não há cronograma nesta acção. O gestor deve criar e planear as sessões."
                : "Cria um cronograma para começar a planear sessões."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabs + turma: fit-content (não estica a largura da view) */}
          <div className="flex w-fit max-w-full flex-wrap items-center gap-3">
            {!formadorOperacao ? (
              <div className="inline-flex w-fit rounded-xl border border-slate-700/40 bg-slate-900/50 p-1">
                <button
                  type="button"
                  onClick={() => setPanel("sessoes")}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    panel === "sessoes"
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  Sessões
                </button>
                <button
                  type="button"
                  onClick={() => setPanel("presencas")}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    panel === "presencas"
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  Presenças
                </button>
              </div>
            ) : null}
            {turmas.length > 0 ? (
              <div
                className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-slate-700/40 bg-slate-900/50 p-1"
                role="group"
                aria-label="Turma"
              >
                {turmas.map((t) => {
                  const active = t.id === selectedTurmaId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTurmaId(t.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-teal-700/80 text-teal-50"
                          : "text-slate-500 hover:text-slate-300",
                      )}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {t.codigo}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
            {/* Coluna principal */}
            <div className="min-w-0 space-y-4">
              {panel === "sessoes" || formadorOperacao ? (
                <div
                  data-dgert-target="cronograma_sessoes"
                  className={cn(
                    "space-y-4",
                    dgertTarget === "cronograma_sessoes" &&
                      "rounded-xl ring-2 ring-amber-400/55 ring-offset-2 ring-offset-slate-950 p-3 -m-1",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-300">
                        Sessões ({sessoes.length})
                        {turmaAtiva ? (
                          <span className="ml-1.5 font-normal text-slate-500">
                            · {turmaAtiva.codigo}
                          </span>
                        ) : null}
                      </h3>
                      {sessoesSemFormador > 0 ? (
                        <Badge variant="red">{sessoesSemFormador} sem formador</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManageAssiduidade && !formadorOperacao && sessoes.length > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy || formadores.length === 0 || !selectedTurmaId}
                          onClick={() => setAtribuirFormadorModalOpen(true)}
                          className="bg-violet-600/90 text-white hover:bg-violet-500 border-0"
                        >
                          <UserPlus className="h-4 w-4" />
                          Atribuir formador para todas as sessões da turma
                        </Button>
                      ) : null}
                      {canManageAssiduidade && !formadorOperacao ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy || !selectedTurmaId}
                          onClick={() => setShowNovaSessao((v) => !v)}
                          className={cn(
                            (dgertRequisito === "sessoes_planeadas" || dgertRequisito === "formadores") &&
                              "ring-2 ring-amber-400/70",
                          )}
                        >
                          <Plus className="h-4 w-4" />
                          Nova sessão
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {sessoes.length === 0 ? (
                    <Card className="border-dashed border-slate-700/40">
                      <CardContent className="py-10 text-center text-sm text-slate-500 space-y-3">
                        <p>
                          {formadorOperacao
                            ? "Ainda não há sessões nesta acção. O gestor deve planear o cronograma."
                            : "Sem sessões planeadas. Adiciona a primeira sessão ao cronograma."}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {sessoes.map((s) => {
                        const active = selectedSessaoId === s.id;
                        const lockedForFormador = Boolean(
                          formadorProfileId &&
                            !canApproveCronograma &&
                            s.formador?.id &&
                            s.formador.id !== formadorProfileId,
                        );
                        const ModIcon =
                          MODALIDADES.find((m) => m.value === s.modalidade)?.icon ?? MapPin;
                        const showMarcarPresencas =
                          active &&
                          s.estado === "REALIZADA" &&
                          canOperateSessaoAtiva &&
                          Boolean(s.iniciadaEm) &&
                          !folhaTurmaFechada;
                        return (
                          <div
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedSessaoId(s.id);
                              setShowNovaSessao(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedSessaoId(s.id);
                                setShowNovaSessao(false);
                              }
                            }}
                            className={`w-full text-left rounded-xl border p-4 transition-all cursor-pointer ${
                              active
                                ? lockedForFormador
                                  ? "border-amber-500/35 bg-amber-950/20 ring-1 ring-amber-500/20"
                                  : "border-blue-500/40 bg-blue-500/10 ring-1 ring-blue-500/20"
                                : lockedForFormador
                                  ? "border-slate-700/30 bg-slate-950/50 opacity-75 hover:border-amber-500/25"
                                  : "border-slate-700/30 bg-slate-900/40 hover:border-slate-600/50"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex items-start gap-3 min-w-0">
                                <span
                                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                                    lockedForFormador
                                      ? "bg-amber-950/50 text-amber-200/90"
                                      : "bg-slate-800 text-slate-200"
                                  }`}
                                  title={
                                    lockedForFormador
                                      ? "Sessão de outro formador - só consulta"
                                      : undefined
                                  }
                                >
                                  S{s.numeroSessao}
                                  {lockedForFormador ? (
                                    <Lock
                                      className="absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full bg-slate-950 p-0.5 text-amber-300"
                                      aria-hidden
                                    />
                                  ) : null}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-100 truncate">
                                    {tituloSessao(s)}
                                  </p>
                                  <p className="text-xs text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3 shrink-0" />
                                      {formatDataPt(s.data)}
                                    </span>
                                    <span className="text-slate-600">·</span>
                                    <span>
                                      {s.horaInicio} – {s.horaFim}
                                    </span>
                                    {s.moduloUnidade?.codigo ? (
                                      <>
                                        <span className="text-slate-600">·</span>
                                        <span className="text-slate-500">{s.moduloUnidade.codigo}</span>
                                      </>
                                    ) : null}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                    <Badge variant="default" className="gap-1">
                                      <ModIcon className="h-3 w-3" />
                                      {s.modalidade}
                                    </Badge>
                                    {sessaoEstadoBadge(s.estado)}
                                    {s.iniciadaEm && !s.terminadaEm ? (
                                      <Badge variant="green">Iniciada</Badge>
                                    ) : null}
                                    {s.terminadaEm ? <Badge variant="default">Terminada</Badge> : null}
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
                                    {s.formador ? (
                                      <Badge variant="purple" className="gap-1">
                                        <GraduationCap className="h-3 w-3" />
                                        {formadorNomeBadge(
                                          s.formador.nomeCompleto,
                                          formadorNomesNaAcao,
                                        )}
                                      </Badge>
                                    ) : canManageAssiduidade && !formadorOperacao ? (
                                      <Badge variant="red" className="gap-1">
                                        <GraduationCap className="h-3 w-3" />
                                        Sem formador
                                      </Badge>
                                    ) : null}
                                    {lockedForFormador ? (
                                      <Badge variant="yellow" className="gap-1">
                                        <Lock className="h-3 w-3" />
                                        Outro formador
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right text-[11px] text-slate-500 shrink-0">
                                <p className="flex items-center gap-1 justify-end">
                                  <ClipboardList className="h-3 w-3" />
                                  {s._count?.folhasPresenca ?? 0} folha(s)
                                </p>
                              </div>
                            </div>
                            {showMarcarPresencas ? (
                              <div className="mt-3 pt-3 border-t border-slate-700/40">
                                {(() => {
                                  const folhaSessaoAguardaAprovacao = folhas.some(
                                    (f) =>
                                      f.sessaoId === s.id &&
                                      f.validadaFormadorEm &&
                                      !f.aprovadaGestorEm,
                                  );
                                  const isAprovar =
                                    canApprovePresencasFolha && folhaSessaoAguardaAprovacao;
                                  return (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={isAprovar ? "secondary" : "teal"}
                                      className={cn(
                                        "w-full sm:w-auto",
                                        isAprovar &&
                                          "border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30",
                                      )}
                                      disabled={busy}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void (async () => {
                                          await abrirFolha();
                                          requestAnimationFrame(() => {
                                            presencasWorkspaceRef.current?.scrollIntoView({
                                              behavior: "smooth",
                                              block: "start",
                                            });
                                          });
                                        })();
                                      }}
                                    >
                                      {isAprovar ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                      ) : (
                                        <ClipboardList className="h-4 w-4" />
                                      )}
                                      {isAprovar ? "Aprovar Presenças" : "Marcar Presenças"}
                                    </Button>
                                  );
                                })()}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showNovaSessao && canManageAssiduidade && !formadorOperacao ? (
                    <Card className="border-blue-500/20 bg-blue-500/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-slate-200">
                          Registar nova sessão
                          {turmaAtiva ? (
                            <span className="block text-xs font-normal text-slate-400 mt-1">
                              Turma seleccionada: {turmaAtiva.codigo} - {turmaAtiva.nome}
                              (a folha de presença será desta turma)
                            </span>
                          ) : null}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
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
                </div>
              ) : null}

              {showPresencasWorkspace ? (
                <div
                  ref={presencasWorkspaceRef}
                  data-dgert-target="cronograma_presencas"
                  className={cn(
                    "space-y-4",
                    (highlightFolha || dgertTarget === "cronograma_presencas") &&
                      "rounded-xl ring-2 ring-amber-400/55 ring-offset-2 ring-offset-slate-950 p-3 -m-1",
                  )}
                >
                  {formadorOperacao ? (
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 pt-2 border-t border-slate-700/40">
                      <ClipboardList className="h-4 w-4 text-teal-400" />
                      Folha de presença
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
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">Turma</p>
                            <div className="flex flex-wrap gap-2">
                              {turmas.map((t) => {
                                const n = t._count?.matriculas ?? 0;
                                const active = t.id === selectedTurmaId;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setSelectedTurmaId(t.id)}
                                    className={cn(
                                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                      active
                                        ? "border-teal-500/50 bg-teal-950/40 text-teal-100"
                                        : "border-slate-700/50 bg-slate-900/40 text-slate-300 hover:border-slate-600",
                                    )}
                                  >
                                    <span className="font-medium">{t.codigo}</span>
                                    <span className="text-slate-500"> · {t.nome}</span>
                                    <span
                                      className={cn(
                                        "ml-2 text-xs tabular-nums",
                                        active ? "text-teal-300/80" : "text-slate-500",
                                      )}
                                    >
                                      {n} inscrito{n === 1 ? "" : "s"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {turmaAtiva ? (
                            <div className="rounded-lg border border-slate-700/40 bg-slate-950/40 p-3">
                              <p className="text-xs font-medium text-slate-400 mb-2">
                                Inscritos nesta turma ({inscritosTurmaCount})
                              </p>
                              {matriculasTurma.length === 0 ? (
                                <p className="text-sm text-amber-400/90">
                                  {inscritosTurmaCount > 0
                                    ? "Não foi possível carregar a lista de inscritos. Actualiza a página."
                                    : "Sem formandos inscritos - inscreve-os em Turmas antes de marcar presenças."}
                                </p>
                              ) : (
                                <ul className="max-h-36 overflow-y-auto space-y-1 text-sm">
                                  {matriculasTurma.map((m) => (
                                    <li
                                      key={m.id}
                                      className="flex items-center justify-between gap-2 text-slate-300"
                                    >
                                      <span className="truncate">{m.formando.nome}</span>
                                      <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                                        NIF: {m.formando.nif}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {sessaoAtiva && !canOperateSessaoAtiva ? (
                                <p className="mt-2 text-[11px] text-amber-200/90 leading-snug">
                                  Consulta permitida. A gestão de presenças desta sessão é só do
                                  formador atribuído
                                  {sessaoAtiva.formador?.nomeCompleto
                                    ? ` (${sessaoAtiva.formador.nomeCompleto})`
                                    : ""}
                                  {" "}
                                  ou do gestor.
                                </p>
                              ) : folhaSeleccionada ? (
                                <p className="mt-2 text-[11px] text-slate-500">
                                  Folha{" "}
                                  {folhaSeleccionada.aprovadaGestorEm
                                    ? "aprovada"
                                    : folhaSeleccionada.validadaFormadorEm
                                      ? "validada (aguarda aprovação)"
                                      : "em edição (aberta)"}
                                  {folhaSeleccionada._count?.presencas != null
                                    ? ` · ${folhaSeleccionada._count.presencas} na folha`
                                    : null}
                                </p>
                              ) : selectedSessaoId && selectedTurmaId ? (
                                <p className="mt-2 text-[11px] text-slate-500">
                                  Ainda sem folha para esta sessão.
                                </p>
                              ) : null}
                            </div>
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

                      <div className="flex flex-wrap gap-2">
                        {canIniciarSessao &&
                        canOperateSessaoAtiva &&
                        sessaoAtiva &&
                        !sessaoAtiva.iniciadaEm &&
                        !sessaoAtiva.terminadaEm ? (
                          <Button
                            type="button"
                            disabled={busy || sessaoAtiva.estado === "CANCELADA"}
                            onClick={() => void iniciarEAbrirSala()}
                          >
                            <Video className="h-4 w-4" />
                            Iniciar sessão
                          </Button>
                        ) : null}
                        {canOperateSessaoAtiva && !folhaTurmaFechada ? (
                          <Button
                            type="button"
                            disabled={
                              busy ||
                              !selectedSessaoId ||
                              !sessaoAtiva?.iniciadaEm ||
                              turmas.length === 0
                            }
                            onClick={() => void abrirFolha()}
                            title={
                              !sessaoAtiva?.iniciadaEm
                                ? "Primeiro inicia a sessão"
                                : undefined
                            }
                          >
                            {canManageAssiduidade && !sessaoAtiva?.terminadaEm ? (
                              <QrCode className="h-4 w-4" />
                            ) : (
                              <ClipboardList className="h-4 w-4" />
                            )}
                            Presenças
                          </Button>
                        ) : canOperateSessaoAtiva && folhaTurmaFechada ? null : sessaoAtiva ? (
                          <p className="text-xs text-slate-500 self-center">
                            Botão Presenças indisponível nesta sessão (não és o formador atribuído).
                          </p>
                        ) : null}
                        {sessaoAtiva?.lmsAtivo && canManageAssiduidade && !formadorOperacao ? (
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
                            <CheckCircle2 className="h-3 w-3" /> Aprovada / fechada
                          </Badge>
                        ) : folhaDetalhe.validadaFormadorEm ? (
                          <Badge variant="yellow" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Validada - aguarda aprovação
                          </Badge>
                        ) : (
                          <Badge variant="default">Em edição (aberta)</Badge>
                        )}
                      </CardHeader>
                      <CardContent>
                        {(folhaDetalhe.validadaPor || (canApprovePresencasFolha && folhaDetalhe.aprovadaPor)) ? (
                          <div className="mb-4 rounded-lg border border-slate-700/50 bg-slate-950/40 px-3 py-2.5 space-y-1.5 text-xs text-slate-300">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Assinaturas
                            </p>
                            {folhaDetalhe.validadaPor ? (
                              <p>
                                <span className="text-slate-500">Validada por </span>
                                <span className="font-medium text-slate-100">
                                  {folhaDetalhe.validadaPor.assinaturaNome ||
                                    folhaDetalhe.validadaPor.nome}
                                </span>
                                <span className="text-slate-500">
                                  {" "}
                                  ({folhaDetalhe.validadaPor.roleLabel})
                                  {folhaDetalhe.validadaPor.em
                                    ? ` · ${new Date(folhaDetalhe.validadaPor.em).toLocaleString("pt-PT")}`
                                    : ""}
                                </span>
                              </p>
                            ) : null}
                            {canApprovePresencasFolha && folhaDetalhe.aprovadaPor ? (
                              <p>
                                <span className="text-slate-500">Aprovada por </span>
                                <span className="font-medium text-slate-100">
                                  {folhaDetalhe.aprovadaPor.assinaturaNome ||
                                    folhaDetalhe.aprovadaPor.nome}
                                </span>
                                <span className="text-slate-500">
                                  {" "}
                                  ({folhaDetalhe.aprovadaPor.roleLabel})
                                  {folhaDetalhe.aprovadaPor.em
                                    ? ` · ${new Date(folhaDetalhe.aprovadaPor.em).toLocaleString("pt-PT")}`
                                    : ""}
                                </span>
                              </p>
                            ) : folhaDetalhe.validadaFormadorEm && canApprovePresencasFolha ? (
                              <p className="text-amber-200/90">
                                Aguarda aprovação do gestor ou coordenador pedagógico.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="overflow-x-auto -mx-1">
                          <table className="w-full text-sm min-w-[480px]">
                            <thead>
                              <tr className="border-b border-slate-700/40 text-left text-xs text-slate-500 uppercase tracking-wider">
                                <th className="py-2 px-2">Formando</th>
                                <th className="py-2 px-2 hidden sm:table-cell">NIF</th>
                                <th className="py-2 px-2 hidden md:table-cell">Min LMS</th>
                                <th className="py-2 px-2">Assiduidade</th>
                                <th className="py-2 px-2 hidden lg:table-cell">Marcação</th>
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
                                    NIF: {p.matricula.formando.nif}
                                  </td>
                                  <td className="py-2.5 px-2 text-slate-400 hidden md:table-cell tabular-nums text-xs">
                                    {p.minutosEfetivos != null ? `${p.minutosEfetivos} min` : "-"}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <div className="flex flex-col gap-1.5">
                                      {canManageAssiduidade && canOperateSessaoAtiva ? (
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
                                      {(isEstadoPresenca(edit.estado) ||
                                        isEstadoPresenca(p.estado) ||
                                        p.presente) && (
                                        <Badge
                                          variant={origemPresencaBadgeVariant(p.origem)}
                                          className="w-fit gap-1 lg:hidden"
                                        >
                                          {labelOrigemPresenca(p.origem, {
                                            online: Boolean(
                                              sessaoAtiva &&
                                                isModalidadeOnline(sessaoAtiva.modalidade),
                                            ),
                                          })}
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2 hidden lg:table-cell">
                                    {isEstadoPresenca(edit.estado) ||
                                    isEstadoPresenca(p.estado) ||
                                    p.presente ? (
                                      <Badge
                                        variant={origemPresencaBadgeVariant(p.origem)}
                                        className="gap-1"
                                      >
                                        {labelOrigemPresenca(p.origem, {
                                          online: Boolean(
                                            sessaoAtiva && isModalidadeOnline(sessaoAtiva.modalidade),
                                          ),
                                        })}
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-600 text-xs">-</span>
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

                        {folhaValidacaoErr ? (
                          <Alert variant="error" className="mt-4">
                            {folhaValidacaoErr}
                          </Alert>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {canManageAssiduidade &&
                          canOperateSessaoAtiva &&
                          !folhaDetalhe.validadaFormadorEm ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={() => abrirModalValidacaoFolha()}
                              className={cn(
                                highlightFolha &&
                                  "ring-2 ring-amber-400/70 shadow-[0_0_0_3px_rgba(251,191,36,0.15)]",
                              )}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Validar e assinar
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
                              onClick={() => setFolhaAprovacaoModalOpen(true)}
                            >
                              <Lock className="h-4 w-4" />
                              Aprovar e assinar
                            </Button>
                          ) : null}
                        </div>
                        {folhaDetalhe.validadaFormadorEm && !folhaDetalhe.aprovadaGestorEm && canManageAssiduidade ? (
                          <p className="text-xs text-slate-500 mt-3">
                            A folha está validada mas permanece aberta até o gestor ou coordenador
                            pedagógico aprovar. Alterações reabrem-na para nova validação.
                          </p>
                        ) : null}
                        {folhaDetalhe.aprovadaGestorEm && canManageAssiduidade ? (
                          <p className="text-xs text-slate-500 mt-3">
                            Folha aprovada e fechada. Alterações reabrem-na para nova validação e aprovação.
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Painel lateral - iniciar sessão / editar (gestor) */}
            <aside className="min-w-0">
              {(panel === "sessoes" || panel === "presencas" || formadorOperacao) &&
              sessaoAtiva &&
              canManageAssiduidade ? (
                <Card className={`border-slate-700/30 sticky top-4 ${asideOperacional ? "border-blue-500/30 ring-1 ring-blue-500/15" : ""}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {asideOperacional
                        ? tituloSessao(sessaoAtiva)
                        : `Editar sessão ${sessaoAtiva.numeroSessao}`}
                    </CardTitle>
                    {asideOperacional ? (
                      <p className="text-xs text-slate-500 mt-1">
                        S{sessaoAtiva.numeroSessao} · {formatDataPt(sessaoAtiva.data)} ·{" "}
                        {sessaoAtiva.horaInicio}–{sessaoAtiva.horaFim}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {asideOperacional ? (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {sessaoEstadoBadge(sessaoAtiva.estado)}
                          <Badge variant="default" className="gap-1">
                            <MapPin className="h-3 w-3" />
                            {sessaoAtiva.modalidade}
                          </Badge>
                          {sessaoAtiva.terminadaEm ? (
                            <Badge variant="default">Terminada</Badge>
                          ) : sessaoAtiva.iniciadaEm ? (
                            <Badge variant="green">Em curso</Badge>
                          ) : (
                            <Badge variant="yellow">Por iniciar</Badge>
                          )}
                        </div>
                        <FormadorSessaoPicker
                          formadores={formadoresPicker}
                          value={editSessFormadorId}
                          fallbackLabel={sessaoAtiva.formador?.nomeCompleto ?? null}
                          disabled={busy || !canApproveCronograma}
                          onChange={(id) => {
                            if (!canApproveCronograma) return;
                            setEditSessFormadorId(id ?? "");
                            void (async () => {
                              if (!selectedSessaoId) return;
                              setBusy(true);
                              setErr(null);
                              try {
                                const res = await bffFetch(
                                  `/api/v1/sessoes-formacao/${selectedSessaoId}`,
                                  {
                                    method: "PATCH",
                                    headers: {
                                      "Content-Type": "application/json",
                                      accept: "application/json",
                                    },
                                    body: JSON.stringify({ formadorId: id }),
                                  },
                                );
                                if (!res.ok) {
                                  setErr(await parseErr(res));
                                  return;
                                }
                                markFormadorChanged();
                                await loadSessoes(selectedCronogramaId, selectedTurmaId || undefined);
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        />
                        {canApproveCronograma && podeAtribuirEsteATodas ? (
                          <button
                            type="button"
                            disabled={busy || !editSessFormadorId}
                            onClick={() => void atribuirFormadorTodas(editSessFormadorId)}
                            className="text-xs text-slate-400 hover:text-violet-300 disabled:opacity-40 inline-flex items-center gap-1"
                          >
                            Atribuir este formador para todas as sessões da turma
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
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
                    <FormadorSessaoPicker
                      formadores={formadoresPicker}
                      value={editSessFormadorId}
                      fallbackLabel={sessaoAtiva.formador?.nomeCompleto ?? null}
                      disabled={busy}
                      onChange={(id) => setEditSessFormadorId(id ?? "")}
                    />
                    {podeAtribuirEsteATodas ? (
                      <button
                        type="button"
                        disabled={busy || !editSessFormadorId}
                        onClick={() => void atribuirFormadorTodas(editSessFormadorId)}
                        className="text-xs text-slate-400 hover:text-violet-300 disabled:opacity-40 inline-flex items-center gap-1"
                      >
                        Atribuir este formador para todas as sessões da turma
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
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
                      </>
                    )}
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
                    {canIniciarSessao &&
                    canOperateSessaoAtiva &&
                    !sessaoAtiva?.iniciadaEm &&
                    !formadorOperacao ? (
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {sessaoOnlineLms
                          ? "Inicia aqui - a sala abre automaticamente e os formandos são notificados."
                          : "Inicia a sessão para notificar os formandos (presencial)."}
                      </p>
                    ) : null}
                    {sessaoAtiva && canIniciarSessao && !canOperateSessaoAtiva ? (
                      <p className="text-[11px] text-amber-200/90 leading-snug">
                        {sessaoSemFormador
                          ? "Sem formador atribuído - atribua um formador para poder iniciar a sessão, presenças e QR."
                          : "Operação reservada ao formador desta sessão ou ao gestor da entidade."}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-2">
                      {canIniciarSessao &&
                      canOperateSessaoAtiva &&
                      !sessaoAtiva?.iniciadaEm &&
                      !sessaoAtiva?.terminadaEm ? (
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
                      {canManageAssiduidade &&
                      canOperateSessaoAtiva &&
                      sessaoAtiva?.iniciadaEm &&
                      !folhaTurmaFechada ? (
                        (() => {
                          const folhaAtivaAguardaAprovacao =
                            folhas.some(
                              (f) =>
                                f.sessaoId === sessaoAtiva.id &&
                                f.validadaFormadorEm &&
                                !f.aprovadaGestorEm,
                            ) ||
                            Boolean(
                              folhaDetalhe?.validadaFormadorEm &&
                                !folhaDetalhe?.aprovadaGestorEm,
                            );
                          const isAprovar =
                            canApprovePresencasFolha && folhaAtivaAguardaAprovacao;
                          return (
                            <Button
                              type="button"
                              className={cn(
                                "w-full",
                                isAprovar &&
                                  "border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30",
                              )}
                              variant={isAprovar ? "secondary" : "default"}
                              disabled={busy}
                              onClick={() => {
                                void (async () => {
                                  await abrirFolha();
                                  requestAnimationFrame(() => {
                                    presencasWorkspaceRef.current?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                  });
                                })();
                              }}
                            >
                              {isAprovar ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : sessaoAtiva.terminadaEm || sessaoAtiva.estado === "REALIZADA" ? (
                                <ClipboardList className="h-4 w-4" />
                              ) : (
                                <QrCode className="h-4 w-4" />
                              )}
                              {isAprovar
                                ? "Aprovar Presenças"
                                : sessaoAtiva.terminadaEm || sessaoAtiva.estado === "REALIZADA"
                                  ? "Marcar Presenças"
                                  : "Presenças"}
                            </Button>
                          );
                        })()
                      ) : null}
                      {canIniciarSessao &&
                      canOperateSessaoAtiva &&
                      sessaoAtiva?.iniciadaEm &&
                      !sessaoAtiva?.terminadaEm &&
                      sessaoSala ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full"
                          disabled={busy}
                          onClick={() => void abrirSalaAtual()}
                        >
                          <Video className="h-4 w-4" />
                          Entrar na sala {sessaoSala.provider}
                        </Button>
                      ) : null}
                      {canIniciarSessao &&
                      canOperateSessaoAtiva &&
                      sessaoAtiva?.iniciadaEm &&
                      !sessaoAtiva?.terminadaEm &&
                      sessaoAtiva?.estado !== "CANCELADA" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full"
                          disabled={busy}
                          onClick={() => void terminarSessao()}
                        >
                          Terminar sessão (para todos os contadores)
                        </Button>
                      ) : null}
                    </div>
                    {sessaoAtiva?.terminadaEm ? (
                      <div className="space-y-1 text-[11px] text-slate-400">
                        <p>
                          Terminada em{" "}
                          {new Date(sessaoAtiva.terminadaEm).toLocaleString("pt-PT")}
                        </p>
                        {sessaoAtiva.formadorDuracaoSegundos != null ? (
                          <p>
                            Tempo formador:{" "}
                            <span className="font-mono text-slate-200">
                              {formatarDuracaoHhMmSs(sessaoAtiva.formadorDuracaoSegundos)}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    ) : sessaoAtiva?.formadorEntradaEm ? (
                      <div className="rounded-lg border border-teal-500/25 bg-teal-950/20 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
                          Tempo do formador
                        </p>
                        <TempoPresencaAoVivo
                          segundosFechados={0}
                          emSessao
                          joinDesde={sessaoAtiva.formadorEntradaEm}
                          className="text-xl font-mono tabular-nums text-teal-300"
                        />
                        {sessaoAtiva.iniciadaEm ? (
                          <p className="text-[11px] text-teal-400/80 mt-1">
                            Iniciada em{" "}
                            {new Date(sessaoAtiva.iniciadaEm).toLocaleString("pt-PT")}
                          </p>
                        ) : null}
                      </div>
                    ) : sessaoAtiva?.iniciadaEm ? (
                      <p className="text-[11px] text-amber-300/90">
                        Sessão iniciada em{" "}
                        {new Date(sessaoAtiva.iniciadaEm).toLocaleString("pt-PT")} - entra
                        para activar o teu contador.
                      </p>
                    ) : null}
                    <div
                      data-dgert-target="sessao_sumario"
                      className={cn(
                        "space-y-2 rounded-lg border border-slate-700/50 bg-slate-950/40 p-3",
                        highlightSumario &&
                          "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-slate-950",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-200">Sumário da sessão</p>
                        {sumario?.imutavel ? (
                          <Badge variant="green">Assinado</Badge>
                        ) : sumario?.id ? (
                          <Badge variant="yellow">Rascunho</Badge>
                        ) : (
                          <Badge variant="default">Por preencher</Badge>
                        )}
                      </div>
                      {sumario?.imutavel && sumario.assinadoEm ? (
                        <p className="text-[11px] text-teal-400/90">
                          Assinado em{" "}
                          {new Date(sumario.assinadoEm).toLocaleString("pt-PT")}
                        </p>
                      ) : !sessaoAtiva?.terminadaEm ? (
                        <p className="text-[11px] text-amber-200/90 leading-snug">
                          O sumário só pode ser preenchido depois de a sessão ser terminada.
                        </p>
                      ) : !canOperateSessaoAtiva ? (
                        <p className="text-[11px] text-amber-200/90 leading-snug">
                          Só o formador desta sessão (ou o gestor) pode registar o sumário.
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 leading-snug">
                          Registe e assine no mesmo ecrã (formador da sessão ou gestor).
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {sumario?.imutavel || canOperateSessaoAtiva ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              busy ||
                              (!sumario?.imutavel &&
                                (!sessaoAtiva?.terminadaEm || !canOperateSessaoAtiva))
                            }
                            onClick={() => setSumarioModalOpen(true)}
                          >
                            {sumario?.imutavel
                              ? "Ver sumário"
                              : sumario?.id
                                ? "Continuar sumário"
                                : "Registar sumário"}
                          </Button>
                        ) : null}
                        {sumario?.pdfStorageKey ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void descarregarPdfSumario()}
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                        ) : null}
                      </div>
                      {sumario?.id &&
                      !sumario.imutavel &&
                      sessaoAtiva?.terminadaEm &&
                      canOperateSessaoAtiva ? (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-600/60 text-xs text-slate-300 cursor-pointer hover:border-slate-500">
                            <span className="truncate max-w-[140px]">
                              {sumarioPdf ? sumarioPdf.name : "PDF assinado"}
                            </span>
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              className="sr-only"
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                if (
                                  f &&
                                  f.type !== "application/pdf" &&
                                  !f.name.toLowerCase().endsWith(".pdf")
                                ) {
                                  setErr("Apenas ficheiros PDF (.pdf) são aceites.");
                                  setSumarioPdf(null);
                                  e.target.value = "";
                                  return;
                                }
                                setErr(null);
                                setSumarioPdf(f);
                              }}
                            />
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy || !sumarioPdf}
                            onClick={() => void uploadPdfSumarioSessao()}
                          >
                            Carregar PDF
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {!asideOperacional ? (
                      <>
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
                      </>
                    ) : null}
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
                      <p className="text-xs text-slate-500">
                        Sessão {sessaoAtiva.numeroSessao} · {formatDataPt(sessaoAtiva.data)}
                      </p>
                    ) : (
                      <p className="text-xs">Selecciona uma sessão na linha temporal.</p>
                    )}
                    {turmaAtiva ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-300">
                          {turmaAtiva.codigo} – {turmaAtiva.nome}
                        </p>
                        <p className="text-xs tabular-nums">
                          {matriculasTurma.length} inscrito
                          {matriculasTurma.length === 1 ? "" : "s"} na turma
                        </p>
                      </div>
                    ) : null}
                    {!canManageAssiduidade ? (
                      <p className="text-xs leading-snug">
                        Consulta dos dados da sessão: início, fim, formador e presenças.
                      </p>
                    ) : (
                      <ol className="list-decimal list-inside space-y-1.5 text-xs">
                        <li>Escolhe a turma (vê quem está inscrito)</li>
                        <li>Abre a folha com essas matrículas</li>
                        <li>Marca presenças e valida</li>
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
      <AtribuirFormadorAcaoModal
        open={atribuirFormadorModalOpen}
        onOpenChange={setAtribuirFormadorModalOpen}
        formadores={formadores}
        busy={busy}
        onConfirm={(id) => void atribuirFormadorTodas(id)}
      />
      <SumarioAssinaturaModal
        open={sumarioModalOpen}
        busy={busy}
        readOnly={!!sumario?.imutavel || !canOperateSessaoAtiva}
        documento={
          sessaoAtiva
            ? {
                numeroSessao: sessaoAtiva.numeroSessao,
                data: sessaoAtiva.data,
                horaInicio: sessaoAtiva.horaInicio,
                horaFim: sessaoAtiva.horaFim,
                modalidade: sessaoAtiva.modalidade,
                formadorNome: sessaoAtiva.formador?.nomeCompleto ?? null,
                conteudo: sumario?.conteudo ?? "",
              }
            : null
        }
        onClose={() => {
          if (!busy) setSumarioModalOpen(false);
        }}
        onConfirm={(payload) => void confirmarSumarioAssinatura(payload)}
      />
      <FolhaAprovacaoModal
        open={folhaValidacaoModalOpen}
        busy={busy}
        modo="validacao-formador"
        documento={
          folhaDetalhe
            ? {
                numeroSessao: folhaDetalhe.sessao.numeroSessao,
                data: folhaDetalhe.sessao.data,
                horaInicio: folhaDetalhe.sessao.horaInicio,
                horaFim: folhaDetalhe.sessao.horaFim,
                modalidade: sessaoAtiva?.modalidade ?? null,
                formadorNome: folhaDetalhe.sessao.formador?.nomeCompleto ?? null,
                turmaLabel: folhaDetalhe.turma
                  ? `${folhaDetalhe.turma.codigo} – ${folhaDetalhe.turma.nome}`
                  : null,
                presencas: folhaDetalhe.presencas,
              }
            : null
        }
        onClose={() => {
          if (!busy) setFolhaValidacaoModalOpen(false);
        }}
        onConfirm={(payload) => void confirmarValidacaoFolha(payload)}
      />
      <FolhaAprovacaoModal
        open={folhaAprovacaoModalOpen}
        busy={busy}
        modo="aprovacao-gestor"
        documento={
          folhaDetalhe
            ? {
                numeroSessao: folhaDetalhe.sessao.numeroSessao,
                data: folhaDetalhe.sessao.data,
                horaInicio: folhaDetalhe.sessao.horaInicio,
                horaFim: folhaDetalhe.sessao.horaFim,
                modalidade: sessaoAtiva?.modalidade ?? null,
                formadorNome: folhaDetalhe.sessao.formador?.nomeCompleto ?? null,
                turmaLabel: folhaDetalhe.turma
                  ? `${folhaDetalhe.turma.codigo} – ${folhaDetalhe.turma.nome}`
                  : null,
                presencas: folhaDetalhe.presencas,
              }
            : null
        }
        onClose={() => {
          if (!busy) setFolhaAprovacaoModalOpen(false);
        }}
        onConfirm={(payload) => void confirmarAprovacaoFolha(payload)}
      />
      <PresencaQrModal
        open={presencaQrModalOpen}
        sessaoId={selectedSessaoId}
        folhaId={selectedFolhaId}
        sessao={
          sessaoAtiva
            ? {
                numeroSessao: sessaoAtiva.numeroSessao,
                data: sessaoAtiva.data,
                horaInicio: sessaoAtiva.horaInicio,
                horaFim: sessaoAtiva.horaFim,
                titulo: tituloSessao(sessaoAtiva),
              }
            : null
        }
        onClose={() => setPresencaQrModalOpen(false)}
        onFolhaUpdated={(folha) => {
          setFolhaDetalhe((prev) => {
            if (!prev || prev.id !== folha.id) return prev;
            return {
              ...prev,
              presencas: folha.presencas.map((p) => {
                const existing = prev.presencas.find((x) => x.id === p.id);
                return {
                  id: p.id,
                  presente: p.presente,
                  estado: isEstadoPresenca(p.estado)
                    ? p.estado
                    : (existing?.estado ?? null),
                  motivoJustificacao: existing?.motivoJustificacao ?? null,
                  minutosEfetivos: existing?.minutosEfetivos ?? null,
                  validado: p.presente || !!existing?.validado,
                  matricula: p.matricula,
                };
              }),
            };
          });
        }}
      />
      {selectedCronogramaId ? (
        <CronogramaImportIaModal
          open={showImportIa}
          onOpenChange={(next) => {
            setShowImportIa(next);
            if (!next) setInitialImportJobId(null);
          }}
          cronogramaId={selectedCronogramaId}
          hasSessoes={sessoes.length > 0}
          turmaId={selectedTurmaId || null}
          initialJobId={initialImportJobId}
          onJobStarted={() => {
            setMsg("A IA está a analisar o cronograma em background.");
            void loadImportJobs(selectedCronogramaId);
          }}
          onApplied={async () => {
            setMsg("Sessões importadas com IA.");
            await loadSessoes(selectedCronogramaId, selectedTurmaId || undefined);
            await loadCronogramas(acaoId);
            await loadImportJobs(selectedCronogramaId);
          }}
          onDiscarded={async () => {
            setMsg("Rascunho IA descartado.");
            await loadImportJobs(selectedCronogramaId);
          }}
        />
      ) : null}
    </div>
  );
}
