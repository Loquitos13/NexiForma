"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Save, Send } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  PropostaLinhasEditor,
  linhasPropostaParaApi,
  novaPropostaLinha,
  validarLinhasProposta,
  type PropostaLinhaForm,
} from "@/components/crm/PropostaLinhasEditor";
import { formatarEurosInput } from "@/lib/crm/fatura-calculos";
import {
  configToPadroesForm,
  conteudoToApiPayload,
  PropostaConteudoFields,
  propostaToConteudoForm,
  type PropostaConteudoForm,
} from "@/components/crm/proposta-conteudo-fields";
import { PropostaEstadoBadge } from "@/components/crm/proposta-estado-badge";
import { PropostaDocumentoPreview } from "@/components/crm/proposta-documento-preview";
import { fmtEuro } from "@/lib/crm/shared";
import { Alert, Button, Input, PageHeader, Textarea } from "@/components/ui";
import { PortalBackButton } from "@/components/ui/portal-back-button";

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
  rejeitadaEm?: string | null;
  /** Nota deixada pelo cliente ao rejeitar. */
  motivoRejeicao?: string | null;
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
  const { id: propostaId } = use(params);
  const router = useRouter();
  const { canManageCrm, loading: roleLoading } = useTenantRole();
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
    if (p.linhas.length) {
      setLinhas(
        p.linhas.map((l) => ({
          key: crypto.randomUUID(),
          descricao: l.descricao,
          notas: l.notas ?? "",
          quantidade: String(Number(l.quantidade)),
          precoEuros: formatarEurosInput(l.precoUnitCentavos),
          taxaIva: String(Number(l.taxaIva)),
        })),
      );
    } else if (p.estado === "RASCUNHO") {
      // Propostas antigas só com valor global: pré-preencher uma linha editável.
      const seed = novaPropostaLinha();
      setLinhas([
        {
          ...seed,
          descricao: p.titulo?.trim() || "",
          precoEuros:
            p.valorCentavos > 0 ? formatarEurosInput(p.valorCentavos) : seed.precoEuros,
        },
      ]);
    } else {
      setLinhas([]);
    }
    if (cRes.ok) {
      const cfg = (await cRes.json() as { config: Record<string, unknown> }).config;
      setPadroes(configToPadroesForm(cfg));
    }
  }, [propostaId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function guardar(opts?: { silent?: boolean }): Promise<boolean> {
    if (!propostaId || !conteudo) return false;
    setError(null);
    if (!opts?.silent) setMsg(null);
    const linhasErro = validarLinhasProposta(linhas);
    if (linhasErro) {
      setError(linhasErro);
      return false;
    }
    setBusy(true);
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
      return false;
    }
    if (!opts?.silent) setMsg("Proposta guardada.");
    await load();
    return true;
  }

  async function gerarPdf() {
    if (!propostaId) return;
    // O HTML/PDF vem da BD - gravar o formulário primeiro (incl. «Usar padrão»).
    if (proposta?.estado === "RASCUNHO") {
      const ok = await guardar({ silent: true });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
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

  /** Enviar/reenviar: em rascunho grava o conteúdo antes de abrir o modal de envio. */
  async function irParaEnviar() {
    if (!proposta) return;
    if (proposta.estado === "RASCUNHO") {
      const ok = await guardar({ silent: true });
      if (!ok) return;
    }
    router.push(`/portal/propostas?enviar=${proposta.id}`);
  }

  const backButton = (
    <Suspense fallback={null}>
      <PortalBackButton fallbackHref="/portal/propostas" fallbackLabel="Propostas" />
    </Suspense>
  );

  if (roleLoading && !canManageCrm) {
    return (
      <div className="w-full space-y-5 pb-10">
        {backButton}
        <p className="text-sm text-slate-400">A carregar…</p>
      </div>
    );
  }

  if (!canManageCrm) {
    return (
      <div className="w-full space-y-5 pb-10">
        {backButton}
        <p className="text-sm text-slate-400">Sem permissão para editar propostas.</p>
      </div>
    );
  }

  if (loading || !proposta || !conteudo) {
    return (
      <div className="w-full space-y-5 pb-10">
        {backButton}
        {error ? <Alert variant="error">{error}</Alert> : null}
        <p className="text-sm text-slate-400">A carregar proposta…</p>
      </div>
    );
  }

  const editavel = proposta.estado === "RASCUNHO";

  return (
    <div className="w-full space-y-5 pb-10">
      {backButton}
      <PageHeader
        title={proposta.codigo}
        description={`${proposta.entidadeCliente.nome} · NIF ${proposta.entidadeCliente.nif}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void gerarPdf()}>
              <FileText className="h-3.5 w-3.5" />
              PDF
            </Button>
            {editavel ? (
              <Button size="sm" disabled={busy} onClick={() => void guardar({})}>
                <Save className="h-3.5 w-3.5" />
                Guardar
              </Button>
            ) : null}
            {podeEnviarProposta(proposta.estado) ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void irParaEnviar()}
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

      {proposta.estado === "REJEITADA" ? (
        <section
          className="rounded-xl border border-red-500/35 bg-red-950/35 p-5"
          aria-label="Nota do cliente na rejeição"
        >
          <h2 className="text-sm font-semibold text-red-200">Nota do cliente (rejeição)</h2>
          {proposta.rejeitadaEm ? (
            <p className="mt-1 text-xs text-red-300/70">
              Registada em{" "}
              {new Date(proposta.rejeitadaEm).toLocaleString("pt-PT", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          ) : null}
          {proposta.motivoRejeicao?.trim() ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-red-50">
              {proposta.motivoRejeicao.trim()}
            </p>
          ) : (
            <p className="mt-3 text-sm text-red-200/70">
              O cliente rejeitou a proposta sem deixar nota.
            </p>
          )}
        </section>
      ) : !editavel ? (
        <Alert variant="info">
          Proposta {proposta.estado.toLowerCase()} - pode visualizar e exportar PDF. Edição bloqueada.
        </Alert>
      ) : null}

      {!editavel ? (
        <>
          {notasInternas.trim() ? (
            <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
              <h2 className="mb-2 text-sm font-semibold text-slate-200">Notas internas</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-300">{notasInternas}</p>
            </section>
          ) : null}
          <PropostaDocumentoPreview propostaId={proposta.id} />
        </>
      ) : (
        <>
          <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Identificação</h2>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Título</label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Validade</label>
              <Input type="date" value={validadeAte} onChange={(e) => setValidadeAte(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Notas internas (não aparecem no PDF)</label>
              <Textarea value={notasInternas} onChange={(e) => setNotasInternas(e.target.value)} rows={2} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-200">Conteúdo da proposta (PDF)</h2>
            <p className="mb-4 text-xs text-slate-500">
              Preencha os campos (ou use o padrão) e clique PDF - o documento é gerado a partir do
              texto guardado nestes campos.
            </p>
            <PropostaConteudoFields
              value={conteudo}
              onChange={setConteudo}
              padroes={padroes ?? undefined}
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
            <PropostaLinhasEditor
              hideHeader
              requireDescricao
              linhas={linhas}
              onChange={setLinhas}
            />
          </section>
        </>
      )}

      {editavel ? (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => void guardar({})}>
            <Save className="h-3.5 w-3.5" />
            Guardar rascunho
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void irParaEnviar()}
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
            onClick={() => void irParaEnviar()}
          >
            <Send className="h-3.5 w-3.5" />
            Reenviar ao cliente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
