"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, User } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import { Badge, Button, Dialog, DialogContent } from "@/components/ui";
import type { PortalTicketRow } from "./support-ticket-list";

const STATUS_META: Record<string, { label: string; variant: "yellow" | "blue" | "green" | "default" }> = {
  OPEN: { label: "Aberto", variant: "yellow" },
  IN_PROGRESS: { label: "Em tratamento", variant: "blue" },
  RESOLVED: { label: "Resolvido", variant: "green" },
  CLOSED: { label: "Fechado", variant: "default" },
};

type TicketDetail = PortalTicketRow & { body: string };

type Props = {
  ticketId: string | null;
  onClose: () => void;
  showSubmitter?: boolean;
};

export function SupportTicketDetailDialog({ ticketId, onClose, showSubmitter }: Props) {
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    const res = await bffFetch(`/api/v1/support/tickets/${ticketId}`, {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setDetail((await res.json()) as TicketDetail);
  }, [ticketId]);

  useEffect(() => {
    if (ticketId) void load();
    else setDetail(null);
  }, [ticketId, load]);

  const meta = detail ? STATUS_META[detail.status] : null;

  return (
    <Dialog open={!!ticketId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={detail?.subject ?? "Ticket de suporte"} className="max-w-lg">

        {loading ? <p className="text-sm text-slate-500">A carregar…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {detail ? (
          <div className="space-y-4 -mt-2">
            <div className="flex flex-wrap items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-xs text-cyan-300">{detail.ticketRef}</span>
              {meta ? <Badge variant={meta.variant}>{meta.label}</Badge> : null}
            </div>
            <p className="text-xs text-slate-500">
              Aberto em {formatDatePt(detail.createdAt)}
              {detail.resolvedAt ? ` · Resolvido em ${formatDatePt(detail.resolvedAt)}` : null}
            </p>
            {showSubmitter ? (
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <User className="h-3.5 w-3.5" />
                {detail.submitter.displayName} · {detail.submitter.email}
              </p>
            ) : null}
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
              <p className="whitespace-pre-wrap text-sm text-slate-300">{detail.body}</p>
            </div>
            <p className="text-xs text-slate-500">
              A equipa NexiForma responde por email. Alterações de estado são tratadas pela plataforma.
            </p>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
