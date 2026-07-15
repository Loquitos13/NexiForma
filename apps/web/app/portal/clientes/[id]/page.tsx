"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, Pencil } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { PortalBackButton } from "@/components/ui/portal-back-button";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { EntidadeCrmInsights } from "@/components/crm/entidade-crm-insights";
import { ClienteFichaLeads } from "@/components/crm/cliente-ficha-leads";
import { ClienteFichaSugestoes } from "@/components/crm/cliente-ficha-sugestoes";
import {
  ClienteFichaNav,
  parseClienteFichaTab,
  type ClienteFichaTab,
} from "@/components/crm/cliente-ficha-nav";
import { ClienteFichaDados } from "@/components/crm/cliente-ficha-dados";
import { ClienteFichaFaturas } from "@/components/crm/cliente-ficha-faturas";
import { ClienteFichaPropostas } from "@/components/crm/cliente-ficha-propostas";
import { useClienteFichaData } from "@/components/crm/use-cliente-ficha-data";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";

type Cliente = {
  id: string;
  nif: string;
  nome: string;
  moradaFiscal: string | null;
  email: string | null;
  telefone: string | null;
  _count?: { propostas: number };
};

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseClienteFichaTab(searchParams.get("tab"));
  const { canManageCrm, canManage } = useTenantRole();
  const { entitlements } = useTenantEntitlements();
  const hasCrmMod = entitlements?.canAccessCrm ?? canManageCrm;
  const hasFaturacaoMod = entitlements?.canAccessFaturacao ?? false;
  const canGerirClientes = canManage || hasCrmMod || hasFaturacaoMod;
  const canVerCrmFicha = canGerirClientes;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    nif: "",
    nome: "",
    moradaFiscal: "",
    email: "",
    telefone: "",
  });

  const { data: ficha, loading: fichaLoading, refresh: refreshFicha } = useClienteFichaData(
    id,
    canVerCrmFicha,
    canManage,
  );

  useEffect(() => {
    if (tab === "faturas" && !canManage) {
      router.replace(`/portal/clientes/${id}?tab=dados`);
    }
  }, [tab, canManage, id, router]);

  useEffect(() => {
    if (
      tab === "notas-comerciais" ||
      tab === "sugestoes-ia" ||
      tab === "leads" ||
      tab === "dados"
    ) {
      void refreshFicha();
    }
  }, [tab, refreshFicha]);

  const setTab = useCallback(
    (next: ClienteFichaTab) => {
      const q = new URLSearchParams(searchParams.toString());
      if (next === "dados") q.delete("tab");
      else q.set("tab", next);
      const qs = q.toString();
      router.replace(qs ? `/portal/clientes/${id}?${qs}` : `/portal/clientes/${id}`, {
        scroll: false,
      });
    },
    [id, router, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch(`/api/v1/entidades-cliente/${id}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) setError(await parseApiError(res));
    else setCliente((await res.json()) as Cliente);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [load, id]);

  function fillForm(c: Cliente) {
    setForm({
      nif: c.nif,
      nome: c.nome,
      moradaFiscal: c.moradaFiscal ?? "",
      email: c.email ?? "",
      telefone: c.telefone ?? "",
    });
  }

  function openEditDialog() {
    if (!cliente) return;
    fillForm(cliente);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!cliente || !canGerirClientes) return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("editar") === "1") {
      fillForm(cliente);
      setDialogOpen(true);
      urlParams.delete("editar");
      const qs = urlParams.toString();
      window.history.replaceState({}, "", qs ? `/portal/clientes/${cliente.id}?${qs}` : `/portal/clientes/${cliente.id}`);
    }
  }, [cliente, canGerirClientes]);

  function closeEditDialog() {
    setDialogOpen(false);
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!canGerirClientes || !cliente) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const body = {
      nome: form.nome.trim(),
      moradaFiscal: form.moradaFiscal.trim(),
      email: form.email.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
    };
    const res = await bffFetch(`/api/v1/entidades-cliente/${cliente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Cliente actualizado.");
    setDialogOpen(false);
    await load();
  }

  if (loading) {
    return <PageContentSkeleton variant="detail" />;
  }

  if (error && !cliente) {
    return (
      <>
        <PortalBackButton fallbackHref="/portal/clientes" fallbackLabel="Clientes" />
        <Alert variant="error">{error ?? "Cliente não encontrado."}</Alert>
      </>
    );
  }

  if (!cliente) {
    return (
      <>
        <PortalBackButton fallbackHref="/portal/clientes" fallbackLabel="Clientes" />
        <Alert variant="error">Cliente não encontrado.</Alert>
      </>
    );
  }

  return (
    <>
      <PortalBackButton fallbackHref="/portal/clientes" fallbackLabel="Clientes" />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <PageHeader
        title={cliente.nome}
        description={`NIF ${cliente.nif}`}
        actions={
          canGerirClientes ? (
            <Button size="sm" variant="secondary" onClick={openEditDialog}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          ) : null
        }
      />

      {canVerCrmFicha ? (
        <>
          <ClienteFichaNav
            active={tab}
            onChange={setTab}
            showCrmTabs={hasCrmMod}
            showFaturacaoTabs={hasFaturacaoMod && canManage}
            badges={{
              faturas: ficha.faturas.length,
              propostas: ficha.propostas.length,
              leads: ficha.leadsCount,
              notas: ficha.interaccoes.length,
              sugestoes: ficha.sugestoesPendentes,
            }}
          />

          {tab === "dados" ? (
            <ClienteFichaDados cliente={cliente} ficha={ficha} loading={fichaLoading} />
          ) : null}

          {tab === "faturas" && hasFaturacaoMod && canManage ? (
            <ClienteFichaFaturas
              entidadeId={cliente.id}
              faturas={ficha.faturas}
              loading={fichaLoading}
              canCreate={canManage}
            />
          ) : null}

          {tab === "propostas" && hasCrmMod ? (
            <ClienteFichaPropostas
              entidadeId={cliente.id}
              propostas={ficha.propostas}
              loading={fichaLoading}
              showAutoria={canManageCrm}
            />
          ) : null}

          {tab === "leads" && hasCrmMod && canManageCrm ? (
            <ClienteFichaLeads entidadeId={cliente.id} />
          ) : null}

          {tab === "notas-comerciais" && hasCrmMod && canManageCrm ? (
            <EntidadeCrmInsights
              entidadeClienteId={cliente.id}
              contextoNome={cliente.nome}
              onMutate={() => void refreshFicha()}
            />
          ) : null}

          {tab === "sugestoes-ia" && hasCrmMod && canManageCrm ? (
            <ClienteFichaSugestoes entidadeId={cliente.id} />
          ) : null}
        </>
      ) : (
        <ClienteFichaDados
          cliente={cliente}
          ficha={{
            propostas: [],
            faturas: [],
            interaccoes: [],
            sugestoesPendentes: 0,
            leadsCount: 0,
            sugestoesTotal: 0,
          }}
          loading={false}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeEditDialog())}>
        <DialogContent
          title="Editar cliente"
          description="Dados obrigatórios para faturação e propostas comerciais."
        >
          <form onSubmit={(e) => void submitEdit(e)} className="grid gap-4">
            <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
              <Building2 className="inline h-4 w-4 mr-1.5 text-slate-500" />
              NIF {form.nif} (não editável)
            </div>
            <Input
              label="Nome comercial completo *"
              required
              value={form.nome}
              onChange={(ev) => setForm((f) => ({ ...f, nome: ev.target.value }))}
            />
            <Textarea
              label="Morada fiscal *"
              required
              rows={3}
              value={form.moradaFiscal}
              onChange={(ev) => setForm((f) => ({ ...f, moradaFiscal: ev.target.value }))}
              placeholder="Rua, código postal, localidade"
            />
            <Input
              label="Email comercial"
              type="email"
              value={form.email}
              onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))}
            />
            <Input
              label="Telefone"
              value={form.telefone}
              onChange={(ev) => setForm((f) => ({ ...f, telefone: ev.target.value }))}
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={busy}>
                {busy ? "A guardar…" : "Guardar alterações"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeEditDialog}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
