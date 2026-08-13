"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, UserPlus } from "lucide-react";
import { SIGO_HABILITACOES_QNQ, normalizarHabilitacaoQnq } from "@nexiforma/shared";
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
  Select,
} from "@/components/ui";

type Entidade = { id: string; nome: string };

type SigoForm = {
  tipoDocIdentificacao: string;
  numDocIdentificacao: string;
  dataNascimento: string;
  nacionalidade: string;
  habilitacaoLiteraria: string;
};

const EMPTY = { nome: "", nif: "", email: "", emailPresenca: "", telefone: "" };
const EMPTY_SIGO: SigoForm = {
  tipoDocIdentificacao: "CC",
  numDocIdentificacao: "",
  dataNascimento: "",
  nacionalidade: "PT",
  habilitacaoLiteraria: "3",
};

export default function RegistoFormandoClientePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canManageFormacao: canManage } = useTenantRole();
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [entidadeId, setEntidadeId] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [sigoForm, setSigoForm] = useState<SigoForm>(EMPTY_SIGO);
  const [nifStatus, setNifStatus] = useState<NifStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadEntidades = useCallback(async () => {
    const r = await bffFetch("/api/v1/entidades-cliente", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return;
    const rows = (await r.json()) as Entidade[];
    setEntidades(rows);
    const fromUrl = searchParams.get("entidadeId");
    const pick =
      fromUrl && rows.some((e) => e.id === fromUrl)
        ? fromUrl
        : rows[0]?.id ?? "";
    if (pick) setEntidadeId(pick);
  }, [searchParams]);

  useEffect(() => {
    void loadEntidades();
  }, [loadEntidades]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    if (nifStatus !== "valid") {
      setError("NIF inválido. Confirma o número antes de continuar.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const body: Record<string, unknown> = {
      nome: form.nome.trim(),
      nif: form.nif.trim(),
      email: form.email.trim() || undefined,
      emailPresenca: form.emailPresenca.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      entidadeClienteId: entidadeId || undefined,
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
    const created = (await res.json()) as { id: string };
    setMsg("Formando registado com sucesso.");
    router.push(`/portal/formandos/${created.id}`);
  }

  if (!canManage) {
    return (
      <div className="max-w-lg">
        <PageHeader title="Formando de cliente" description="Acesso reservado a gestores e coordenação pedagógica." />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Registar formando de cliente"
        description="Associa opcionalmente o formando a uma empresa cliente (CRM). Podes deixar em branco para formandos particulares."
        actions={
          <Link
            href="/portal/formandos"
            className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Ver todos os formandos
          </Link>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-teal-400" />
            Novo formando
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <label className="block text-sm space-y-1">
              <span className="text-slate-400 text-xs flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Empresa cliente (opcional)
              </span>
              <Select
                value={entidadeId}
                onChange={(e) => setEntidadeId(e.target.value)}
              >
                <option value="">- Sem empresa (particular) -</option>
                {entidades.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.nome}
                  </option>
                ))}
              </Select>
              {entidades.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Ainda não há clientes CRM.{" "}
                  <Link href="/portal/clientes" className="text-blue-400 hover:underline">
                    Criar cliente
                  </Link>
                </p>
              ) : null}
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Nome completo"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                required
              />
              <NifStatusField
                label="NIF"
                value={form.nif}
                onChange={(nif) => setForm((f) => ({ ...f, nif }))}
                onStatusChange={setNifStatus}
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                label="Email presenças"
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

            <fieldset className="rounded-xl border border-slate-700/40 p-3 space-y-3">
              <legend className="text-xs font-semibold text-slate-400 px-1">Dados SIGO</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  label="Tipo documento"
                  value={sigoForm.tipoDocIdentificacao}
                  onChange={(e) =>
                    setSigoForm((s) => ({ ...s, tipoDocIdentificacao: e.target.value }))
                  }
                />
                <Input
                  label="N.º documento"
                  value={sigoForm.numDocIdentificacao}
                  onChange={(e) =>
                    setSigoForm((s) => ({ ...s, numDocIdentificacao: e.target.value }))
                  }
                />
                <Input
                  label="Data nascimento"
                  type="date"
                  value={sigoForm.dataNascimento}
                  onChange={(e) =>
                    setSigoForm((s) => ({ ...s, dataNascimento: e.target.value }))
                  }
                />
                <Input
                  label="Nacionalidade (ISO-2)"
                  value={sigoForm.nacionalidade}
                  maxLength={2}
                  onChange={(e) =>
                    setSigoForm((s) => ({ ...s, nacionalidade: e.target.value.toUpperCase() }))
                  }
                />
                <label className="block text-sm sm:col-span-2">
                  <span className="text-slate-400 text-xs">Habilitações literárias</span>
                  <Select
                    className="mt-1"
                    value={sigoForm.habilitacaoLiteraria}
                    onChange={(e) =>
                      setSigoForm((s) => ({ ...s, habilitacaoLiteraria: e.target.value }))
                    }
                  >
                    {SIGO_HABILITACOES_QNQ.map((h) => (
                      <option key={h.codigo} value={h.codigo}>
                        {h.codigo} - {h.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </fieldset>

            <Button type="submit" disabled={busy || nifStatus !== "valid"}>
              {busy ? "A registar…" : "Registar formando"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
