"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusCircle, Pencil, Trash2, UserRound, Users } from "lucide-react";
import { SIGO_HABILITACOES_QNQ, normalizarHabilitacaoQnq } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { NifStatusField, type NifStatus } from "@/components/crm/nif-status-field";
import {
  Alert, Badge, Button, Card,
  PaginatedDataTable, Dialog, DialogContent, Input, PageHeader, type Column,
} from "@/components/ui";

type Formando = {
  id: string; nome: string; nif: string;
  email: string | null; emailPresenca: string | null;
  emailConta: string | null; emailPresencaEfectivo: string | null;
  telefone: string | null;
  entidadeClienteId?: string | null;
  entidadeCliente?: { id: string; nome: string } | null;
  contaEstado?: "activa" | "convite_pendente" | "sem_conta";
  nifProvisorio?: boolean;
  sigoPronto?: boolean;
  sigo?: {
    tipoDocIdentificacao?: string;
    numDocIdentificacao?: string;
    dataNascimento?: string;
    nacionalidade?: string;
    habilitacaoLiteraria?: string;
  };
  _count?: { matriculas: number };
};

type SigoForm = {
  tipoDocIdentificacao: string;
  numDocIdentificacao: string;
  dataNascimento: string;
  nacionalidade: string;
  habilitacaoLiteraria: string;
};

const EMPTY_SIGO: SigoForm = {
  tipoDocIdentificacao: "CC",
  numDocIdentificacao: "",
  dataNascimento: "",
  nacionalidade: "PT",
  habilitacaoLiteraria: "3",
};

const EMPTY = { nome: "", nif: "", email: "", emailPresenca: "", telefone: "" };

function listSigoGaps(s: SigoForm): string[] {
  const gaps: string[] = [];
  if (!s.tipoDocIdentificacao.trim()) gaps.push("tipo de documento");
  if (!s.numDocIdentificacao.trim()) gaps.push("n.º documento");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.dataNascimento.trim())) gaps.push("data de nascimento");
  if (!/^[A-Z]{2}$/.test(s.nacionalidade.trim().toUpperCase())) gaps.push("nacionalidade (ISO-2)");
  if (!s.habilitacaoLiteraria.trim()) gaps.push("habilitações literárias");
  return gaps;
}

