"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { CRM_SUGESTAO_REJEICAO_MOTIVOS, inferirAcaoPlaneada, mensagemAceiteSugestao, type CrmSugestaoExecucao } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { notifyCrmSugestoesUpdated } from "@/lib/crm/sugestoes-events";
import { parseApiError } from "@/lib/ui/backoffice";
import { CrmContextNav, SUGESTOES_NAV } from "@/components/crm/crm-context-nav";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { fmtDate } from "@/lib/crm/shared";
import { withPortalFrom } from "@/lib/ui/portal-back-nav";

type Sugestao = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  score: number | string;
  confianca: number | string;
  engine: string;
  estado: string;
  createdAt: string;
  validadoEm: string | null;
  motivoRejeicao: string | null;
  entidadeCliente: { id: string; nome: string } | null;
  leadComercial: { id: string; codigo: string; empresaNome: string } | null;
  interaccao: { id: string; titulo: string | null; resumoIa: string | null } | null;
  validadoPor: { displayName: string } | null;
  metadata?: unknown;
  execucao?: CrmSugestaoExecucao | null;
};

const MOTIVO_LABELS: Record<string, string> = {
  irrelevante: "Irrelevante",
  timing_inadequado: "Timing inadequado",
  ja_contactado: "Já contactado",
  erro_ia: "Erro da IA",
  outro: "Outro",
};

function acaoPlaneada(s: { metadata?: unknown; titulo: string; tipo: string; estado: string }): string | null {
  if (s.estado !== "PENDENTE") return null;
  return inferirAcaoPlaneada(s.metadata, s.titulo, s.tipo);
}

