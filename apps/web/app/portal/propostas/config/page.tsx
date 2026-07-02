"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  configToPadroesForm,
  PropostaConteudoFields,
  type PropostaConteudoForm,
} from "@/components/crm/proposta-conteudo-fields";
import { Alert, Button, Input, PageHeader } from "@/components/ui";

type Config = {
  apresentacaoEmpresa: string | null;
  enquadramentoPadrao: string | null;
  objetivosPadrao: string | null;
  conteudosProgramaticosPadrao: string | null;
  metodologiaPadrao: string | null;
  destinatariosPadrao: string | null;
  duracaoTextoPadrao: string | null;
  localTextoPadrao: string | null;
  beneficiosPadrao: string | null;
  condicoesComerciaisPadrao: string | null;
  porqueEscolherPadrao: string | null;
  proximosPassosPadrao: string | null;
  validadeDiasPadrao: number;
  nomeContacto: string | null;
  emailContacto: string | null;
  telefoneContacto: string | null;
  website: string | null;
};

export default function PropostasConfigPage() {
  const { canManage } = useTenantRole();
  const [conteudo, setConteudo] = useState<PropostaConteudoForm | null>(null);
  const [validadeDias, setValidadeDias] = useState("30");
  const [nomeContacto, setNomeContacto] = useState("");
  const [emailContacto, setEmailContacto] = useState("");
  const [telefoneContacto, setTelefoneContacto] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch("/api/v1/propostas/config/template", {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const c = (await res.json() as { config: Config }).config;
    setConteudo(configToPadroesForm(c as unknown as Record<string, unknown>));
    setValidadeDias(String(c.validadeDiasPadrao ?? 30));
    setNomeContacto(c.nomeContacto ?? "");
    setEmailContacto(c.emailContacto ?? "");
    setTelefoneContacto(c.telefoneContacto ?? "");
    setWebsite(c.website ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!conteudo) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/propostas/config/template", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        apresentacaoEmpresa: conteudo.apresentacaoEmpresa.trim() || null,
        enquadramentoPadrao: conteudo.enquadramento.trim() || null,
        objetivosPadrao: conteudo.objetivos.trim() || null,
        conteudosProgramaticosPadrao: conteudo.conteudosProgramaticos.trim() || null,
        metodologiaPadrao: conteudo.metodologia.trim() || null,
        destinatariosPadrao: conteudo.destinatarios.trim() || null,
        duracaoTextoPadrao: conteudo.duracaoTexto.trim() || null,
        localTextoPadrao: conteudo.localTexto.trim() || null,
        beneficiosPadrao: conteudo.beneficios.trim() || null,
        condicoesComerciaisPadrao: conteudo.condicoesComerciais.trim() || null,
        porqueEscolherPadrao: conteudo.porqueEscolher.trim() || null,
        proximosPassosPadrao: conteudo.proximosPassos.trim() || null,
        validadeDiasPadrao: Number.parseInt(validadeDias, 10) || 30,
        nomeContacto: nomeContacto.trim() || null,
        emailContacto: emailContacto.trim() || null,
        telefoneContacto: telefoneContacto.trim() || null,
        website: website.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Modelo padrão de propostas guardado.");
    await load();
  }

  if (!canManage) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-slate-400">Apenas o gestor pode configurar o modelo de propostas.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        title="Modelo de propostas comerciais"
        description="Textos padrão da empresa usados em todas as propostas. Os comerciais podem personalizar por proposta."
        actions={
          <Link href="/portal/propostas">
            <Button size="sm" variant="secondary">
              <ArrowLeft className="h-3.5 w-3.5" />
              Propostas
            </Button>
          </Link>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {loading || !conteudo ? (
        <p className="text-sm text-slate-400">A carregar…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Contacto comercial (PDF)</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Nome</label>
                <Input value={nomeContacto} onChange={(e) => setNomeContacto(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Email</label>
                <Input value={emailContacto} onChange={(e) => setEmailContacto(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Telefone</label>
                <Input value={telefoneContacto} onChange={(e) => setTelefoneContacto(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Website</label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Validade padrão (dias)</label>
                <Input value={validadeDias} onChange={(e) => setValidadeDias(e.target.value)} type="number" min={1} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
            <PropostaConteudoFields value={conteudo} onChange={setConteudo} />
          </section>

          <Button type="submit" disabled={busy}>
            <Save className="h-3.5 w-3.5" />
            Guardar modelo padrão
          </Button>
        </form>
      )}
    </div>
  );
}
