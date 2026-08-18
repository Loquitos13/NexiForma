"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, User } from "lucide-react";
import {
  SIGO_HABILITACOES_QNQ,
  labelHabilitacaoQnq,
  normalizarHabilitacaoQnq,
} from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

type ClienteOpt = { id: string; nome: string; nif: string };

export type FormandoSigo = {
  tipoDocIdentificacao?: string;
  numDocIdentificacao?: string;
  validadeDocumento?: string;
  dataNascimento?: string;
  nacionalidade?: string;
  habilitacaoLiteraria?: string;
};

export type FormandoDados = {
  id: string;
  nome: string;
  nif: string;
  email: string | null;
  emailPresenca: string | null;
  telefone: string | null;
  morada: string | null;
  entidadeCliente: { id: string; nome: string; nif: string } | null;
  sigo: FormandoSigo;
  sigoPronto: boolean;
};

type Props = {
  ficha: FormandoDados;
  canManage: boolean;
  onSaved: () => Promise<void> | void;
  /** Requisito DGERT a focar (ex. nifs_formandos). */
  focusRequisito?: string | null;
};

const DOC_LABELS: Record<string, string> = {
  CC: "Cartão de Cidadão",
  PAS: "Passaporte",
  BI: "BI",
  C: "Cartão de Cidadão",
  P: "Passaporte",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-slate-500 text-xs block">{label}</span>
      <span className="text-sm text-slate-200">{value || "-"}</span>
    </p>
  );
}

