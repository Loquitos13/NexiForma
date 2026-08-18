"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, GraduationCap, Pencil, PlusCircle, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { NifStatusField, type NifStatus } from "@/components/crm/nif-status-field";
import { DgertRequisitoBanner, DgertTarget } from "@/components/portal/dgert-requisito-banner";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  Input,
  PaginatedDataTable,
  PageHeader,
  type Column,
} from "@/components/ui";
import { credencialStatus, fmtDate } from "@/lib/crm/shared";
import { cn } from "@/lib/ui/cn";

type Formador = {
  id: string;
  nomeCompleto: string;
  nif: string;
  email: string;
  emailPresenca?: string | null;
  telefone?: string | null;
  morada?: string | null;
  ccNumero: string | null;
  ccpNumero: string | null;
  ccValidade: string | null;
  ccpValidade: string | null;
  _count?: { sessoesFormacao: number; documentos?: number };
};

type Alerta = {
  id: string;
  nomeCompleto: string;
  tipo: "cc" | "ccp";
  validade: string;
  diasRestantes: number;
  severidade: "critico" | "aviso";
};

function CredencialBadge({ validade }: { validade: string | null }) {
  const status = credencialStatus(validade);
  const variants = {
    ok: { variant: "green" as const, label: fmtDate(validade) },
    aviso: { variant: "yellow" as const, label: `Expira ${fmtDate(validade)}` },
    critico: { variant: "red" as const, label: validade ? `Expirado ${fmtDate(validade)}` : "Expirado" },
    ausente: { variant: "default" as const, label: "Não registado" },
  };
  const v = variants[status];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

const EMPTY_FORM = {
  nomeCompleto: "",
  nif: "",
  email: "",
  telefone: "",
  morada: "",
  ccNumero: "",
  ccValidade: "",
};

export default function FormadoresPage() {
  const router = useRouter();
  const { canManageFormacao: canManage } = useTenantRole();
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Formador | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [nifStatus, setNifStatus] = useState<NifStatus>("idle");

  const load = useCallback(async () => {
    setLoading(true);
    const [fRes, aRes] = await Promise.all([
      bffFetch("/api/v1/formadores", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/formadores/alertas-cc", { headers: { accept: "application/json" } }),
    ]);
    if (!fRes.ok) setError(await parseApiError(fRes));
    else setFormadores((await fRes.json()) as Formador[]);
    if (aRes.ok) {
      const data = (await aRes.json()) as { alertas: Alerta[] };
      setAlertas(data.alertas ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage || nifStatus !== "valid") return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/formadores", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const created = (await r.json()) as Formador;
    setDialogOpen(false);
    setForm(EMPTY_FORM);
    setNifStatus("idle");
    setMsg(
      "Formador registado. Foi enviada uma password temporária ao email do formador e uma cópia a quem efectuou o registo.",
    );
    await load();
    router.push(`/portal/formadores/${created.id}`);
  }

  async function confirmDelete() {
    if (!canManage || !deleteTarget) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/formadores/${deleteTarget.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const data = (await res.json()) as {
      sessoesDesatribuidas?: number;
      documentosRemovidos?: number;
      contaDesactivada?: boolean;
    };
    const parts = ["Formador eliminado."];
    if ((data.sessoesDesatribuidas ?? 0) > 0) {
      parts.push(`${data.sessoesDesatribuidas} sessão(ões) ficaram sem formador atribuído.`);
    }
    if ((data.documentosRemovidos ?? 0) > 0) {
      parts.push(`${data.documentosRemovidos} documento(s) removido(s).`);
    }
    if (data.contaDesactivada) {
      parts.push("Conta de utilizador desactivada.");
    }
    setMsg(parts.join(" "));
    setDeleteTarget(null);
    await load();
  }

  const COLS: Column<Formador>[] = [
    {
      key: "nomeCompleto",
      header: "Formador",
      sortable: true,
      sortValue: (f) => f.nomeCompleto,
      cell: (f) => (
        <div>
          <span className="font-medium text-slate-100">{f.nomeCompleto}</span>
          <p className="text-xs text-slate-500 mt-0.5">
            NIF {f.nif} · {f.email}
          </p>
        </div>
      ),
    },
    {
      key: "ccNumero",
      header: "Carta de Condução",
      sortable: true,
      hideOnMobile: true,
      sortValue: (f) => f.ccValidade ?? "",
      cell: (f) => (
        <div className="text-sm space-y-1">
          <p className="text-slate-400">{f.ccNumero ?? "-"}</p>
          <CredencialBadge validade={f.ccValidade} />
        </div>
      ),
    },
    {
      key: "ccpNumero",
      header: "CCP",
      sortable: true,
      hideOnMobile: true,
      sortValue: (f) => f.ccpValidade ?? "",
      cell: (f) => (
        <div className="text-sm space-y-1">
          <p className="text-slate-400">{f.ccpNumero ?? "-"}</p>
          <CredencialBadge validade={f.ccpValidade} />
        </div>
      ),
    },
    {
      key: "sessoes",
      header: "Sessões",
      sortable: true,
      sortValue: (f) => f._count?.sessoesFormacao ?? 0,
      cell: (f) => <span className="text-slate-300">{f._count?.sessoesFormacao ?? 0}</span>,
    },
    {
      key: "documentos",
      header: "Docs",
      sortable: true,
      sortValue: (f) => f._count?.documentos ?? 0,
      cell: (f) => <Badge variant="default">{f._count?.documentos ?? 0}</Badge>,
    },
  ];

  const criticos = alertas.filter((a) => a.severidade === "critico").length;

  return (
    <>
      <PageHeader
        title="Formadores"
        description="Perfil, contacto e documentos dos formadores - CC/CCP e ficheiros para DGERT."
        actions={
          canManage ? (
            <Button onClick={() => setDialogOpen(true)} data-guided-flow-anchor="novo-formador">
              <PlusCircle className="h-4 w-4" />
              Novo formador
            </Button>
          ) : null
        }
      />

      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <DgertRequisitoBanner backHref="/portal/dossie" />

      {alertas.length > 0 && (
        <Card className="mb-6 border-yellow-700/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {criticos > 0 ? (
                <ShieldAlert className="h-4 w-4 text-red-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              )}
              Alertas de renovação
              <Badge variant={criticos > 0 ? "red" : "yellow"}>{alertas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {alertas.map((a) => (
                <li
                  key={`${a.id}-${a.tipo}`}
                  className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">
                    <GraduationCap className="inline h-3.5 w-3.5 mr-1.5 text-slate-500" />
                    {a.nomeCompleto}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severidade === "critico" ? "red" : "yellow"}>
                      {a.tipo.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {a.diasRestantes < 0
                        ? "Expirado"
                        : `${a.diasRestantes} dias · ${a.validade}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <DgertTarget id="formadores_lista">
        <Card>
          <CardContent className="p-0">
            <PaginatedDataTable
              columns={COLS}
              data={formadores}
              keyField="id"
              loading={loading}
              getRowHref={(f) => `/portal/formadores/${f.id}`}
              emptyMessage="Sem formadores registados neste centro."
              rowActions={(f) => (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Abrir perfil"
                    title="Perfil"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/portal/formadores/${f.id}`);
                    }}
                  >
                    <UserRound className="h-3.5 w-3.5 text-sky-400" />
                  </Button>
                  {canManage ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Editar"
                        title="Editar dados"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/portal/formadores/${f.id}`);
                        }}
                        className={cn(
                          !f.ccNumero?.trim() &&
                            !f.ccpNumero?.trim() &&
                            "ring-1 ring-amber-400/50",
                        )}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Eliminar"
                        title="Eliminar formador"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(f);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </>
                  ) : null}
                </>
              )}
            />
          </CardContent>
        </Card>
      </DgertTarget>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title="Novo formador">
          <form onSubmit={(e) => void submitCreate(e)} className="grid gap-4">
            <Input
              label="Nome completo *"
              value={form.nomeCompleto}
              onChange={(e) => setForm((f) => ({ ...f, nomeCompleto: e.target.value }))}
              required
            />
            <NifStatusField
              value={form.nif}
              onChange={(nif) => setForm((f) => ({ ...f, nif }))}
              onStatusChange={setNifStatus}
            />
            <Input
              label="Email *"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
            <Input
              label="Telemóvel *"
              value={form.telefone}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              required
            />
            <Input
              label="Morada fiscal *"
              value={form.morada}
              onChange={(e) => setForm((f) => ({ ...f, morada: e.target.value }))}
              required
            />
            <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-400">Documento de identificação</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="N.º documento"
                  value={form.ccNumero}
                  onChange={(e) => setForm((f) => ({ ...f, ccNumero: e.target.value }))}
                  placeholder="Ex.: 12345678 0 ZX3"
                />
                <Input
                  label="Validade"
                  type="date"
                  value={form.ccValidade}
                  onChange={(e) => setForm((f) => ({ ...f, ccValidade: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Será criada automaticamente uma conta NexiForma e enviada uma password temporária a este
              endereço (cópia para quem efectua o registo). O formador deve carregar CV, CCP, documento
              de identificação e ficha curricular DGERT no perfil.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || nifStatus !== "valid"}>
                {busy ? "A registar…" : "Registar formador"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent
          title="Eliminar formador"
          description={
            deleteTarget
              ? `Eliminar ${deleteTarget.nomeCompleto}? Os documentos (${deleteTarget._count?.documentos ?? 0}) são removidos` +
                (deleteTarget._count?.sessoesFormacao
                  ? ` e ${deleteTarget._count.sessoesFormacao} sessão(ões) ficam sem formador atribuído`
                  : "") +
                ". A conta de utilizador fica desactivada."
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
