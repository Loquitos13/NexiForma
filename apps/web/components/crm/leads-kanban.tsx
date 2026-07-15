"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical, Loader2 } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { fmtEuro, leadEstadoLabel, type LeadEstado } from "@/lib/crm/shared";
import { Badge, Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

export type KanbanLead = {
  id: string;
  codigo: string;
  empresaNome: string;
  contactoNome: string | null;
  email: string | null;
  estado: string;
  valorEstimadoCentavos: number;
  atribuido: { displayName: string } | null;
};

const COLUNAS: LeadEstado[] = ["NOVO", "CONTACTADO", "QUALIFICADO", "CONVERTIDO", "PERDIDO"];

const COLUNA_ACCENT: Record<LeadEstado, string> = {
  NOVO: "ring-blue-400/50 bg-blue-950/25",
  CONTACTADO: "ring-amber-400/50 bg-amber-950/20",
  QUALIFICADO: "ring-violet-400/50 bg-violet-950/25",
  CONVERTIDO: "ring-emerald-400/50 bg-emerald-950/20",
  PERDIDO: "ring-slate-500/40 bg-slate-900/40",
};

type Props = {
  leads: KanbanLead[];
  onMoved?: () => void;
  onSelect?: (lead: KanbanLead) => void;
};

export function LeadsKanbanBoard({ leads, onMoved, onSelect }: Props) {
  const [localLeads, setLocalLeads] = useState(leads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverEstado, setDragOverEstado] = useState<LeadEstado | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    if (!movingId) setLocalLeads(leads);
  }, [leads, movingId]);

  const byEstado = useMemo(
    () =>
      COLUNAS.reduce(
        (acc, e) => {
          acc[e] = localLeads.filter((l) => l.estado === e);
          return acc;
        },
        {} as Record<LeadEstado, KanbanLead[]>,
      ),
    [localLeads],
  );

  const dragLead = dragId ? localLeads.find((l) => l.id === dragId) : null;

  const moveLead = useCallback(
    async (leadId: string, estado: LeadEstado) => {
      const lead = localLeads.find((l) => l.id === leadId);
      if (!lead || lead.estado === estado) return;

      const snapshot = localLeads;
      setLocalLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, estado } : l)));
      setMovingId(leadId);
      setErrorId(null);

      const res = await bffFetch(`/api/v1/crm/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ estado }),
      });

      setMovingId(null);
      if (!res.ok) {
        setLocalLeads(snapshot);
        setErrorId(leadId);
        window.setTimeout(() => setErrorId(null), 600);
        return;
      }
      onMoved?.();
    },
    [localLeads, onMoved],
  );

  function handleDragStart(e: React.DragEvent, lead: KanbanLead) {
    e.dataTransfer.setData("text/lead-id", lead.id);
    e.dataTransfer.effectAllowed = "move";
    setDragId(lead.id);
    setErrorId(null);
  }

  function handleDragOver(e: React.DragEvent, estado: LeadEstado) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverEstado !== estado) setDragOverEstado(estado);
  }

  function handleDrop(e: React.DragEvent, estado: LeadEstado) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/lead-id") || dragId;
    setDragId(null);
    setDragOverEstado(null);
    if (id) void moveLead(id, estado);
  }

  function handleDragEnd() {
    setDragId(null);
    setDragOverEstado(null);
  }

  const isDragging = dragId !== null;

  return (
    <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-5">
      {COLUNAS.map((estado) => {
        const isDropTarget = dragOverEstado === estado && dragId !== null;
        const isSource = dragLead?.estado === estado;

        return (
          <div
            key={estado}
            className={cn(
              "min-w-[220px] rounded-xl border border-slate-700/50 bg-slate-900/30 transition-all duration-200 ease-out",
              isDropTarget && !isSource && cn("scale-[1.02] ring-2", COLUNA_ACCENT[estado]),
              isDragging && !isDropTarget && "opacity-90",
            )}
            onDragOver={(e) => handleDragOver(e, estado)}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOverEstado(estado);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverEstado((prev) => (prev === estado ? null : prev));
              }
            }}
            onDrop={(e) => handleDrop(e, estado)}
          >
            <div
              className={cn(
                "flex items-center justify-between border-b border-slate-700/40 px-3 py-2 transition-colors duration-200",
                isDropTarget && !isSource && "border-violet-500/30",
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {leadEstadoLabel(estado)}
              </span>
              <Badge variant="default">{byEstado[estado].length}</Badge>
            </div>

            <div className="relative min-h-[140px] space-y-2 p-2">
              {isDropTarget && !isSource ? (
                <div
                  className={cn(
                    "pointer-events-none absolute inset-2 z-0 rounded-lg border-2 border-dashed animate-pulse",
                    estado === "CONVERTIDO" && "border-emerald-500/40",
                    estado === "PERDIDO" && "border-slate-500/40",
                    estado !== "CONVERTIDO" && estado !== "PERDIDO" && "border-violet-500/40",
                  )}
                  aria-hidden
                />
              ) : null}

              {byEstado[estado].map((lead) => {
                const isDraggable = !movingId && estado !== "CONVERTIDO" && estado !== "PERDIDO";
                const isDraggingCard = dragId === lead.id;
                const isSaving = movingId === lead.id;
                const isError = errorId === lead.id;

                return (
                  <Card
                    key={lead.id}
                    draggable={isDraggable}
                    onDragStart={(e) => isDraggable && handleDragStart(e, lead)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "relative z-10 border-slate-700/40 bg-slate-800/50 transition-all duration-200 ease-out",
                      isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                      isDraggingCard && "scale-95 opacity-40 shadow-none",
                      isSaving && "scale-[0.98] opacity-70 ring-1 ring-violet-500/30",
                      isError && "animate-[kanban-shake_0.45s_ease-in-out] ring-2 ring-red-500/50",
                      !isDraggingCard && !isSaving && "hover:-translate-y-0.5 hover:border-slate-600/60 hover:shadow-md hover:shadow-slate-950/40",
                    )}
                    onClick={() => !isDragging && onSelect?.(lead)}
                  >
                    <CardContent className="space-y-1 p-3">
                      <div className="flex items-start gap-1">
                        {isDraggable ? (
                          <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600 transition-colors group-hover:text-slate-400" />
                        ) : (
                          <span className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">{lead.empresaNome}</p>
                          <p className="text-[10px] text-slate-500">{lead.codigo}</p>
                        </div>
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-400" aria-label="A guardar" />
                        ) : null}
                      </div>
                      {lead.contactoNome ? (
                        <p className="truncate text-xs text-slate-400">{lead.contactoNome}</p>
                      ) : null}
                      <p className="text-xs font-medium text-emerald-400/90">{fmtEuro(lead.valorEstimadoCentavos)}</p>
                      {lead.atribuido ? (
                        <p className="text-[10px] text-slate-500">{lead.atribuido.displayName}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}

              {byEstado[estado].length === 0 && !isDropTarget ? (
                <p className="py-6 text-center text-[11px] text-slate-600">Sem leads</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KanbanHelpLink() {
  return (
    <p className="mb-3 text-xs text-slate-500">
      Arraste cartões entre colunas para actualizar o estado - a mudança é guardada automaticamente.{" "}
      <Link href="/portal/crm/config" className="text-violet-400 hover:underline">
        Automatizações
      </Link>{" "}
      disponíveis na configuração CRM.
    </p>
  );
}