export function FormandoFichaDados({
  ficha,
  canManage,
  onSaved,
  focusRequisito = null,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [atribuirEntidadeId, setAtribuirEntidadeId] = useState("");
  const focusNif = focusRequisito === "nifs_formandos";
  const [form, setForm] = useState({
    nome: "",
    nif: "",
    email: "",
    telefone: "",
    morada: "",
    entidadeClienteId: "",
    tipoDocIdentificacao: "CC",
    numDocIdentificacao: "",
    validadeDocumento: "",
    dataNascimento: "",
    nacionalidade: "PT",
    habilitacaoLiteraria: "3",
  });

  useEffect(() => {
    if (!canManage) return;
    void bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } }).then(
      async (res) => {
        if (!res.ok) return;
        const rows = (await res.json()) as ClienteOpt[];
        setClientes(rows);
      },
    );
  }, [canManage]);

  useEffect(() => {
    if (editing) return;
    setForm({
      nome: ficha.nome,
      nif: ficha.nif,
      email: ficha.email ?? "",
      telefone: ficha.telefone ?? "",
      morada: ficha.morada ?? "",
      entidadeClienteId: ficha.entidadeCliente?.id ?? "",
      tipoDocIdentificacao: ficha.sigo.tipoDocIdentificacao ?? "CC",
      numDocIdentificacao: ficha.sigo.numDocIdentificacao ?? "",
      validadeDocumento: ficha.sigo.validadeDocumento ?? "",
      dataNascimento: ficha.sigo.dataNascimento ?? "",
      nacionalidade: ficha.sigo.nacionalidade ?? "PT",
      habilitacaoLiteraria: normalizarHabilitacaoQnq(ficha.sigo.habilitacaoLiteraria) ?? "3",
    });
    setAtribuirEntidadeId("");
  }, [ficha, editing]);

  useEffect(() => {
    if (canManage && focusNif) setEditing(true);
  }, [canManage, focusNif]);

  const sigoGaps = useMemo(() => {
    const gaps: string[] = [];
    if (!form.tipoDocIdentificacao.trim()) gaps.push("tipo de documento");
    if (!form.numDocIdentificacao.trim()) gaps.push("n.º documento");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dataNascimento.trim())) gaps.push("data de nascimento");
    if (!/^[A-Z]{2}$/.test(form.nacionalidade.trim().toUpperCase())) {
      gaps.push("nacionalidade");
    }
    if (!form.habilitacaoLiteraria.trim()) gaps.push("habilitações");
    return gaps;
  }, [form]);

  function startEdit() {
    setError(null);
    setMsg(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/formandos/${ficha.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        nome: form.nome.trim(),
        nif: form.nif.replace(/\s/g, "").trim(),
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        morada: form.morada.trim() || null,
        entidadeClienteId: form.entidadeClienteId.trim() || null,
        sigo: {
          tipoDocIdentificacao: form.tipoDocIdentificacao,
          numDocIdentificacao: form.numDocIdentificacao.trim() || undefined,
          validadeDocumento: form.validadeDocumento.trim() || undefined,
          dataNascimento: form.dataNascimento.trim() || undefined,
          nacionalidade: form.nacionalidade.trim().toUpperCase() || undefined,
          habilitacaoLiteraria: form.habilitacaoLiteraria.trim() || undefined,
        },
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

  async function atribuirEntidade() {
    if (!canManage || !atribuirEntidadeId) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/formandos/${ficha.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ entidadeClienteId: atribuirEntidadeId }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Entidade associada ao formando.");
    await onSaved();
  }

  const docLabel =
    DOC_LABELS[ficha.sigo.tipoDocIdentificacao ?? ""] ?? ficha.sigo.tipoDocIdentificacao ?? "-";

  const entidadeFieldView = (
    <div>
      <span className="text-slate-500 text-xs block">Entidade</span>
      {ficha.entidadeCliente ? (
        <span className="text-sm text-slate-200">
          <Link
            href={`/portal/clientes/${ficha.entidadeCliente.id}`}
            className="text-sky-400 hover:underline"
          >
            {ficha.entidadeCliente.nome}
          </Link>
          <span className="block text-xs text-slate-500 mt-0.5">
            NIF {ficha.entidadeCliente.nif}
          </span>
        </span>
      ) : canManage ? (
        <div className="mt-1 space-y-2">
          <p className="text-sm text-amber-300/90">Sem entidade associada</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <Select
                label="Atribuir cliente existente"
                value={atribuirEntidadeId}
                onChange={(e) => setAtribuirEntidadeId(e.target.value)}
              >
                <option value="">Seleccionar cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} · NIF {c.nif}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={busy || !atribuirEntidadeId}
              onClick={() => void atribuirEntidade()}
            >
              Associar
            </Button>
          </div>
          {clientes.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Ainda não há clientes.{" "}
              <Link href="/portal/clientes" className="text-sky-400 hover:underline">
                Criar no CRM
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <span className="text-sm text-amber-300/90">Sem entidade associada</span>
      )}
    </div>
  );

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" />
          Contacto e dados
        </CardTitle>
        {canManage && !editing ? (
          <Button size="sm" variant="secondary" onClick={startEdit}>
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
              <Select
                label="Entidade (cliente)"
                value={form.entidadeClienteId}
                onChange={(e) => setForm((f) => ({ ...f, entidadeClienteId: e.target.value }))}
              >
                <option value="">Sem entidade</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} · NIF {c.nif}
                  </option>
                ))}
              </Select>
              <div
                data-dgert-target="formando_nif"
                className={cn(
                  focusNif &&
                    "rounded-lg ring-2 ring-amber-400/55 ring-offset-2 ring-offset-slate-950 p-2 -m-2",
                )}
              >
                <Input
                  label="Contribuinte (NIF) *"
                  required
                  inputMode="numeric"
                  pattern="\d{9}"
                  maxLength={9}
                  value={form.nif}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      nif: e.target.value.replace(/[^\d]/g, "").slice(0, 9),
                    }))
                  }
                  className="font-mono tracking-wide"
                />
              </div>
              <Input
                label="Nome *"
                required
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-purple-300">Dados SIGO</p>
              {sigoGaps.length > 0 ? (
                <p className="text-[11px] text-amber-400/90">Em falta: {sigoGaps.join(", ")}.</p>
              ) : (
                <p className="text-[11px] text-teal-400/90">Dados SIGO completos.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tipo documento *</label>
                  <select
                    value={form.tipoDocIdentificacao}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tipoDocIdentificacao: e.target.value }))
                    }
                    className="w-full rounded-lg bg-slate-800 border border-slate-600 text-sm px-3 py-2 text-slate-200"
                  >
                    <option value="CC">Cartão de Cidadão (CC)</option>
                    <option value="PAS">Passaporte (PAS)</option>
                    <option value="BI">BI (BI)</option>
                  </select>
                </div>
                <Input
                  label="N.º documento *"
                  value={form.numDocIdentificacao}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, numDocIdentificacao: e.target.value }))
                  }
                />
                <Input
                  label="Validade documento"
                  type="date"
                  value={form.validadeDocumento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, validadeDocumento: e.target.value }))
                  }
                />
                <Input
                  label="Data nascimento *"
                  type="date"
                  value={form.dataNascimento}
                  onChange={(e) => setForm((f) => ({ ...f, dataNascimento: e.target.value }))}
                />
                <Input
                  label="Nacionalidade (ISO-2) *"
                  maxLength={2}
                  value={form.nacionalidade}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nacionalidade: e.target.value.toUpperCase() }))
                  }
                />
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    Habilitações literárias (QNQ) *
                  </label>
                  <select
                    value={form.habilitacaoLiteraria}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, habilitacaoLiteraria: e.target.value }))
                    }
                    className="w-full rounded-lg bg-slate-800 border border-slate-600 text-sm px-3 py-2 text-slate-200"
                  >
                    {SIGO_HABILITACOES_QNQ.map((h) => (
                      <option key={h.codigo} value={h.codigo}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "A guardar…" : "Guardar"}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={cancelEdit}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
              {entidadeFieldView}
              <div data-dgert-target="formando_nif">
                <Field label="Contribuinte (NIF)" value={ficha.nif} />
              </div>
              <Field label="Nome" value={ficha.nome} />
              <Field label="Email" value={ficha.email ?? "-"} />
              <Field label="Telefone" value={ficha.telefone ?? "-"} />
              <div className="sm:col-span-2">
                <Field label="Morada" value={ficha.morada ?? "-"} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-400">Dados SIGO</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Documento" value={docLabel} />
                <Field label="N.º documento" value={ficha.sigo.numDocIdentificacao ?? "-"} />
                <Field
                  label="Validade documento"
                  value={
                    ficha.sigo.validadeDocumento
                      ? formatDatePt(ficha.sigo.validadeDocumento)
                      : "-"
                  }
                />
                <Field
                  label="Data de nascimento"
                  value={
                    ficha.sigo.dataNascimento
                      ? formatDatePt(ficha.sigo.dataNascimento)
                      : "-"
                  }
                />
                <Field label="Nacionalidade" value={ficha.sigo.nacionalidade ?? "-"} />
                <div className="sm:col-span-2">
                  <Field
                    label="Habilitações literárias"
                    value={labelHabilitacaoQnq(ficha.sigo.habilitacaoLiteraria)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
