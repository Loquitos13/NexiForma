"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { NifStatusField, type NifStatus } from "@/components/crm/nif-status-field";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
} from "@/components/ui";

type ClienteForm = {
  nome: string;
  nif: string;
  email: string;
  telefone: string;
  morada: string;
  codigoPostal: string;
  cidade: string;
};

type ClienteResumo = {
  id: string;
  nome: string;
  nif: string;
};

const EMPTY: ClienteForm = {
  nome: "",
  nif: "",
  email: "",
  telefone: "",
  morada: "",
  codigoPostal: "",
  cidade: "",
};

const CODIGO_POSTAL_RE = /^\d{4}-\d{3}$/;

function formatCodigoPostal(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 7);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function buildMoradaFiscal(form: ClienteForm): string {
  const morada = form.morada.trim();
  const codigoPostal = form.codigoPostal.trim();
  const cidade = form.cidade.trim();
  return `${morada}, ${codigoPostal} ${cidade}`;
}

function mensagemClienteExistente(cliente?: ClienteResumo | null): string {
  if (cliente?.nome) {
    return `Já existe um cliente registado com este NIF: ${cliente.nome}.`;
  }
  return "Já existe um cliente registado com este NIF.";
}

export default function RegistoClienteFormacaoPage() {
  const router = useRouter();
  const { canManageFormacao: canManage } = useTenantRole();
  const [form, setForm] = useState<ClienteForm>(EMPTY);
  const [nifStatus, setNifStatus] = useState<NifStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [clienteExistente, setClienteExistente] = useState<ClienteResumo | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    setError(null);
    setMsg(null);

    if (clienteExistente) {
      return;
    }

    const nome = form.nome.trim();
    const nif = form.nif.trim();
    const email = form.email.trim();
    const morada = form.morada.trim();
    const codigoPostal = form.codigoPostal.trim();
    const cidade = form.cidade.trim();

    if (!nome) {
      setError("Indique a designação completa da empresa.");
      return;
    }
    if (!/^\d{9}$/.test(nif)) {
      setError("O NIF deve ter 9 dígitos.");
      return;
    }
    if (nifStatus === "checking") {
      setError("Aguarde a validação do NIF antes de continuar.");
      return;
    }
    if (nifStatus !== "valid") {
      setError("NIF inválido. Confirme o número antes de continuar.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Indique um email válido.");
      return;
    }
    if (!morada) {
      setError("Indique a morada completa.");
      return;
    }
    if (!CODIGO_POSTAL_RE.test(codigoPostal)) {
      setError("O código postal deve ter o formato 9999-999.");
      return;
    }
    if (!cidade) {
      setError("Indique a cidade.");
      return;
    }

    setBusy(true);
    const res = await bffFetch("/api/v1/entidades-cliente", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        nif,
        nome,
        email,
        telefone: form.telefone.trim() || undefined,
        moradaFiscal: buildMoradaFiscal(form),
      }),
    });
    setBusy(false);

    if (res.status === 409) {
      const data = (await res.json().catch(() => null)) as {
        clienteExistente?: ClienteResumo;
      } | null;
      setClienteExistente(data?.clienteExistente ?? { id: "", nome: "", nif });
      return;
    }

    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }

    const created = (await res.json()) as { id: string; nome: string };
    setMsg(`Cliente «${created.nome}» criado com sucesso.`);
    setForm(EMPTY);
    setNifStatus("idle");
    router.push(`/portal/formandos?cliente=${created.id}`);
  }

  if (!canManage) {
    return (
      <div className="max-w-lg">
        <PageHeader title="Clientes" description="Acesso reservado a gestores e coordenação pedagógica." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Clientes"
        description="Registe empresas cliente para associar formandos e acções de formação."
        actions={
          <Link
            href="/portal/formandos"
            className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Ver formandos
          </Link>
        }
      />

      {clienteExistente ? (
        <Alert variant="warning">{mensagemClienteExistente(clienteExistente)}</Alert>
      ) : null}
      {error ? <Alert variant="warning">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-teal-400" />
            Novo cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <Input
              label="Designação completa da empresa"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Nome registado na AT"
              required
            />

            <NifStatusField
              label="NIF"
              value={form.nif}
              onChange={(nif) => {
                setForm((f) => ({ ...f, nif }));
                setClienteExistente(null);
              }}
              onStatusChange={setNifStatus}
              onClienteExistente={setClienteExistente}
              tipo="empresa"
            />

            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <Input
                label="Telemóvel"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                placeholder="Opcional"
              />
            </div>

            <Input
              label="Morada completa"
              value={form.morada}
              onChange={(e) => setForm((f) => ({ ...f, morada: e.target.value }))}
              placeholder="Rua, número, andar"
              required
            />

            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Código postal"
                value={form.codigoPostal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, codigoPostal: formatCodigoPostal(e.target.value) }))
                }
                placeholder="9999-999"
                inputMode="numeric"
                maxLength={8}
                required
              />
              <Input
                label="Cidade"
                value={form.cidade}
                onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                required
              />
            </div>

            <Button type="submit" disabled={busy || Boolean(clienteExistente)}>
              {busy ? "A criar cliente…" : "Criar cliente"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
