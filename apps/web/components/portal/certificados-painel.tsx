"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  Bell,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";
import { Alert, Badge, Button, Select } from "@/components/ui";

type AcaoOpt = { id: string; codigoInterno: string; titulo: string };

type FormandoCert = {
  matriculaId: string;
  formando: { nome: string; nif: string };
  turmaCodigo: string;
  taxaPresenca: number | null;
  elegivelCertificado: boolean;
  codigoVerificacao?: string | null;
  certificadoSigo?: {
    id: string;
    numeroCertificado: string | null;
    emitidoEm: string | null;
    temFicheiro: boolean;
    referencia: string;
  } | null;
};

type LmsProgresso = {
  matriculaId: string;
  percentual: number;
  concluidas: number;
  total: number;
  completo?: boolean;
};

type ModuloPauta = { id: string; titulo: string; codigo: string | null; ordem: number };
type NotaModulo = { notaPauta: number | null; nota: number | null; avaliacaoId: string | null };

type DocPessoal = {
  id: string;
  label: string;
  completo: boolean;
  detalhe?: string;
  obrigatorio: boolean;
};

type DocAcao = {
  categoria: string;
  label: string;
  estado: string;
  aceiteEm: string | null;
  temFicheiro: boolean;
};

type FormandoDocs = {
  matriculaId: string;
  inscricaoCompleta: boolean;
  documentosPessoais: DocPessoal[];
  documentosAcao: DocAcao[];
};

type TarefaLms = {
  id: string;
  titulo: string;
  tipo: string;
  concluido: boolean;
  percentual: number;
  desbloqueado: boolean;
};

type FiltroTab = "todos" | "elegiveis" | "pendentes" | "emitidos";

type Props = {
  acoes: AcaoOpt[];
  acaoId: string;
  onAcaoChange: (id: string) => void;
};

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function isEmitido(f: FormandoCert): boolean {
  return Boolean(f.codigoVerificacao || f.certificadoSigo);
}