function SugestaoCard({
  s,
  canManageCrm,
  busy,
  fromPath,
  onAceitar,
  onRejeitar,
}: {
  s: Sugestao;
  canManageCrm: boolean;
  busy: boolean;
  fromPath: string;
  onAceitar: (id: string) => void;
  onRejeitar: (id: string) => void;
}) {
  const clienteHref = s.entidadeCliente
    ? withPortalFrom(
        `/portal/clientes/${s.entidadeCliente.id}?tab=sugestoes-ia`,
        fromPath,
      )
    : null;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
              <p className="font-medium text-slate-100">{s.titulo}</p>
              <Badge variant="default">{s.tipo.replace("_", " ")}</Badge>
              <Badge variant={s.estado === "PENDENTE" ? "yellow" : s.estado === "ACEITE" ? "green" : "red"}>
                {s.estado}
              </Badge>
            </div>
            <p className="text-sm text-slate-300 mb-2">{s.descricao}</p>
            {acaoPlaneada(s) ? (
              <p className="text-xs text-violet-300 mb-2">
                Será executado ao aceitar: {acaoPlaneada(s)}
              </p>
            ) : null}
            {s.execucao ? (
              <p className={`text-xs mb-2 ${s.execucao.sucesso ? "text-emerald-400" : "text-amber-400"}`}>
                {s.execucao.sucesso ? "Executado" : "Execução falhou"}: {s.execucao.mensagem}
              </p>
            ) : null}
            <p className="text-xs text-slate-500">
              {clienteHref ? (
                <Link href={clienteHref} className="text-violet-400 hover:underline">
                  {s.entidadeCliente!.nome}
                </Link>
              ) : (
                (s.leadComercial?.empresaNome ?? "-")
              )}
              {" · "}score {Number(s.score).toFixed(0)} · {s.engine} · {fmtDate(s.createdAt)}
            </p>
            {s.estado !== "PENDENTE" && s.validadoPor ? (
              <p className="mt-1 text-xs text-slate-400">
                {s.estado === "ACEITE" ? "Aceite" : "Rejeitada"} por {s.validadoPor.displayName}
                {s.validadoEm ? ` · ${fmtDate(s.validadoEm)}` : ""}
                {s.motivoRejeicao ? ` · ${s.motivoRejeicao}` : ""}
              </p>
            ) : null}
          </div>
          {canManageCrm && s.estado === "PENDENTE" ? (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" disabled={busy} onClick={() => onAceitar(s.id)}>
                <Check className="h-3.5 w-3.5" />
                Aceitar e executar
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRejeitar(s.id)}>
                <X className="h-3.5 w-3.5" />
                Rejeitar
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CrmSugestoesIaPage() {
  const pathname = usePathname();
  const { canManageCrm } = useTenantRole();
  const [pendentes, setPendentes] = useState<Sugestao[]>([]);
  const [historico, setHistorico] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState<string>(CRM_SUGESTAO_REJEICAO_MOTIVOS[0]);
  const [rejectComentario, setRejectComentario] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const headers = { accept: "application/json" };
    const [pRes, aRes, rRes] = await Promise.all([
      bffFetch("/api/v1/crm/sugestoes-ia?estado=PENDENTE&limit=100", { headers }),
      bffFetch("/api/v1/crm/sugestoes-ia?estado=ACEITE&limit=100", { headers }),
      bffFetch("/api/v1/crm/sugestoes-ia?estado=REJEITADA&limit=100", { headers }),
    ]);
    setLoading(false);
    if (!pRes.ok) {
      setError(await parseApiError(pRes));
      setPendentes([]);
      setHistorico([]);
      return;
    }
    setPendentes((await pRes.json()) as Sugestao[]);
    const aceites = aRes.ok ? ((await aRes.json()) as Sugestao[]) : [];
    const rejeitadas = rRes.ok ? ((await rRes.json()) as Sugestao[]) : [];
    setHistorico(
      [...aceites, ...rejeitadas].sort((a, b) => {
        const ta = a.validadoEm ?? a.createdAt;
        const tb = b.validadoEm ?? b.createdAt;
        return tb.localeCompare(ta);
      }),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function aceitar(id: string) {
    setBusy(true);
    setMsg(null);
    const res = await bffFetch(`/api/v1/crm/sugestoes-ia/${id}/aceitar`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
    else {
      const data = (await res.json()) as {
        leadComercial?: { codigo: string } | null;
        execucao?: CrmSugestaoExecucao | null;
      };
      setMsg(mensagemAceiteSugestao(data));
      notifyCrmSugestoesUpdated();
      void load();
    }
  }

  async function rejeitar() {
    if (!rejectId) return;
    setBusy(true);
    const res = await bffFetch(`/api/v1/crm/sugestoes-ia/${rejectId}/rejeitar`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ motivo: rejectMotivo, comentario: rejectComentario.trim() || undefined }),
    });
    setBusy(false);
    setRejectId(null);
    if (!res.ok) setError(await parseApiError(res));
    else {
      notifyCrmSugestoesUpdated();
      void load();
    }
  }

  return (
    <>
      <CrmContextNav tabs={SUGESTOES_NAV} ariaLabel="Secções Sugestões IA" />

      <PageHeader
        title="Sugestões IA"
        description="Sugestões pendentes de validação e histórico de decisões do tenant."
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      {loading ? (
        <p className="text-sm text-slate-500">A carregar…</p>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">
              Por aceitar ({pendentes.length})
            </h2>
            {pendentes.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-sm text-slate-500">
                  Sem sugestões pendentes. Registe uma{" "}
                  <Link href="/portal/crm/interaccoes" className="text-violet-400 underline">
                    nota comercial
                  </Link>{" "}
                  para gerar análise.
                </CardContent>
              </Card>
            ) : (
              pendentes.map((s) => (
                <SugestaoCard
                  key={s.id}
                  s={s}
                  canManageCrm={canManageCrm}
                  busy={busy}
                  fromPath={pathname}
                  onAceitar={(id) => void aceitar(id)}
                  onRejeitar={setRejectId}
                />
              ))
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">
              Histórico ({historico.length})
            </h2>
            {historico.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda não há sugestões aceites ou rejeitadas.</p>
            ) : (
              historico.map((s) => (
                <SugestaoCard
                  key={s.id}
                  s={s}
                  canManageCrm={false}
                  busy={busy}
                  fromPath={pathname}
                  onAceitar={() => undefined}
                  onRejeitar={() => undefined}
                />
              ))
            )}
          </section>
        </div>
      )}

      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent title="Rejeitar sugestão">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Motivo</label>
              <Select value={rejectMotivo} onChange={(e) => setRejectMotivo(e.target.value)}>
                {CRM_SUGESTAO_REJEICAO_MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {MOTIVO_LABELS[m] ?? m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Comentário (opcional)</label>
              <Textarea
                rows={2}
                value={rejectComentario}
                onChange={(e) => setRejectComentario(e.target.value)}
              />
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void rejeitar()}>
              Confirmar rejeição
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
