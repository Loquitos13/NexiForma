import {
  FileText,
  HelpCircle,
  Link2,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";

export type MetodologiaModulo = "presencial" | "b-learning" | "e-learning";

export type UnidadeNode = {
  id: string;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  cargaHoras: number | null;
  cargaHorasTeoricas?: number | null;
  cargaHorasPraticas?: number | null;
  formadorId: string | null;
  formador?: { id: string; nomeCompleto: string } | null;
  ordem: number;
  notaMinima: number | null;
  lockManual?: boolean;
  metodologia?: MetodologiaModulo | null;
  visivel?: boolean;
  obrigatorio?: boolean;
  prerequisitoUnidadeId?: string | null;
  _count?: { conteudos: number };
};

export type ModuloNode = {
  id: string;
  titulo: string;
  tipo: "VIDEO" | "PDF" | "TEXTO" | "QUIZ" | "WEBINAR";
  ordem: number;
  moduloUnidadeId: string | null;
  duracaoMin: number | null;
  urlOuRef: string | null;
  conteudoHtml: string | null;
  notaMinima: number | null;
  prerequisitoModuloId: string | null;
  publicado: boolean;
  metadata?: Record<string, unknown> | null;
};

export const METODOLOGIA_OPTS: { id: MetodologiaModulo; label: string }[] = [
  { id: "presencial", label: "Presencial" },
  { id: "b-learning", label: "B-learning" },
  { id: "e-learning", label: "E-learning" },
];

export const TIPOS_CONTEUDO = [
  { tipo: "VIDEO" as const, label: "Vídeo", short: "Vídeo", color: "blue", Icon: Video },
  { tipo: "WEBINAR" as const, label: "Webinar", short: "Webinar", color: "cyan", Icon: Link2 },
  { tipo: "PDF" as const, label: "Documento", short: "PDF", color: "red", Icon: FileText },
  { tipo: "TEXTO" as const, label: "Texto", short: "Texto", color: "slate", Icon: Type },
  { tipo: "QUIZ" as const, label: "Quiz", short: "Quiz", color: "purple", Icon: HelpCircle },
] as const;

export const colorMap: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", ring: "ring-blue-500/40" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30", ring: "ring-cyan-500/40" },
  red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", ring: "ring-red-500/40" },
  slate: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", ring: "ring-slate-500/40" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30", ring: "ring-purple-500/40" },
};

export const INPUT_CLASS =
  "w-full min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-teal-500/50";

export function tipoMeta(tipo: ModuloNode["tipo"]) {
  return TIPOS_CONTEUDO.find((x) => x.tipo === tipo) ?? TIPOS_CONTEUDO[3];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileMeta(modulo: ModuloNode): {
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  descricaoCurta?: string;
  ponderacaoNota?: number;
} {
  const m = modulo.metadata;
  if (!m || typeof m !== "object") return {};
  return {
    fileName: typeof m.fileName === "string" ? m.fileName : undefined,
    mimeType: typeof m.mimeType === "string" ? m.mimeType : undefined,
    sizeBytes: typeof m.sizeBytes === "number" ? m.sizeBytes : undefined,
    descricaoCurta: typeof m.descricaoCurta === "string" ? m.descricaoCurta : undefined,
    ponderacaoNota: typeof m.ponderacaoNota === "number" ? m.ponderacaoNota : undefined,
  };
}

export function conteudoSubtitle(m: ModuloNode): string {
  const t = tipoMeta(m.tipo);
  const meta = fileMeta(m);
  if (m.tipo === "VIDEO" && m.duracaoMin) return `${t.short} · ${m.duracaoMin} min`;
  if (m.tipo === "PDF" && meta.sizeBytes) return `${t.short} · ${formatBytes(meta.sizeBytes)}`;
  if (m.tipo === "QUIZ") return `${t.short} · quiz`;
  return t.short;
}

export function totalHorasUnidades(unidades: UnidadeNode[]): number {
  return unidades.reduce((s, u) => s + (u.cargaHoras ?? 0), 0);
}

export function pubStats(modulos: ModuloNode[], unidadeId: string | null) {
  const items = modulos.filter((m) => m.moduloUnidadeId === unidadeId);
  const pub = items.filter((m) => m.publicado).length;
  return { total: items.length, pub };
}

export function globalPubStats(modulos: ModuloNode[]) {
  const pub = modulos.filter((m) => m.publicado).length;
  return { total: modulos.length, pub };
}

export function metodologiaLabel(m: MetodologiaModulo | null | undefined): string | null {
  if (!m) return null;
  return METODOLOGIA_OPTS.find((o) => o.id === m)?.label ?? m;
}

/** Resumo de horas teóricas/práticas para cards na sidebar. */
export function formatHorasModulo(u: UnidadeNode): string {
  const t = u.cargaHorasTeoricas;
  const p = u.cargaHorasPraticas;
  if (t != null || p != null) {
    const tStr = t != null ? `${t}h T` : "-- T";
    const pStr = p != null ? `${p}h P` : "-- P";
    const sum = (t ?? 0) + (p ?? 0);
    return sum > 0 ? `${tStr} · ${pStr} · ${sum}h` : `${tStr} · ${pStr}`;
  }
  const total = u.cargaHoras ?? 0;
  return total > 0 ? `${total}h` : "--h";
}

export function quizPonderacaoTotal(modulos: ModuloNode[], unidadeId: string | null): number {
  return modulos
    .filter((m) => m.moduloUnidadeId === unidadeId && m.tipo === "QUIZ")
    .reduce((s, m) => s + (fileMeta(m).ponderacaoNota ?? 0), 0);
}

export type TipoConteudoIcon = LucideIcon;
