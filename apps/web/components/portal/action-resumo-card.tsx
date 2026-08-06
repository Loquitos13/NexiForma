"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BookOpen, Pencil, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  estadoBadge,
  Input,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type AcaoResumo = {
  titulo: string;
  estado: string;
  dataInicio: string;
  dataFim: string;
  prazoConclusaoLms?: string | null;
  curso: { id: string; designacao: string };
};

type EditForm = {
  titulo: string;
  estado: string;
  dataInicio: string;
  dataFim: string;
  prazoConclusaoLms: string;
};

type Props = {
  acao: AcaoResumo;
  canEdit: boolean;
  busy?: boolean;
  onSave: (data: EditForm) => Promise<void>;
  /** Requisito DGERT a destacar (ex. acao_periodo, acao_estado). */
  focusRequisito?: string | null;
};

const ESTADOS = ["PLANEADA", "CANCELADA"] as const;

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  return String(value).slice(0, 10).split("-").reverse().join("/");
}

function toForm(acao: AcaoResumo): EditForm {
  return {
    titulo: acao.titulo,
    estado: acao.estado,
    dataInicio: String(acao.dataInicio).slice(0, 10),
    dataFim: String(acao.dataFim).slice(0, 10),
    prazoConclusaoLms: acao.prazoConclusaoLms ? String(acao.prazoConclusaoLms).slice(0, 10) : "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800/60 bg-slate-900/30 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</p>
      <div className="text-sm text-slate-100">{children}</div>
    </div>
  );
}

export function ActionResumoCard({
  acao,
  canEdit,
  busy = false,
  onSave,
  focusRequisito = null,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>(() => toForm(acao));
  const focusPeriodo = focusRequisito === "acao_periodo";
  const focusEstado = focusRequisito === "acao_estado";

  useEffect(() => {
    if (!editing) setForm(toForm(acao));
  }, [acao, editing]);

  useEffect(() => {
    if (canEdit && (focusPeriodo || focusEstado)) setEditing(true);
  }, [canEdit, focusPeriodo, focusEstado]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSave(form);
    setEditing(false);
  }

  if (editing && canEdit) {
    return (
      <Card className="border-blue-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Editar dados da acção</CardTitle>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cancelar edição"
          >
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 max-w-lg">
            <Input
              label="Título"
              value={form.titulo}
              onChange={(e) => setForm((x) => ({ ...x, titulo: e.target.value }))}
            />
            <div
              data-dgert-target="acao_estado"
              className={cn(
                focusEstado &&
                  "rounded-lg ring-2 ring-amber-400/55 ring-offset-2 ring-offset-slate-950 p-2 -m-2",
              )}
            >
              <Select
                label="Estado"
                value={form.estado}
                onChange={(e) => setForm((x) => ({ ...x, estado: e.target.value }))}
              >
                {Array.from(new Set<string>([...ESTADOS, form.estado])).map((s) => (
                  <option key={s} value={s} disabled={s === "EM_CURSO" || s === "CONCLUIDA"}>
                    {s === "EM_CURSO" ? "EM_CURSO (automático)" : s === "CONCLUIDA" ? "CONCLUIDA (via confirmação)" : s}
                  </option>
                ))}
              </Select>
            </div>
            <div
              data-dgert-target="acao_periodo"
              className={cn(
                "grid grid-cols-2 gap-4",
                focusPeriodo &&
                  "rounded-lg ring-2 ring-amber-400/55 ring-offset-2 ring-offset-slate-950 p-2 -m-2",
              )}
            >
              <Input
                label="Início"
                type="date"
                value={form.dataInicio}
                onChange={(e) => setForm((x) => ({ ...x, dataInicio: e.target.value }))}
              />
              <Input
                label="Fim"
                type="date"
                value={form.dataFim}
                onChange={(e) => setForm((x) => ({ ...x, dataFim: e.target.value }))}
              />
            </div>
            <Input
              label="Prazo conclusão LMS"
              type="date"
              value={form.prazoConclusaoLms}
              onChange={(e) => setForm((x) => ({ ...x, prazoConclusaoLms: e.target.value }))}
            />
            <p className="text-xs text-slate-500 -mt-2">
              Opcional. Se vazio, usa a data de fim da acção. O formando vê o progresso face a este prazo.
            </p>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={busy}>
                {busy ? "A guardar…" : "Guardar alterações"}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden border-slate-700/40 transition-colors hover:border-slate-600/50">
      {canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-slate-600/50",
            "bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-300 shadow-lg backdrop-blur-sm",
            "opacity-0 translate-y-0.5 transition-all duration-200",
            "group-hover:opacity-100 group-hover:translate-y-0",
            "hover:border-blue-500/40 hover:bg-slate-800 hover:text-blue-300",
          )}
        >
          <Pencil className="h-3 w-3" />
          Editar
        </button>
      ) : null}

      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dados da acção</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título">
            <span className="font-medium leading-snug">{acao.titulo}</span>
          </Field>
          <Field label="Estado">{estadoBadge(acao.estado)}</Field>
          <Field label="Início">{fmtDate(acao.dataInicio)}</Field>
          <Field label="Fim">{fmtDate(acao.dataFim)}</Field>
          <Field label="Prazo conclusão LMS">
            {acao.prazoConclusaoLms ? (
              <span className="tabular-nums">{fmtDate(acao.prazoConclusaoLms)}</span>
            ) : (
              <span className="text-slate-500">Usa a data de fim da acção</span>
            )}
          </Field>
          <Field label="Formação (curso)">
            <Link
              href={`/portal/cursos/${acao.curso.id}?tab=conteudos`}
              className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300"
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              {acao.curso.designacao}
            </Link>
          </Field>
        </div>
        <p className="text-xs text-slate-500 border-t border-slate-800/60 pt-3">
          Os conteúdos LMS são definidos na formação e partilhados por todas as acções do mesmo curso.
        </p>
      </CardContent>
    </Card>
  );
}
