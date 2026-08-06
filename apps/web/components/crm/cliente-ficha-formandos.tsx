"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { SIGO_HABILITACOES_QNQ, normalizarHabilitacaoQnq } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { NifStatusField, type NifStatus } from "@/components/crm/nif-status-field";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  Input,
} from "@/components/ui";

type FormandoRow = {
  id: string;
  nome: string;
  nif: string;
  email: string | null;
  entidadeClienteId: string | null;
  contaEstado?: string;
  sigoPronto?: boolean;
  _count?: { matriculas: number };
};

type SigoForm = {
  tipoDocIdentificacao: string;
  numDocIdentificacao: string;
  dataNascimento: string;
  nacionalidade: string;
  habilitacaoLiteraria: string;
};

const EMPTY_FORM = { nome: "", nif: "", email: "", emailPresenca: "", telefone: "" };
const EMPTY_SIGO: SigoForm = {
  tipoDocIdentificacao: "CC",
  numDocIdentificacao: "",
  dataNascimento: "",
  nacionalidade: "PT",
  habilitacaoLiteraria: "3",
};

type Props = {
  entidadeId: string;
  canManage: boolean;
};

export function ClienteFichaFormandos({ entidadeId, canManage }: Props) {
  const [associados, setAssociados] = useState<FormandoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sigoForm, setSigoForm] = useState<SigoForm>(EMPTY_SIGO);
  const [nifStatus, setNifStatus] = useState<NifStatus>("idle");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const assocRes = await bffFetch(
      `/api/v1/formandos?entidadeClienteId=${encodeURIComponent(entidadeId)}`,
      { headers: { accept: "application/json" } },
    );
    setLoading(false);
    if (!assocRes.ok) {
      setError(await parseApiError(assocRes));
      return;
    }
    setAssociados((await assocRes.json()) as FormandoRow[]);
  }, [entidadeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sigoGaps = useMemo(() => {
    const gaps: string[] = [];
    if (!sigoForm.tipoDocIdentificacao.trim()) gaps.push("tipo de documento");
    if (!sigoForm.numDocIdentificacao.trim()) gaps.push("n.º documento");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sigoForm.dataNascimento.trim())) gaps.push("data de nascimento");
    if (!/^[A-Z]{2}$/.test(sigoForm.nacionalidade.trim().toUpperCase())) {
      gaps.push("nacionalidade (ISO-2)");
    }
    if (!sigoForm.habilitacaoLiteraria.trim()) gaps.push("habilitações literárias");
    return gaps;
  }, [sigoForm]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setSigoForm({
      ...EMPTY_SIGO,
      habilitacaoLiteraria: normalizarHabilitacaoQnq(EMPTY_SIGO.habilitacaoLiteraria) ?? "3",
    });
    setNifStatus("idle");
    setError(null);
    setDialogOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    if (nifStatus !== "valid") {
      setError("NIF inválido. Tente novamente.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const body = {
      nome: form.nome.trim(),
      nif: form.nif.trim(),
      email: form.email.trim() || undefined,
      emailPresenca: form.emailPresenca.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      entidadeClienteId: entidadeId,
      sigo: {
        tipoDocIdentificacao: sigoForm.tipoDocIdentificacao,
        numDocIdentificacao: sigoForm.numDocIdentificacao.trim() || undefined,
        dataNascimento: sigoForm.dataNascimento.trim() || undefined,
        nacionalidade: sigoForm.nacionalidade.trim().toUpperCase() || undefined,
        habilitacaoLiteraria: sigoForm.habilitacaoLiteraria.trim() || undefined,
      },
    };
    const res = await bffFetch("/api/v1/formandos", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Formando criado e associado a este cliente.");
    setDialogOpen(false);
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">A carregar formandos…</p>;

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {canManage ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <UserPlus className="h-4 w-4" />
            Novo formando
          </Button>
        </div>
      ) : null}

      {associados.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum formando associado. Crie um formando nesta ficha para o ligar automaticamente a
          esta entidade.
        </p>
      ) : (
        <ul className="space-y-2">
          {associados.map((f) => (
            <li key={f.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <Link
                      href={`/portal/formandos/${f.id}`}
                      className="font-medium text-slate-100 hover:text-sky-300"
                    >
                      {f.nome}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">
                      NIF {f.nif}
                      {f.email ? ` · ${f.email}` : ""}
                      {` · ${f._count?.matriculas ?? 0} matrícula(s)`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.sigoPronto ? "green" : "yellow"}>
                      SIGO {f.sigoPronto ? "ok" : "incompleto"}
                    </Badge>
                    <Link href={`/portal/formandos/${f.id}`}>
                      <Button size="sm" variant="secondary">
                        Perfil
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          title="Novo formando neste cliente"
          description="O formando fica automaticamente associado a esta entidade."
        >
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            <Input
              label="Nome *"
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
            <NifStatusField
              label="NIF *"
              value={form.nif}
              onChange={(nif) => setForm((f) => ({ ...f, nif }))}
              tipo="pessoa"
              onStatusChange={setNifStatus}
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
                    value={sigoForm.tipoDocIdentificacao}
                    onChange={(e) =>
                      setSigoForm((s) => ({ ...s, tipoDocIdentificacao: e.target.value }))
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
                  value={sigoForm.numDocIdentificacao}
                  onChange={(e) =>
                    setSigoForm((s) => ({ ...s, numDocIdentificacao: e.target.value }))
                  }
                />
                <Input
                  label="Data nascimento *"
                  type="date"
                  value={sigoForm.dataNascimento}
                  onChange={(e) =>
                    setSigoForm((s) => ({ ...s, dataNascimento: e.target.value }))
                  }
                />
                <Input
                  label="Nacionalidade (ISO-2) *"
                  maxLength={2}
                  value={sigoForm.nacionalidade}
                  onChange={(e) =>
                    setSigoForm((s) => ({
                      ...s,
                      nacionalidade: e.target.value.toUpperCase(),
                    }))
                  }
                />
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    Habilitações literárias (QNQ) *
                  </label>
                  <select
                    value={sigoForm.habilitacaoLiteraria}
                    onChange={(e) =>
                      setSigoForm((s) => ({ ...s, habilitacaoLiteraria: e.target.value }))
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

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={busy}>
                {busy ? "A criar…" : "Criar formando"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
