"use client";

import { LifeBuoy, User } from "lucide-react";
import { formatDatePt } from "@/lib/calendar-date";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

export type PortalTicketRow = {
  id: string;
  ticketRef: string;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
  subject: string;
  bodyPreview: string;
  submitter: {
    email: string;
    displayName: string;
    role: string | null;
    userId?: string | null;
  };
};

const STATUS_META: Record<string, { label: string; variant: "yellow" | "blue" | "green" | "default" }> = {
  OPEN: { label: "Aberto", variant: "yellow" },
  IN_PROGRESS: { label: "Em tratamento", variant: "blue" },
  RESOLVED: { label: "Resolvido", variant: "green" },
  CLOSED: { label: "Fechado", variant: "default" },
};

const ROLE_LABELS: Record<string, string> = {
  tenant_manager: "Gestor",
  formador: "Formador",
  formando: "Formando",
  comercial: "Comercial",
};

function statusBadge(status: string) {
  const meta = STATUS_META[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function sortTickets(tickets: PortalTicketRow[]) {
  const order: Record<string, number> = { OPEN: 0, IN_PROGRESS: 1, RESOLVED: 2, CLOSED: 3 };
  return [...tickets].sort((a, b) => {
    const oa = order[a.status] ?? 9;
    const ob = order[b.status] ?? 9;
    if (oa !== ob) return oa - ob;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function TicketRow({
  ticket,
  showSubmitter,
  onSelect,
}: {
  ticket: PortalTicketRow;
  showSubmitter?: boolean;
  onSelect?: (id: string) => void;
}) {
  const isOpen = ticket.status === "OPEN" || ticket.status === "IN_PROGRESS";
  return (
    <button
      type="button"
      onClick={() => onSelect?.(ticket.id)}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors",
        isOpen ? "border-amber-500/25 bg-amber-950/15 hover:bg-amber-950/25" : "border-slate-700/50 bg-slate-900/40 hover:bg-slate-900/60",
        onSelect ? "cursor-pointer" : "",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-cyan-400">{ticket.ticketRef}</span>
            {statusBadge(ticket.status)}
          </div>
          <h3 className="text-sm font-semibold text-slate-100">{ticket.subject}</h3>
          <p className="text-xs text-slate-500">
            Aberto em {formatDatePt(ticket.createdAt)}
            {ticket.resolvedAt ? ` · Resolvido em ${formatDatePt(ticket.resolvedAt)}` : null}
          </p>
          {showSubmitter ? (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>
                {ticket.submitter.displayName}
                <span className="text-slate-500"> · {ticket.submitter.email}</span>
                {ticket.submitter.role ? (
                  <span className="text-slate-500">
                    {" "}
                    · {ROLE_LABELS[ticket.submitter.role] ?? ticket.submitter.role}
                  </span>
                ) : null}
              </span>
            </p>
          ) : null}
          <p className="line-clamp-2 text-sm text-slate-400">{ticket.bodyPreview}</p>
        </div>
      </div>
    </button>
  );
}

type SupportTicketListProps = {
  tickets: PortalTicketRow[];
  showSubmitter?: boolean;
  loading?: boolean;
  title?: string;
  description?: string;
  emptyMessage?: string;
  onSelectTicket?: (id: string) => void;
};

export function SupportTicketList({
  tickets,
  showSubmitter = false,
  loading = false,
  title = "Os seus tickets",
  description,
  emptyMessage = "Ainda não abriu nenhum pedido de suporte.",
  onSelectTicket,
}: SupportTicketListProps) {
  const sorted = sortTickets(tickets);
  const openTickets = sorted.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
  const closedTickets = sorted.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED");

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-cyan-400" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-800/50" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!sorted.length) return null;

  return (
    <div className="space-y-4">
      {openTickets.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-amber-400" />
              Tickets abertos
              <Badge variant="yellow">{openTickets.length}</Badge>
            </CardTitle>
            {description ? <p className="text-sm text-slate-400">{description}</p> : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {openTickets.map((t) => (
              <TicketRow key={t.id} ticket={t} showSubmitter={showSubmitter} onSelect={onSelectTicket} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {closedTickets.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-300">
              {showSubmitter ? "Histórico da entidade" : "Histórico"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {closedTickets.map((t) => (
              <TicketRow key={t.id} ticket={t} showSubmitter={showSubmitter} onSelect={onSelectTicket} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!openTickets.length && !closedTickets.length ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : null}
    </div>
  );
}
