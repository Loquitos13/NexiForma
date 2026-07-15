"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { PageHeader } from "@/components/ui";
import { SupportTicketDetailDialog } from "@/components/support/support-ticket-detail";
import { SupportTicketFormAutofill } from "@/components/support/support-ticket-form";
import {
  SupportTicketList,
  type PortalTicketRow,
} from "@/components/support/support-ticket-list";

type MeProfile = {
  email?: string;
  displayName?: string | null;
};

export default function PortalSuportePage() {
  const { canManage } = useTenantRole();
  const [tickets, setTickets] = useState<PortalTicketRow[]>([]);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ticketsRes, meRes] = await Promise.all([
      bffFetch("/api/v1/support/tickets", { headers: { accept: "application/json" } }),
      bffFetch("/api/auth/me", { headers: { accept: "application/json" } }),
    ]);
    if (!ticketsRes.ok) {
      setError(`Não foi possível carregar os tickets (HTTP ${ticketsRes.status}).`);
      setLoading(false);
      return;
    }
    setTickets((await ticketsRes.json()) as PortalTicketRow[]);
    if (meRes.ok) setProfile((await meRes.json()) as MeProfile);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCount = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Suporte NexiForma"
        description={
          canManage
            ? "Consulte todos os pedidos da entidade ou abra um novo ticket. A equipa NexiForma responde por email."
            : "Consulte os seus pedidos em aberto ou descreva um novo problema. A equipa NexiForma responde por email."
        }
      />

      {error ? (
        <div className="rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {canManage ? (
        <SupportTicketList
          tickets={tickets}
          showSubmitter
          loading={loading}
          title="Tickets da entidade"
          description={`${openCount} em aberto · ${tickets.length} no total`}
          emptyMessage="Ainda não há pedidos de suporte nesta entidade."
          onSelectTicket={setSelectedTicketId}
        />
      ) : (
        <SupportTicketList
          tickets={tickets}
          loading={loading}
          title="Os seus tickets"
          description={openCount > 0 ? `${openCount} pedido(s) em aberto` : undefined}
          onSelectTicket={setSelectedTicketId}
        />
      )}

      <SupportTicketDetailDialog
        ticketId={selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        showSubmitter={canManage}
      />

      <SupportTicketFormAutofill
        displayName={profile?.displayName ?? undefined}
        onCreated={() => void load()}
      />
    </div>
  );
}
