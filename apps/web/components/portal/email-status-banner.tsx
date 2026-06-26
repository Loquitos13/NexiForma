"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Mail } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { Alert } from "@/components/ui";

type EmailStatus = {
  sendsRealEmail?: boolean;
  provider?: string;
  aviso?: string | null;
};

export function EmailStatusBanner() {
  const { canManage } = useTenantRole();
  const [status, setStatus] = useState<EmailStatus | null>(null);

  useEffect(() => {
    if (!canManage) return;
    void bffFetch("/api/v1/notificacoes/config", { headers: { accept: "application/json" } }).then(
      async (r) => {
        if (!r.ok) return;
        const data = (await r.json()) as { email?: EmailStatus };
        setStatus(data.email ?? null);
      },
    );
  }, [canManage]);

  if (!canManage || !status || status.sendsRealEmail) return null;

  return (
    <Alert variant="warning" className="flex items-start gap-3">
      <Mail className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-amber-200">Email em modo log (desenvolvimento)</p>
        <p className="text-amber-200/80 mt-1 text-xs">
          {status.aviso ??
            "Os convites e alertas não chegam à caixa de correio - só ao log do servidor."}{" "}
          <Link href="/portal/notificacoes" className="underline hover:text-amber-100">
            Ver configuração
          </Link>
        </p>
      </div>
    </Alert>
  );
}

export function EmailBounceAlert() {
  const { canManage } = useTenantRole();
  const [bounces, setBounces] = useState(0);

  useEffect(() => {
    if (!canManage) return;
    void bffFetch("/api/v1/mail/status", { headers: { accept: "application/json" } }).then(
      async (r) => {
        if (!r.ok) return;
        const data = (await r.json()) as { stats?: { bounces30d?: number } };
        setBounces(data.stats?.bounces30d ?? 0);
      },
    );
  }, [canManage]);

  if (!canManage || bounces === 0) return null;

  return (
    <Alert variant="warning" className="flex items-start gap-3">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-200/90">
        <strong>{bounces}</strong> email(s) devolvido(s) nos últimos 30 dias.{" "}
        <Link href="/portal/notificacoes" className="underline">
          Ver detalhes
        </Link>
      </p>
    </Alert>
  );
}
