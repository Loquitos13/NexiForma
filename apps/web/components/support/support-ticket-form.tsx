"use client";

import { useState, type FormEvent } from "react";
import { LifeBuoy, Mail, Building2, CheckCircle2 } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { getAccessToken } from "@/lib/client/access-token";
import { decodeJwtPayload } from "@/lib/client/jwt-role";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type FormProps = {
  defaultSlug?: string;
  defaultEmail?: string;
  displayName?: string;
  authenticated?: boolean;
  onCreated?: () => void;
};

export function SupportTicketForm({
  defaultSlug = "",
  defaultEmail = "",
  displayName = "",
  authenticated = false,
  onCreated,
}: FormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [slug, setSlug] = useState(defaultSlug);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setTicketRef(null);

    const token = getAccessToken();
    const path = token ? "/api/v1/support/tickets" : "/api/v1/public/support/tickets";

    const r = await bffFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email: (authenticated ? defaultEmail : email).trim(),
        slug: (authenticated ? defaultSlug : slug).trim(),
        subject,
        body,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const data = (await r.json().catch(() => ({}))) as { message?: string };
      setError(data.message ?? `HTTP ${r.status}`);
      return;
    }
    const data = (await r.json()) as { ticketRef: string };
    setTicketRef(data.ticketRef);
    setSubject("");
    setBody("");
    onCreated?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="h-4 w-4 text-cyan-400" />
          Abrir novo pedido
        </CardTitle>
        <p className="text-sm text-slate-400">
          Descreva o problema com o máximo de detalhe. Os dados são encriptados e a equipa NexiForma é
          notificada por email.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          {authenticated ? (
            <div className="flex flex-wrap gap-3 rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                {defaultEmail}
              </span>
              {displayName ? (
                <span className="text-slate-400">({displayName})</span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                {defaultSlug}
              </span>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                required
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.pt"
              />
              <Input
                required
                label="Slug do tenant"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="entidade-formadora"
              />
            </div>
          )}

          <Input
            required
            label="Assunto"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex.: Erro ao emitir certificado"
            minLength={3}
            maxLength={200}
          />

          <div className="space-y-1.5">
            <Textarea
              required
              label="Descrição do problema"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Indique o que estava a fazer, mensagens de erro e passos para reproduzir…"
              minLength={10}
              maxLength={8000}
              rows={6}
              className="min-h-[140px]"
            />
            <p className="text-right text-xs text-slate-500">{body.length} / 8000</p>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </div>
          ) : null}
          {ticketRef ? (
            <div
              role="status"
              className={cn(
                "rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Ticket <strong className="font-mono">{ticketRef}</strong> aberto. A equipa NexiForma foi
                notificada.
              </span>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? "A enviar…" : "Enviar pedido"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Preenche dados a partir do JWT e sessão quando disponível. */
export function SupportTicketFormAutofill({
  onCreated,
  displayName,
}: {
  onCreated?: () => void;
  displayName?: string;
}) {
  const token = typeof window !== "undefined" ? getAccessToken() : null;
  const payload = decodeJwtPayload(token);
  const slug = payload?.tenantSlug ?? "";
  const email = payload?.email ?? "";

  return (
    <SupportTicketForm
      defaultSlug={slug}
      defaultEmail={email}
      displayName={displayName}
      authenticated={Boolean(token)}
      onCreated={onCreated}
    />
  );
}