function progressTone(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-800", className)}>
      <div className={cn("h-full rounded-full transition-all", progressTone(pct))} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = "text-slate-100",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/50 p-4">
      <p className={cn("text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {sub ? <p className="mt-1 text-xs text-slate-600">{sub}</p> : null}
    </div>
  );
}

function mediaModulos(notas: Record<string, NotaModulo> | undefined, modulos: ModuloPauta[]): number | null {
  if (!notas || modulos.length === 0) return null;
  const vals = modulos
    .map((m) => notas[m.id]?.nota ?? notas[m.id]?.notaPauta)
    .filter((n): n is number => n != null && Number.isFinite(n));
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function CertificadosPainel({ acoes, acaoId, onAcaoChange }: Props) {
  const [formandos, setFormandos] = useState<FormandoCert[]>([]);
  const [modulos, setModulos] = useState<ModuloPauta[]>([]);
  const [notasPorMatricula, setNotasPorMatricula] = useState<Map<string, Record<string, NotaModulo>>>(new Map());
  const [lmsPorMatricula, setLmsPorMatricula] = useState<Map<string, LmsProgresso>>(new Map());
  const [docsPorMatricula, setDocsPorMatricula] = useState<Map<string, FormandoDocs>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [filtro, setFiltro] = useState<FiltroTab>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lmsDetalhe, setLmsDetalhe] = useState<Map<string, TarefaLms[]>>(new Map());
  const [lmsDetalheLoading, setLmsDetalheLoading] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setExpandedId(null);
    setLmsDetalhe(new Map());

    const [certRes, pautaRes, docsRes, lmsRes] = await Promise.all([
      bffFetch(`/api/v1/certificados/acoes-formacao/${id}`, { headers: { accept: "application/json" } }),
      bffFetch(`/api/v1/avaliacoes/acao/${id}/pauta`, { headers: { accept: "application/json" } }),
      bffFetch(`/api/v1/acoes-formacao/${id}/documentos-resumo`, { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/conteudos-lms/formador/progresso-resumo", { headers: { accept: "application/json" } }),
    ]);

    setLoading(false);

    if (!certRes.ok) {
      setError("Erro ao carregar certificados.");
      setFormandos([]);
      return;
    }

    const certData = (await certRes.json()) as { formandos: FormandoCert[] };
    setFormandos(certData.formandos);

    if (pautaRes.ok) {
      const pauta = (await pautaRes.json()) as {
        modulos: ModuloPauta[];
        formandos: Array<{ matriculaId: string; notas: Record<string, NotaModulo> }>;
      };
      setModulos(pauta.modulos);
      setNotasPorMatricula(new Map(pauta.formandos.map((f) => [f.matriculaId, f.notas])));
    } else {
      setModulos([]);
      setNotasPorMatricula(new Map());
    }

    if (docsRes.ok) {
      const docs = (await docsRes.json()) as { formandos: FormandoDocs[] };
      setDocsPorMatricula(new Map(docs.formandos.map((f) => [f.matriculaId, f])));
    } else {
      setDocsPorMatricula(new Map());
    }

    if (lmsRes.ok) {
      const lms = (await lmsRes.json()) as {
        acoes: Array<{ acaoId: string; formandosDetalhe: LmsProgresso[] }>;
      };
      const acaoLms = lms.acoes.find((a) => a.acaoId === id);
      setLmsPorMatricula(
        new Map((acaoLms?.formandosDetalhe ?? []).map((f) => [f.matriculaId, f])),
      );
    } else {
      setLmsPorMatricula(new Map());
    }
  }, []);

  useEffect(() => {
    if (acaoId) void load(acaoId);
  }, [acaoId, load]);

  const stats = useMemo(() => {
    const total = formandos.length;
    const elegiveis = formandos.filter((f) => f.elegivelCertificado).length;
    const emitidos = formandos.filter(isEmitido).length;
    const pendentes = formandos.filter((f) => f.elegivelCertificado && !isEmitido(f)).length;
    const pctElegiveis = total > 0 ? Math.round((elegiveis / total) * 100) : 0;
    return { total, elegiveis, emitidos, pendentes, pctElegiveis };
  }, [formandos]);

  const filtrados = useMemo(() => {
    switch (filtro) {
      case "elegiveis":
        return formandos.filter((f) => f.elegivelCertificado);
      case "pendentes":
        return formandos.filter((f) => f.elegivelCertificado && !isEmitido(f));
      case "emitidos":
        return formandos.filter(isEmitido);
      default:
        return formandos;
    }
  }, [filtro, formandos]);

  async function loadLmsDetalhe(matriculaId: string) {
    if (lmsDetalhe.has(matriculaId)) return;
    setLmsDetalheLoading(matriculaId);
    const res = await bffFetch(
      `/api/v1/conteudos-lms/formador/progresso-detalhe?matriculaId=${encodeURIComponent(matriculaId)}`,
      { headers: { accept: "application/json" } },
    );
    setLmsDetalheLoading(null);
    if (!res.ok) return;
    const data = (await res.json()) as { percurso: { tarefas: TarefaLms[] } };
    setLmsDetalhe((prev) => new Map(prev).set(matriculaId, data.percurso.tarefas));
  }

  function toggleExpand(matriculaId: string) {
    if (expandedId === matriculaId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(matriculaId);
    void loadLmsDetalhe(matriculaId);
  }

  function downloadSigo(certificadoId: string) {
    window.open(`/api/v1/sigo/certificados/${certificadoId}/download`, "_blank", "noopener,noreferrer");
  }

  async function imprimir(matriculaId: string) {
    const r = await bffFetch(`/api/v1/certificados/matricula/${matriculaId}/certificado.html`, {
      headers: { accept: "text/html" },
    });
    if (!r.ok) {
      setError("Erro ao gerar certificado.");
      return;
    }
    const html = await r.text();
    const opened = openHtmlForPrint(html);
    if (!opened.ok) setError(opened.error);
  }

  async function notificarElegiveis() {
    if (!acaoId) return;
    setNotifyBusy(true);
    setMsg(null);
    setError(null);
    const r = await bffFetch(`/api/v1/notificacoes/certificados/acoes-formacao/${acaoId}`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setNotifyBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const data = (await r.json()) as { elegiveis: number; enviados: number };
    setMsg(`${data.enviados} email(s) enviado(s) a formandos elegíveis (${data.elegiveis} total).`);
  }

  const tabs: Array<{ id: FiltroTab; label: string; count: number }> = [
    { id: "todos", label: "Todos", count: stats.total },
    { id: "elegiveis", label: "Elegíveis", count: stats.elegiveis },
    { id: "pendentes", label: "Pendentes", count: stats.pendentes },
    { id: "emitidos", label: "Emitidos", count: stats.emitidos },
  ];

  return (
    <div className="space-y-5">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[min(100%,20rem)] flex-1">
          <Select label="Acção" value={acaoId} onChange={(e) => onAcaoChange(e.target.value)}>
            {acoes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigoInterno} – {a.titulo}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="teal" disabled={notifyBusy || !acaoId} onClick={() => void notificarElegiveis()}>
          <Bell className="h-3.5 w-3.5" />
          {notifyBusy ? "A notificar…" : "Notificar elegíveis"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total formandos" value={stats.total} />
        <StatCard
          label="Elegíveis"
          value={stats.elegiveis}
          sub={stats.total > 0 ? `${stats.pctElegiveis}%` : undefined}
          tone="text-violet-300"
        />
        <StatCard label="Certificados" value={stats.emitidos} tone="text-emerald-300" />
        <StatCard label="Pendentes" value={stats.pendentes} tone="text-amber-300" />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFiltro(tab.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filtro === tab.id
                ? "bg-violet-600/30 text-violet-200 ring-1 ring-violet-500/40"
                : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200",
            )}
          >
            {tab.label} {tab.count}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/40 bg-slate-900/30">
        {loading ? (
          <p className="p-5 text-sm text-slate-500">A carregar…</p>
        ) : filtrados.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Sem formandos neste filtro.</p>
        ) : (
          <ul className="divide-y divide-slate-800/80">
            {filtrados.map((f) => {
              const expanded = expandedId === f.matriculaId;
              const lms = lmsPorMatricula.get(f.matriculaId);
              const notas = notasPorMatricula.get(f.matriculaId);
              const media = mediaModulos(notas, modulos);
              const docs = docsPorMatricula.get(f.matriculaId);
              const docsObrig = [
                ...(docs?.documentosPessoais.filter((d) => d.obrigatorio) ?? []),
                ...(docs?.documentosAcao.map((d) => ({
                  id: d.categoria,
                  label: d.label,
                  completo: d.estado === "aceite",
                  obrigatorio: true,
                  detalhe: d.estado,
                })) ?? []),
              ];
              const docsFalta = docsObrig.filter((d) => !d.completo);
              const docsOk = docsObrig.filter((d) => d.completo);
              const tarefas = lmsDetalhe.get(f.matriculaId);
              const presenca = f.taxaPresenca ?? 0;

              return (
                <li key={f.matriculaId}>
                  <div className="p-4">
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 text-left"
                      onClick={() => toggleExpand(f.matriculaId)}
                    >
                      {expanded ? (
                        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                      ) : (
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                      )}
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300"
                        aria-hidden
                      >
                        {initials(f.formando.nome)}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-100">{f.formando.nome}</p>
                            <p className="text-xs text-slate-500">
                              Turma {f.turmaCodigo} · NIF {f.formando.nif}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {f.elegivelCertificado ? (
                              <Badge variant="green">Elegível</Badge>
                            ) : (
                              <Badge variant="yellow">Não elegível</Badge>
                            )}
                            {isEmitido(f) ? <Badge variant="purple">Emitido</Badge> : null}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>Assiduidade</span>
                              <span className="tabular-nums text-slate-300">
                                {f.taxaPresenca != null ? `${f.taxaPresenca}%` : "–"}
                              </span>
                            </div>
                            <ProgressBar value={presenca} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>Tarefas LMS</span>
                              <span className="tabular-nums text-slate-300">
                                {lms ? `${lms.percentual}%` : "–"}
                              </span>
                            </div>
                            <ProgressBar value={lms?.percentual ?? 0} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>Média módulos</span>
                              <span className="tabular-nums text-slate-300">
                                {media != null ? media.toFixed(1) : "–"}
                              </span>
                            </div>
                            <ProgressBar value={media != null ? (media / 20) * 100 : 0} />
                          </div>
                        </div>
                      </div>
                    </button>

                    {expanded ? (
                      <div className="mt-4 space-y-4 border-t border-slate-800/80 pt-4 pl-10">
                        <section className="space-y-2">
                          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <FileText className="h-3.5 w-3.5" />
                            Documentos obrigatórios
                          </h4>
                          {docsObrig.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem documentos configurados.</p>
                          ) : (
                            <div className="grid gap-3 lg:grid-cols-2">
                              <div className="rounded-lg border border-red-500/20 bg-red-950/10 p-3">
                                <p className="mb-2 text-[11px] font-medium text-red-300">
                                  Em falta ({docsFalta.length})
                                </p>
                                {docsFalta.length === 0 ? (
                                  <p className="text-xs text-slate-500">Nenhum.</p>
                                ) : (
                                  <ul className="space-y-1 text-sm text-slate-300">
                                    {docsFalta.map((d) => (
                                      <li key={d.id}>• {d.label}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3">
                                <p className="mb-2 text-[11px] font-medium text-emerald-300">
                                  Validados ({docsOk.length})
                                </p>
                                {docsOk.length === 0 ? (
                                  <p className="text-xs text-slate-500">Nenhum.</p>
                                ) : (
                                  <ul className="space-y-1 text-sm text-slate-300">
                                    {docsOk.map((d) => (
                                      <li key={d.id}>• {d.label}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          )}
                        </section>

                        <section className="space-y-2">
                          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Award className="h-3.5 w-3.5" />
                            Avaliação por módulo
                          </h4>
                          {modulos.length === 0 ? (
                            <p className="text-sm text-slate-500">Sem módulos no curso.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {modulos.map((m) => {
                                const nota = notas?.[m.id]?.nota ?? notas?.[m.id]?.notaPauta;
                                return (
                                  <li
                                    key={m.id}
                                    className="flex items-center justify-between rounded-lg border border-slate-700/30 bg-slate-950/40 px-3 py-2 text-sm"
                                  >
                                    <span className="text-slate-300">
                                      {m.codigo ? `${m.codigo} · ` : ""}
                                      {m.titulo}
                                    </span>
                                    <span className="tabular-nums font-medium text-slate-100">
                                      {nota != null ? nota.toFixed(1) : "–"}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </section>

                        <section className="space-y-2">
                          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Tarefas LMS
                          </h4>
                          {lmsDetalheLoading === f.matriculaId ? (
                            <p className="text-sm text-slate-500">A carregar tarefas…</p>
                          ) : !tarefas?.length ? (
                            <p className="text-sm text-slate-500">
                              {lms ? `${lms.concluidas}/${lms.total} concluídas` : "Sem percurso LMS."}
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {tarefas.map((t) => (
                                <li
                                  key={t.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/30 bg-slate-950/40 px-3 py-2 text-sm"
                                >
                                  <span className="min-w-0 truncate text-slate-300">{t.titulo}</span>
                                  <Badge variant={t.concluido ? "green" : "yellow"}>
                                    {t.concluido ? "Concluída" : `${t.percentual}%`}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>

                        {f.elegivelCertificado || f.certificadoSigo?.temFicheiro ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {f.elegivelCertificado ? (
                            <Button size="sm" onClick={() => void imprimir(f.matriculaId)}>
                              <Download className="h-3 w-3" />
                              Imprimir / PDF
                            </Button>
                          ) : null}
                          {f.certificadoSigo?.temFicheiro ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => downloadSigo(f.certificadoSigo!.id)}
                            >
                              PDF SIGO
                            </Button>
                          ) : null}
                        </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
