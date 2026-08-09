"use client";

import Link from "next/link";
import { Check, ChevronDown, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/ui/cn";
import { fmtCrmAutor, fmtDate } from "@/lib/crm/shared";

export type NotaSugestao = {
  id: string;
  titulo: string;
  descricao: string;
  estado: string;
  tipo: string;
  score?: number | string;
  leadComercial?: { id: string; codigo: string; empresaNome: string } | null;
};

export type NotaRegisto = {
  id: string;
  tipo: string;
  titulo: string | null;
  contexto: string | null;
  situacaoActual: string | null;
  dorNecessidade: string | null;
  orcamentoTiming: string | null;
  decisor: string | null;
  proximoPassoNota: string | null;
  notasLivres: string | null;
  resumoIa: string | null;
  proximosPassosIa: unknown;
  processamentoEstado: string;
  processamentoEngine: string | null;
  processamentoErro: string | null;
  createdAt: string;
  criadoPor?: { displayName: string; contaEliminada?: boolean } | null;
  sugestoes: NotaSugestao[];
};

const CAMPOS: Array<{ key: keyof NotaRegisto; label: string }> = [
  { key: "contexto", label: "Contexto / participantes" },
  { key: "situacaoActual", label: "Situação actual" },
  { key: "dorNecessidade", label: "Dor / necessidade" },
  { key: "orcamentoTiming", label: "Orçamento e timing" },
  { key: "decisor", label: "Decisor" },
  { key: "proximoPassoNota", label: "Próximo passo acordado" },
  { key: "notasLivres", label: "Notas livres" },
];

const ACCORDION_MS = 300;

function proximosPassosLista(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object" && "accao" in p) return String((p as { accao: string }).accao);
      return null;
    })
    .filter((s): s is string => !!s?.trim());
}

type Props = {
  nota: NotaRegisto;
  busy?: boolean;
  onAceitar?: (id: string) => void;
  onRejeitar?: (id: string) => void;
  /** Modo não controlado (legado). Ignorado se `expanded` for passado. */
  defaultExpanded?: boolean;
  /** Modo controlado (acordeão exclusivo no parent). */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

export function NotaRegistoCard({
  nota,
  busy,
  onAceitar,
  onRejeitar,
  defaultExpanded = true,
  expanded: expandedProp,
  onExpandedChange,
}: Props) {
  const controlled = expandedProp !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded);
  const expanded = controlled ? expandedProp : uncontrolled;
  const [showBody, setShowBody] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setShowBody(true);
      return;
    }
    const t = window.setTimeout(() => setShowBody(false), ACCORDION_MS);
    return () => clearTimeout(t);
  }, [expanded]);

  function toggle() {
    const next = !expanded;
    if (controlled) onExpandedChange?.(next);
    else setUncontrolled(next);
  }

  const camposPreenchidos = CAMPOS.filter((c) => {
    const v = nota[c.key];
    return typeof v === "string" && v.trim().length > 0;
  });
  const passosIa = proximosPassosLista(nota.proximosPassosIa);
  const pendentes = nota.sugestoes.filter((s) => s.estado === "PENDENTE");

  return (
    <article className="overflow-hidden rounded-xl border border-slate-600/50 bg-slate-900/60">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/40"
        onClick={toggle}
        aria-expanded={expanded}
        aria-label={expanded ? "Fechar nota" : "Expandir nota"}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">
              {nota.titulo?.trim() || nota.tipo}
            </span>
            <Badge variant="default">{nota.tipo}</Badge>
            <Badge
              variant={
                nota.processamentoEstado === "PROCESSADO"
                  ? "green"
                  : nota.processamentoEstado === "PENDENTE"
                    ? "yellow"
                    : nota.processamentoEstado === "ERRO"
                      ? "red"
                      : "default"
              }
            >
              {nota.processamentoEstado}
            </Badge>
            {pendentes.length > 0 ? (
              <Badge variant="purple">{pendentes.length} sugestão(ões) IA</Badge>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            {fmtDate(nota.createdAt)}
            {nota.criadoPor ? ` · ${fmtCrmAutor(nota.criadoPor)}` : ""}
          </p>
          {!expanded && camposPreenchidos[0] ? (
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">
              {String(nota[camposPreenchidos[0].key])}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out",
            expanded && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {showBody ? (
            <div className="space-y-4 border-t border-slate-700/50 px-4 py-4">
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Registo do comercial
                </h4>
                {camposPreenchidos.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem texto registado nesta nota.</p>
                ) : (
                  <dl className="space-y-2.5">
                    {camposPreenchidos.map((c) => (
                      <div key={c.key}>
                        <dt className="text-[11px] font-medium text-slate-500">{c.label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-200">
                          {String(nota[c.key])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>

              {nota.resumoIa || passosIa.length > 0 ? (
                <section className="rounded-lg border border-violet-500/20 bg-violet-950/20 px-3 py-3">
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Análise IA
                    {nota.processamentoEngine ? (
                      <span className="font-normal normal-case text-violet-400/70">
                        ({nota.processamentoEngine})
                      </span>
                    ) : null}
                  </h4>
                  {nota.resumoIa ? (
                    <p className="whitespace-pre-wrap text-sm text-violet-100/90">{nota.resumoIa}</p>
                  ) : null}
                  {passosIa.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm text-violet-200/80">
                      {passosIa.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              {nota.processamentoEstado === "ERRO" && nota.processamentoErro ? (
                <p className="text-xs text-red-400">Erro IA: {nota.processamentoErro}</p>
              ) : null}

              {nota.sugestoes.length > 0 ? (
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sugestões comerciais (IA)
                  </h4>
                  <div className="space-y-2">
                    {nota.sugestoes.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-violet-500/25 bg-slate-950/50 px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                              <span className="text-sm font-medium text-slate-100">{s.titulo}</span>
                              <Badge variant="default">{s.tipo.replace("_", " ")}</Badge>
                              <Badge
                                variant={
                                  s.estado === "PENDENTE"
                                    ? "yellow"
                                    : s.estado === "ACEITE"
                                      ? "green"
                                      : "red"
                                }
                              >
                                {s.estado}
                              </Badge>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-slate-300">{s.descricao}</p>
                            {s.estado === "ACEITE" && s.leadComercial ? (
                              <p className="mt-1.5 text-xs">
                                <Link
                                  href="/portal/crm/leads"
                                  className="font-medium text-blue-400 hover:underline"
                                >
                                  Lead {s.leadComercial.codigo} · {s.leadComercial.empresaNome}
                                </Link>
                              </p>
                            ) : null}
                          </div>
                          {s.estado === "PENDENTE" && onAceitar && onRejeitar ? (
                            <div className="flex shrink-0 gap-1.5">
                              <Button size="sm" disabled={busy} onClick={() => onAceitar(s.id)}>
                                <Check className="h-3.5 w-3.5" />
                                Aceitar
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => onRejeitar(s.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