export default function FormandosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canManageFormacao: canManage } = useTenantRole();
  const [formandos, setFormandos] = useState<Formando[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Formando | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [sigoForm, setSigoForm] = useState<SigoForm>(EMPTY_SIGO);
  const [nifStatus, setNifStatus] = useState<NifStatus>("idle");
  const [formandoDocs, setFormandoDocs] = useState<
    Array<{
      id: string;
      nome: string;
      categoria: string | null;
      mimeType: string;
      tamanhoBytes: number;
      createdAt: string;
    }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch("/api/v1/formandos", { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setFormandos((await res.json()) as Formando[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const incompletosSigo = useMemo(
    () => formandos.filter((f) => !f.sigoPronto).length,
    [formandos],
  );
  const sigoGapsDialog = useMemo(() => listSigoGaps(sigoForm), [sigoForm]);

  async function loadFormandoDocs(formandoId: string) {
    const r = await bffFetch(`/api/v1/documentos?formandoId=${encodeURIComponent(formandoId)}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setFormandoDocs([]);
      return;
    }
    const rows = (await r.json()) as Array<{
      id: string;
      nome?: string;
      categoria?: string | null;
      mimeType: string;
      tamanhoBytes: number;
      createdAt: string;
    }>;
    setFormandoDocs(
      rows.map((d) => ({
        id: d.id,
        nome: d.nome ?? "Ficheiro",
        categoria: d.categoria ?? null,
        mimeType: d.mimeType,
        tamanhoBytes: d.tamanhoBytes,
        createdAt: d.createdAt,
      })),
    );
  }

  async function verDocFormando(docId: string) {
    setError(null);
    const r = await bffFetch(`/api/v1/documentos/${docId}/download`);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const openCreate = useCallback(() => {
    setEditId(null);
    setForm(EMPTY);
    setSigoForm(EMPTY_SIGO);
    setNifStatus("idle");
    setFormandoDocs([]);
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    if (!canManage) return;
    const novo = searchParams.get("novo");
    if (novo !== "1" && novo !== "true") return;
    openCreate();
    router.replace("/portal/formandos", { scroll: false });
  }, [searchParams, canManage, router, openCreate]);
  function openEdit(f: Formando) {
    setEditId(f.id);
    setForm({ nome: f.nome, nif: f.nif, email: f.email ?? "", emailPresenca: f.emailPresenca ?? "", telefone: f.telefone ?? "" });
    setSigoForm({
      tipoDocIdentificacao: f.sigo?.tipoDocIdentificacao ?? "CC",
      numDocIdentificacao: f.sigo?.numDocIdentificacao ?? "",
      dataNascimento: f.sigo?.dataNascimento ?? "",
      nacionalidade: f.sigo?.nacionalidade ?? "PT",
      habilitacaoLiteraria: normalizarHabilitacaoQnq(f.sigo?.habilitacaoLiteraria) ?? "3",
    });
    setNifStatus("idle");
    setDialogOpen(true);
    void loadFormandoDocs(f.id);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    if (nifStatus !== "valid") {
      setError("NIF inválido. Tente novamente.");
      return;
    }
    setBusy(true); setMsg(null); setError(null);
    // Confirmação NIF só no backend (Portugal NIF / SIGO stub).
    const body: Record<string, unknown> = {
      nome: form.nome.trim(),
      nif: form.nif.trim(),
      email: form.email.trim() || undefined,
      emailPresenca: form.emailPresenca.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      sigo: {
        tipoDocIdentificacao: sigoForm.tipoDocIdentificacao,
        numDocIdentificacao: sigoForm.numDocIdentificacao.trim() || undefined,
        dataNascimento: sigoForm.dataNascimento.trim() || undefined,
        nacionalidade: sigoForm.nacionalidade.trim().toUpperCase() || undefined,
        habilitacaoLiteraria: sigoForm.habilitacaoLiteraria.trim() || undefined,
      },
    };
    const res = await bffFetch(editId ? `/api/v1/formandos/${editId}` : "/api/v1/formandos", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setError(await parseApiError(res)); }
    else { setMsg(editId ? "Formando actualizado." : "Formando criado."); setDialogOpen(false); await load(); }
    setBusy(false);
  }

  async function confirmDelete() {
    if (!canManage || !deleteTarget) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/formandos/${deleteTarget.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as { matriculasRemovidas?: number; contaDesactivada?: boolean };
    const parts = ["Formando eliminado."];
    if ((data.matriculasRemovidas ?? 0) > 0) {
      parts.push(`${data.matriculasRemovidas} matrícula(s) removida(s).`);
    }
    if (data.contaDesactivada) {
      parts.push("Conta de utilizador desactivada.");
    }
    setMsg(parts.join(" "));
    setDeleteTarget(null);
    await load();
  }

  const COLUMNS: Column<Formando>[] = [
    { key: "nome", header: "Nome", cell: (f) => <span className="font-medium text-slate-100">{f.nome}</span> },
    {
      key: "entidadeCliente",
      header: "Entidade",
      cell: (f) => (
        <span className="text-sm text-slate-300">
          {f.entidadeCliente?.nome ?? <span className="text-slate-500">-</span>}
        </span>
      ),
    },
    {
      key: "contaEstado",
      header: "Conta",
      cell: (f) => (
        <Badge
          variant={
            f.contaEstado === "activa" ? "green" : f.contaEstado === "convite_pendente" ? "yellow" : "default"
          }
        >
          {f.contaEstado === "activa"
            ? "Activa"
            : f.contaEstado === "convite_pendente"
              ? "Convite pendente"
              : "Sem conta"}
        </Badge>
      ),
    },
    {
      key: "sigoPronto",
      header: "SIGO",
      cell: (f) => (
        <Badge variant={f.sigoPronto ? "green" : "yellow"}>
          {f.sigoPronto ? "Completo" : "Incompleto"}
        </Badge>
      ),
    },
    {
      key: "nif",
      header: "NIF",
      cell: (f) => (
        <span className="font-mono text-sm text-slate-300">
          {f.nif}
          {f.nifProvisorio ? (
            <span className="block text-[10px] text-amber-500/90 font-sans">provisório - actualizar</span>
          ) : null}
        </span>
      ),
    },
    { key: "email", header: "Email contacto", cell: (f) => <span className="text-slate-400 text-sm">{f.email ?? "–"}</span> },
    {
      key: "emailPresencaEfectivo",
      header: "Email reunião",
      cell: (f) => (
        <span className="text-slate-300 text-sm">
            {f.emailPresencaEfectivo ?? "–"}
          {f.emailPresencaEfectivo ? (
            f.emailPresenca ? (
              <span className="block text-[10px] text-teal-500/80">definido pelo gestor</span>
            ) : f.emailConta ? (
              <span className="block text-[10px] text-slate-500">conta do tenant</span>
            ) : null
          ) : (
            <span className="block text-[10px] text-amber-500/90">obrigatório p/ online</span>
          )}
        </span>
      ),
    },
    { key: "telefone", header: "Telefone", cell: (f) => <span className="text-slate-400 text-sm">{f.telefone ?? "–"}</span> },
    {
      key: "_count", header: "Matrículas",
      cell: (f) => <Badge variant="default">{f._count?.matriculas ?? 0}</Badge>,
      className: "text-center", headerClassName: "text-center",
    },
  ];

  return (
    <>
      <PageHeader
        title="Formandos"
        description="Registo de participantes – NIF e dados SIGO (documento, nascimento, nacionalidade, habilitações) para export/submissão DGERT."
        actions={canManage ? <Button onClick={openCreate}><PlusCircle className="h-4 w-4" />Novo formando</Button> : null}
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}
      {!loading && incompletosSigo > 0 ? (
        <Alert variant="warning" className="mb-4">
          {incompletosSigo === 1
            ? "1 formando com dados SIGO incompletos - edite o registo antes de exportar ou submeter ao SIGO."
            : `${incompletosSigo} formandos com dados SIGO incompletos - complete documento, data de nascimento, nacionalidade e habilitações.`}
        </Alert>
      ) : null}

      {!loading && formandos.length === 0 ? (
        <Card className="py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="text-slate-400">Ainda não há formandos registados.</p>
          {canManage && <Button className="mt-4" onClick={openCreate}><PlusCircle className="h-4 w-4" />Registar primeiro formando</Button>}
        </Card>
      ) : (
        <PaginatedDataTable
          columns={COLUMNS}
          data={formandos}
          keyField="id"
          loading={loading}
          onRowClick={(f) => router.push(`/portal/formandos/${f.id}`)}
          rowActions={(f) => (
            <div className="flex items-center gap-0.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/portal/formandos/${f.id}`);
                }}
                aria-label="Abrir perfil"
                title="Perfil"
              >
                <UserRound className="h-3.5 w-3.5 text-sky-400" />
              </Button>
              {canManage ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(f);
                    }}
                    aria-label="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(f);
                    }}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </>
              ) : null}
            </div>
          )}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          title={editId ? "Editar formando" : "Novo formando"}
          description="NIF obrigatório, único por tenant e confirmado automaticamente ao guardar."
        >
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            <Input label="Nome *" required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            <NifStatusField
              label="NIF *"
              value={form.nif}
              onChange={(nif) => setForm((f) => ({ ...f, nif }))}
              tipo="pessoa"
              onStatusChange={setNifStatus}
            />
            <Input label="Email de contacto" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <Input
              label="Email para presença na reunião"
              type="email"
              value={form.emailPresenca}
              onChange={(e) => setForm((f) => ({ ...f, emailPresenca: e.target.value }))}
              placeholder="Opcional - sobrepõe o email da conta"
            />
            <p className="text-[11px] text-slate-500 -mt-2 leading-snug">
              Se vazio, o formando deve entrar no Zoom/Teams com o email da conta NexiForma. Se preenchido, só esse
              endereço conta na assiduidade da reunião.
            </p>
            <Input label="Telefone" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-purple-300">Dados SIGO (export / SOAP)</p>
              {sigoGapsDialog.length > 0 ? (
                <p className="text-[11px] text-amber-400/90 leading-snug">
                  Em falta: {sigoGapsDialog.join(", ")}. Sem estes campos a validação SIGO falha.
                </p>
              ) : (
                <p className="text-[11px] text-teal-400/90">Dados SIGO completos para este formando.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tipo documento *</label>
                  <select
                    value={sigoForm.tipoDocIdentificacao}
                    onChange={(e) => setSigoForm((s) => ({ ...s, tipoDocIdentificacao: e.target.value }))}
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
                  onChange={(e) => setSigoForm((s) => ({ ...s, numDocIdentificacao: e.target.value }))}
                />
                <Input
                  label="Data nascimento *"
                  type="date"
                  value={sigoForm.dataNascimento}
                  onChange={(e) => setSigoForm((s) => ({ ...s, dataNascimento: e.target.value }))}
                />
                <Input
                  label="Nacionalidade (ISO-2) *"
                  maxLength={2}
                  value={sigoForm.nacionalidade}
                  onChange={(e) => setSigoForm((s) => ({ ...s, nacionalidade: e.target.value.toUpperCase() }))}
                />
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    Habilitações literárias (QNQ) *
                  </label>
                  <select
                    value={sigoForm.habilitacaoLiteraria}
                    onChange={(e) => setSigoForm((s) => ({ ...s, habilitacaoLiteraria: e.target.value }))}
                    className="w-full rounded-lg bg-slate-800 border border-slate-600 text-sm px-3 py-2 text-slate-200"
                  >
                    {SIGO_HABILITACOES_QNQ.map((h) => (
                      <option key={h.codigo} value={h.codigo}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Níveis do{" "}
                    <a
                      href="https://www.dges.gov.pt/pt/quadro_qualificacoes"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline"
                    >
                      Quadro Nacional de Qualificações (DGES)
                    </a>
                    .
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Necessário para export SIGO e submissão SOAP. Pode guardar incompleto, mas a coluna SIGO
                fica «Incompleto» até preencher tudo.
              </p>
            </div>

            {editId ? (
              <div className="rounded-lg border border-slate-700/40 bg-slate-950/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Documentos do formando
                </p>
                <p className="text-[11px] text-slate-500">
                  Apenas o gestor vê todos os ficheiros. O formando só acede aos seus (com login).
                </p>
                {formandoDocs.length === 0 ? (
                  <p className="text-xs text-slate-500">Ainda sem uploads deste formando.</p>
                ) : (
                  <ul className="space-y-2">
                    {formandoDocs.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-slate-700/30 px-2 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-slate-200 truncate">{d.nome}</p>
                          <p className="text-[10px] text-slate-600">
                            {[d.categoria, d.mimeType].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <Button type="button" size="sm" variant="secondary" onClick={() => void verDocFormando(d.id)}>
                          Ver
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={busy || nifStatus === "checking" || nifStatus !== "valid"}>
                {busy ? (editId ? "A guardar…" : "A criar…") : editId ? "Guardar" : "Criar"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent
          title="Eliminar formando"
          description={
            deleteTarget
              ? `Eliminar ${deleteTarget.nome}? As matrículas (${deleteTarget._count?.matriculas ?? 0}) e documentos associados são removidos.` +
                (deleteTarget.contaEstado === "activa"
                  ? " A conta de utilizador fica desactivada."
                  : deleteTarget.contaEstado === "convite_pendente"
                    ? " O convite pendente é cancelado."
                    : "")
              : undefined
          }
        >
          <div className="flex gap-2 pt-2">
            <Button variant="danger" disabled={busy} onClick={() => void confirmDelete()}>
              {busy ? "A eliminar…" : "Eliminar"}
            </Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
