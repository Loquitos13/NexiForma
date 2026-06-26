"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, GraduationCap, Pencil, ShieldAlert } from "lucide-react";
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
  DataTable,
  Dialog,
  DialogContent,
  Input,
  PageHeader,
  type Column,
} from "@/components/ui";
import { credencialStatus, fmtDate } from "@/lib/crm/shared";

type Formador = {
  id: string;
  nomeCompleto: string;
  nif: string;
  email: string;
  ccNumero: string | null;
  ccpNumero: string | null;
  ccValidade: string | null;
  ccpValidade: string | null;
  _count?: { sessoesFormacao: number };
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

export default function FormadoresPage() {
  const { canManage } = useTenantRole();
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editFormador, setEditFormador] = useState<Formador | null>(null);
  const [form, setForm] = useState({
    ccNumero: "",
    ccpNumero: "",
    ccValidade: "",
    ccpValidade: "",
  });

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

  function openEdit(f: Formador) {
    setEditFormador(f);
    setForm({
      ccNumero: f.ccNumero ?? "",
      ccpNumero: f.ccpNumero ?? "",
      ccValidade: f.ccValidade ? f.ccValidade.slice(0, 10) : "",
      ccpValidade: f.ccpValidade ? f.ccpValidade.slice(0, 10) : "",
    });
    setDialogOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !editFormador) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = await bffFetch(`/api/v1/formadores/${editFormador.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        ccNumero: form.ccNumero.trim() || undefined,
        ccpNumero: form.ccpNumero.trim() || undefined,
        ccValidade: form.ccValidade || undefined,
        ccpValidade: form.ccpValidade || undefined,
      }),
    });
    if (!res.ok) setError(await parseApiError(res));
    else {
      setMsg("Credenciais actualizadas.");
      setDialogOpen(false);
      setEditFormador(null);
      await load();
    }
    setBusy(false);
  }

  const COLS: Column<Formador>[] = [
    {
      key: "nomeCompleto",
      header: "Formador",
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
      cell: (f) => <span className="text-slate-300">{f._count?.sessoesFormacao ?? 0}</span>,
    },
  ];

  const criticos = alertas.filter((a) => a.severidade === "critico").length;

  return (
    <>
      <PageHeader
        title="Formadores"
        description="Gestão de credenciais CC/CCP - requisito DGERT para inspecção e alocação a acções formativas."
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

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

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={COLS}
            data={formadores}
            keyField="id"
            loading={loading}
            emptyMessage="Sem formadores registados neste centro."
            rowActions={
              canManage
                ? (f) => (
                    <Button size="sm" variant="secondary" onClick={() => openEdit(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Credenciais
                    </Button>
                  )
                : undefined
            }
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          title="Credenciais do formador"
          description={editFormador ? editFormador.nomeCompleto : undefined}
        >
          <form onSubmit={(e) => void submit(e)} className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="CC n.º"
                value={form.ccNumero}
                onChange={(ev) => setForm((f) => ({ ...f, ccNumero: ev.target.value }))}
              />
              <Input
                label="CC validade"
                type="date"
                value={form.ccValidade}
                onChange={(ev) => setForm((f) => ({ ...f, ccValidade: ev.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="CCP n.º"
                value={form.ccpNumero}
                onChange={(ev) => setForm((f) => ({ ...f, ccpNumero: ev.target.value }))}
              />
              <Input
                label="CCP validade"
                type="date"
                value={form.ccpValidade}
                onChange={(ev) => setForm((f) => ({ ...f, ccpValidade: ev.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>{busy ? "A guardar…" : "Guardar"}</Button>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
