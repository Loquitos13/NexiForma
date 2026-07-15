"use client";

import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { fmtDate } from "@/lib/crm/shared";

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
  criadoPor?: { displayName: string } | null;
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
  defaultExpanded?: boolean;
};

export function NotaRegistoCard({
  nota,
  busy,
  onAceitar,
  onRejeitar,
  defaultExpanded = true,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const camposPreenchidos = CAMPOS.filter((c) => {
    const v = nota[c.key];
    return typeof v === "string" && v.trim().length > 0;
  });
  const passosIa = proximosPassosLista(nota.proximosPassosIa);
  const pendentes = nota.sugestoes.filter((s) => s.estado === "PENDENTE");

  return (
    <article className="rounded-xl border border-slate-600/50 bg-slate-900/60 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
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
            {nota.criadoPor?.displayName ? ` · ${nota.criadoPor.displayName}` : ""}
          </p>
          {!expanded && camposPreenchidos[0] ? (
            <p className="mt-1 text-xs text-slate-400 line-clamp-2">
              {String(nota[camposPreenchidos[0].key])}
            </p>
          ) : null}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
        )}
      </button>

      {expanded ? (
        <div className="border-t border-slate-700/50 px-4 py-4 space-y-4">
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
                    <dd className="mt-0.5 text-sm text-slate-200 whitespace-pre-wrap">
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
                <p className="text-sm text-violet-100/90 whitespace-pre-wrap">{nota.resumoIa}</p>
              ) : null}
              {passosIa.length > 0 ? (
                <ul className="mt-2 list-disc pl-4 text-sm text-violet-200/80 space-y-0.5">
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
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" />
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
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{s.descricao}</p>
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
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRejeitar(s.id)}>
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
    </article>
  );
}
