"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Save, Send } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  PropostaLinhasEditor,
  linhasPropostaParaApi,
  novaPropostaLinha,
  type PropostaLinhaForm,
} from "@/components/crm/PropostaLinhasEditor";
import {
  configToPadroesForm,
  conteudoToApiPayload,
  PropostaConteudoFields,
  propostaToConteudoForm,
  type PropostaConteudoForm,
} from "@/components/crm/proposta-conteudo-fields";
import { PropostaEstadoBadge } from "@/components/crm/proposta-estado-badge";
import { fmtEuro } from "@/lib/crm/shared";
import { Alert, Button, Input, PageHeader, Textarea } from "@/components/ui";

function podeEnviarProposta(estado: string): boolean {
  return estado !== "CANCELADA";
}

type Proposta = {
  id: string;
  codigo: string;
  titulo: string;
  estado: string;
  valorCentavos: number;
  validadeAte: string | null;
  descricao: string | null;
  notasInternas: string | null;
  entidadeCliente: { nome: string; nif: string; email: string | null };
  curso: { designacao: string } | null;
  linhas: Array<{
    descricao: string;
    notas?: string | null;
    quantidade: number | string;
    precoUnitCentavos: number;
    taxaIva: number | string;
  }>;
};

export default function PropostaEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { canManageCrm } = useTenantRole();
  const [propostaId, setPropostaId] = useState<string | null>(null);
  const [proposta, setProposta] = useState<Proposta | null>(null);
  const [padroes, setPadroes] = useState<PropostaConteudoForm | null>(null);
  const [titulo, setTitulo] = useState("");
  const [validadeAte, setValidadeAte] = useState("");
  const [notasInternas, setNotasInternas] = useState("");
  const [conteudo, setConteudo] = useState<PropostaConteudoForm | null>(null);
  const [linhas, setLinhas] = useState<PropostaLinhaForm[]>([novaPropostaLinha()]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setPropostaId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!propostaId) return;
    setLoading(true);
    setError(null);
    const [pRes, cRes] = await Promise.all([
      bffFetch(`/api/v1/propostas/${propostaId}`, { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/propostas/config/template", { headers: { accept: "application/json" } }),
    ]);
    setLoading(false);
    if (!pRes.ok) {
      setError(await parseApiError(pRes));
      return;
    }
    const p = (await pRes.json()) as Proposta & Record<string, unknown>;
    setProposta(p);
    setTitulo(p.titulo);
    setValidadeAte(p.validadeAte?.slice(0, 10) ?? "");
    setNotasInternas(p.notasInternas ?? "");
    setConteudo(propostaToConteudoForm(p));
    setLinhas(
      p.linhas.length
        ? p.linhas.map((l) => ({
            key: crypto.randomUUID(),
            descricao: l.descricao,
            notas: l.notas ?? "",
            quantidade: String(Number(l.quantidade)),
            precoEuros: (l.precoUnitCentavos / 100).toFixed(2),
            taxaIva: String(Number(l.taxaIva)),
          }))
        : [novaPropostaLinha()],
    );
    if (cRes.ok) {
      const cfg = (await cRes.json() as { config: Record<string, unknown> }).config;
      setPadroes(configToPadroesForm(cfg));
    }
  }, [propostaId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function guardar() {
    if (!propostaId || !conteudo) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch(`/api/v1/propostas/${propostaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        titulo: titulo.trim(),
        validadeAte: validadeAte || null,
        notasInternas: notasInternas.trim() || null,
        linhas: linhasPropostaParaApi(linhas),
        ...conteudoToApiPayload(conteudo),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setMsg("Proposta guardada.");
    await load();
  }

  async function gerarPdf() {
    if (!propostaId) return;
    setBusy(true);
    const r = await bffFetch(`/api/v1/propostas/${propostaId}/proposta.html`, {
      headers: { accept: "text/html" },
    });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao gerar documento.");
      return;
    }
    const opened = openHtmlForPrint(await r.text());
    if (!opened.ok) setError(opened.error);
  }

  if (!canManageCrm) {
    return <p className="text-sm text-slate-400">Sem permissão para editar propostas.</p>;
  }

  if (loading || !proposta || !conteudo) {
    return <p className="text-sm text-slate-400">A carregar proposta…</p>;
  }

  const editavel = proposta.estado === "RASCUNHO";

  return (
    <div className="w-full space-y-5 pb-10">
      <PageHeader
        title={proposta.codigo}
        description={`${proposta.entidadeCliente.nome} · NIF ${proposta.entidadeCliente.nif}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/portal/propostas">
              <Button size="sm" variant="secondary">
                <ArrowLeft className="h-3.5 w-3.5" />
                Lista
              </Button>
            </Link>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void gerarPdf()}>
              <FileText className="h-3.5 w-3.5" />
              PDF
            </Button>
            {editavel ? (
              <Button size="sm" disabled={busy} onClick={() => void guardar()}>
                <Save className="h-3.5 w-3.5" />
                Guardar
              </Button>
            ) : null}
            {podeEnviarProposta(proposta.estado) ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => router.push(`/portal/propostas?enviar=${proposta.id}`)}
              >
                <Send className="h-3.5 w-3.5" />
                {proposta.estado === "RASCUNHO" ? "Enviar ao cliente" : "Reenviar ao cliente"}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <PropostaEstadoBadge estado={proposta.estado} />
        <span className="text-sm text-slate-400">{fmtEuro(proposta.valorCentavos)}</span>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {!editavel ? (
        <Alert variant="info">
          Proposta {proposta.estado.toLowerCase()} - pode visualizar e exportar PDF. Edição bloqueada.
        </Alert>
      ) : null}

      <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Identificação</h2>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Título</label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} readOnly={!editavel} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Validade</label>
          <Input type="date" value={validadeAte} onChange={(e) => setValidadeAte(e.target.value)} readOnly={!editavel} />
        </div>
        {editavel ? (
          <div>
            <label className="mb-1 block text-xs text-slate-400">Notas internas (não aparecem no PDF)</label>
            <Textarea value={notasInternas} onChange={(e) => setNotasInternas(e.target.value)} rows={2} />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Conteúdo da proposta (PDF)</h2>
        <PropostaConteudoFields
          value={conteudo}
          onChange={setConteudo}
          padroes={padroes ?? undefined}
          readOnly={!editavel}
        />
      </section>

      <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Investimento</h2>
          <p className="mt-1 text-xs text-slate-500">
            Preencha a coluna Notas por item e clique Guardar antes de gerar o PDF. As notas internas (secção
            Identificação) não aparecem no documento.
          </p>
        </div>
        <PropostaLinhasEditor hideHeader readOnly={!editavel} linhas={linhas} onChange={setLinhas} />
      </section>

      {editavel ? (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => void guardar()}>
            <Save className="h-3.5 w-3.5" />
            Guardar rascunho
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => router.push(`/portal/propostas?enviar=${proposta.id}`)}
          >
            <Send className="h-3.5 w-3.5" />
            Enviar ao cliente
          </Button>
        </div>
      ) : podeEnviarProposta(proposta.estado) ? (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => router.push(`/portal/propostas?enviar=${proposta.id}`)}
          >
            <Send className="h-3.5 w-3.5" />
            Reenviar ao cliente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
