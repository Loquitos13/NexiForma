"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, User } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { credencialStatus, fmtDate } from "@/lib/crm/shared";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "@/components/ui";

export type FormadorDados = {
  id: string;
  nomeCompleto: string;
  nif: string;
  email: string;
  emailPresenca: string | null;
  telefone: string | null;
  morada: string | null;
  ccNumero: string | null;
  ccpNumero: string | null;
  ccValidade: string | null;
  ccpValidade: string | null;
};

type Props = {
  ficha: FormadorDados;
  canManage: boolean;
  onSaved: () => Promise<void> | void;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-slate-500 text-xs block">{label}</span>
      <span className="text-sm text-slate-200">{value || "-"}</span>
    </p>
  );
}

function CredencialBadge({ validade }: { validade: string | null }) {
  const status = credencialStatus(validade);
  const variants = {
    ok: { variant: "green" as const, label: fmtDate(validade) },
    aviso: { variant: "yellow" as const, label: `Expira ${fmtDate(validade)}` },
    critico: {
      variant: "red" as const,
      label: validade ? `Expirado ${fmtDate(validade)}` : "Expirado",
    },
    ausente: { variant: "default" as const, label: "Não registado" },
  };
  const v = variants[status];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export function FormadorFichaDados({ ficha, canManage, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    nomeCompleto: "",
    email: "",
    emailPresenca: "",
    telefone: "",
    morada: "",
    ccNumero: "",
    ccpNumero: "",
    ccValidade: "",
    ccpValidade: "",
  });

  useEffect(() => {
    if (editing) return;
    setForm({
      nomeCompleto: ficha.nomeCompleto,
      email: ficha.email,
      emailPresenca: ficha.emailPresenca ?? "",
      telefone: ficha.telefone ?? "",
      morada: ficha.morada ?? "",
      ccNumero: ficha.ccNumero ?? "",
      ccpNumero: ficha.ccpNumero ?? "",
      ccValidade: ficha.ccValidade ? ficha.ccValidade.slice(0, 10) : "",
      ccpValidade: ficha.ccpValidade ? ficha.ccpValidade.slice(0, 10) : "",
    });
  }, [ficha, editing]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/formadores/${ficha.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        nomeCompleto: form.nomeCompleto.trim(),
        email: form.email.trim(),
        emailPresenca: form.emailPresenca.trim() || null,
        telefone: form.telefone.trim() || null,
        morada: form.morada.trim() || null,
        ccNumero: form.ccNumero.trim() || undefined,
        ccpNumero: form.ccpNumero.trim() || undefined,
        ccValidade: form.ccValidade || undefined,
        ccpValidade: form.ccpValidade || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Ficha actualizada.");
    setEditing(false);
    await onSaved();
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" />
          Contacto e dados
        </CardTitle>
        {canManage && !editing ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {msg ? <Alert variant="success">{msg}</Alert> : null}

        {editing ? (
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Contribuinte (NIF)
                </label>
                <p className="h-9 flex items-center rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 text-sm font-mono text-slate-300">
                  {ficha.nif}
                </p>
              </div>
              <Input
                label="Nome *"
                required
                value={form.nomeCompleto}
                onChange={(e) => setForm((f) => ({ ...f, nomeCompleto: e.target.value }))}
              />
              <Input
                label="Email de contacto"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Email para presença na reunião"
                type="email"
                value={form.emailPresenca}
                onChange={(e) => setForm((f) => ({ ...f, emailPresenca: e.target.value }))}
              />
              <Input
                label="Telefone"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
            <Textarea
              label="Morada"
              rows={2}
              value={form.morada}
              onChange={(e) => setForm((f) => ({ ...f, morada: e.target.value }))}
              placeholder="Rua, código postal, localidade"
            />

            <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-400">
                Credenciais DGERT (documento de identificação / CCP)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Documento identificação n.º"
                  value={form.ccNumero}
                  onChange={(e) => setForm((f) => ({ ...f, ccNumero: e.target.value }))}
                />
                <Input
                  label="Validade documento identificação"
                  type="date"
                  value={form.ccValidade}
                  onChange={(e) => setForm((f) => ({ ...f, ccValidade: e.target.value }))}
                />
                <Input
                  label="CCP n.º"
                  value={form.ccpNumero}
                  onChange={(e) => setForm((f) => ({ ...f, ccpNumero: e.target.value }))}
                />
                <Input
                  label="CCP validade"
                  type="date"
                  value={form.ccpValidade}
                  onChange={(e) => setForm((f) => ({ ...f, ccpValidade: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "A guardar…" : "Guardar"}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
              <Field label="Contribuinte (NIF)" value={ficha.nif} />
              <Field label="Nome" value={ficha.nomeCompleto} />
              <Field label="Email" value={ficha.email} />
              <Field label="Email reunião" value={ficha.emailPresenca ?? "-"} />
              <Field label="Telefone" value={ficha.telefone ?? "-"} />
              <div className="sm:col-span-2">
                <Field label="Morada" value={ficha.morada ?? "-"} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Documento de identificação</p>
                <p className="text-sm text-slate-200">{ficha.ccNumero ?? "-"}</p>
                <div className="mt-1">
                  <CredencialBadge validade={ficha.ccValidade} />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">CCP</p>
                <p className="text-sm text-slate-200">{ficha.ccpNumero ?? "-"}</p>
                <div className="mt-1">
                  <CredencialBadge validade={ficha.ccpValidade} />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
